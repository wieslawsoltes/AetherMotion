import { COMPOSITOR_WGSL, PRESENT_WGSL } from './shaders.js';
import { rgb } from './raster.js';
const MODES = { normal: 0, multiply: 1, screen: 2, add: 3, overlay: 4, difference: 5 };
const BLENDS = { normal: 'source-over', multiply: 'multiply', screen: 'screen', add: 'lighter', overlay: 'overlay', difference: 'difference' };
/** WebGPU render graph: normal layers share a pass; destination-dependent blend modes use ping-pong.
 * 256-byte dynamic uniform slots, cached source textures, one command submission/frame. */
export class GPURenderer {
    constructor(canvas, raster, onFault) {
        this.canvas = canvas;
        this.raster = raster;
        this.onFault = onFault;
        this.sources = new Map();
        this.frame = 0;
        this.kind = 'WebGPU';
        this.disposed = false;
        this.stats = { passes: 0, layers: 0, submitMs: 0 };
    }
    async init() {
        if (!navigator.gpu)
            throw new Error('WebGPU is not exposed by this browser.');
        this.adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (!this.adapter)
            throw new Error('No WebGPU adapter is available.');
        const d = this.device = await this.adapter.requestDevice();
        d.addEventListener('uncapturederror', e => {
            console.error(e.error);
            this.onFault?.(e.error.message);
        });
        d.lost.then(info => {
            if (!this.disposed)
                this.onFault?.(`GPU device lost: ${info.message}`);
        });
        this.uniforms = d.createBuffer({ label: 'Layer uniform arena', size: 256 * 512, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.uniformLayout = d.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: 96 } }] });
        this.textureLayout = d.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} }, { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} }, { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} }] });
        this.uniformGroup = d.createBindGroup({ layout: this.uniformLayout, entries: [{ binding: 0, resource: { buffer: this.uniforms, size: 96 } }] });
        const module = d.createShaderModule({ label: 'Aether compositor WGSL', code: COMPOSITOR_WGSL });
        const messages = await module.getCompilationInfo();
        const errors = messages.messages.filter(m => m.type === 'error');
        if (errors.length)
            throw new Error(errors.map(e => e.message).join('\n'));
        const layout = d.createPipelineLayout({ bindGroupLayouts: [this.uniformLayout, this.textureLayout] });
        const base = { layout, vertex: { module, entryPoint: 'vertexMain' }, primitive: { topology: 'triangle-list' } };
        this.normal = await d.createRenderPipelineAsync({ ...base, fragment: { module, entryPoint: 'normalMain', targets: [{ format: 'rgba8unorm', blend: { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } } }] } });
        this.blend = await d.createRenderPipelineAsync({ ...base, fragment: { module, entryPoint: 'blendMain', targets: [{ format: 'rgba8unorm' }] } });
        this.format = navigator.gpu.getPreferredCanvasFormat();
        const presentModule = d.createShaderModule({ code: PRESENT_WGSL });
        this.present = await d.createRenderPipelineAsync({ layout: 'auto', vertex: { module: presentModule, entryPoint: 'vs' }, fragment: { module: presentModule, entryPoint: 'fs', targets: [{ format: this.format }] }, primitive: { topology: 'triangle-list' } });
        this.sampler = d.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        this.dummy = d.createTexture({ size: [1, 1], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
        d.queue.writeTexture({ texture: this.dummy }, new Uint8Array(4), { bytesPerRow: 4 }, [1, 1]);
        this.context = this.canvas.getContext('webgpu');
        if (!this.context)
            throw new Error('Could not obtain a GPU canvas.');
        this.context.configure({ device: d, format: this.format, alphaMode: 'premultiplied' });
        return this;
    }
    resize(w, h) {
        if (this.width === w && this.height === h)
            return;
        this.width = w;
        this.height = h;
        this.canvas.width = w;
        this.canvas.height = h;
        this.targets?.forEach(t => t.destroy());
        this.targets = [0, 1].map(() => this.device.createTexture({ size: [w, h], format: 'rgba8unorm', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST }));
        this.targetViews = this.targets.map(t => t.createView());
        this.presentGroups = this.targetViews.map(view => this.device.createBindGroup({ layout: this.present.getBindGroupLayout(0), entries: [{ binding: 0, resource: view }, { binding: 1, resource: this.sampler }] }));
        for (const s of this.sources.values())
            s.groups = null;
    }
    source(l) {
        const r = this.raster.get(l);
        let s = this.sources.get(l.id);
        const d = this.device;
        if (!s || s.w !== r.canvas.width || s.h !== r.canvas.height) {
            s?.texture.destroy();
            s = { texture: d.createTexture({ label: l.name, size: [r.canvas.width, r.canvas.height], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT }), w: r.canvas.width, h: r.canvas.height, key: null };
            this.sources.set(l.id, s);
        }
        if (s.key !== r.key) {
            d.queue.copyExternalImageToTexture({ source: r.canvas }, { texture: s.texture, premultipliedAlpha: true }, [s.w, s.h]);
            s.key = r.key;
        }
        if (!s.groups) {
            const view = s.texture.createView();
            s.groups = [this.dummy.createView(), ...this.targetViews].map(dst => d.createBindGroup({ layout: this.textureLayout, entries: [{ binding: 0, resource: view }, { binding: 1, resource: this.sampler }, { binding: 2, resource: dst }] }));
        }
        s.last = this.frame;
        return { s, r };
    }
    render(doc, scene, quality = 1) {
        const started = performance.now();
        this.resize(Math.max(1, Math.round(doc.width * quality)), Math.max(1, Math.round(doc.height * quality)));
        this.frame++;
        const layers = scene.filter(l => l.opacity > 0 && l.type !== 'null');
        const data = new Float32Array(64 * Math.max(1, layers.length));
        const sources = layers.map((l, i) => {
            const { s, r } = this.source(l), o = i * 64, m = l.matrix;
            data.set([m[0], m[1], m[2], m[3], m[4], m[5], doc.width, doc.height, l.width, l.height, r.pad, l.opacity / 100, l.blur, l.glow, l.exposure, l.saturation, ...rgb(l.data.color ?? '#b690ff'), l.hue * Math.PI / 180, MODES[l.blend] ?? 0, 0, 0, 0], o);
            return s;
        });
        this.device.queue.writeBuffer(this.uniforms, 0, data);
        const enc = this.device.createCommandEncoder({ label: 'Composition frame' });
        let front = 0, pass = null, passes = 0;
        const bg = rgb(doc.background), alpha = doc.transparent ? 0 : 1;
        const begin = (index, clear = false) => {
            passes++;
            return enc.beginRenderPass({ colorAttachments: [{ view: this.targetViews[index], loadOp: clear ? 'clear' : 'load', storeOp: 'store', clearValue: { r: bg[0] * alpha, g: bg[1] * alpha, b: bg[2] * alpha, a: alpha } }] });
        };
        pass = begin(front, true);
        for (let i = 0; i < layers.length; i++) {
            const special = MODES[layers[i].blend] > 0;
            if (special) {
                pass.end();
                const back = 1 - front;
                enc.copyTextureToTexture({ texture: this.targets[front] }, { texture: this.targets[back] }, [this.width, this.height]);
                pass = begin(back);
                pass.setPipeline(this.blend);
                pass.setBindGroup(0, this.uniformGroup, [i * 256]);
                pass.setBindGroup(1, sources[i].groups[front + 1]);
                pass.draw(6);
                pass.end();
                front = back;
                pass = begin(front);
            }
            else {
                pass.setPipeline(this.normal);
                pass.setBindGroup(0, this.uniformGroup, [i * 256]);
                pass.setBindGroup(1, sources[i].groups[0]);
                pass.draw(6);
            }
        }
        pass.end();
        const final = enc.beginRenderPass({ colorAttachments: [{ view: this.context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }] });
        final.setPipeline(this.present);
        final.setBindGroup(0, this.presentGroups[front]);
        final.draw(3);
        final.end();
        this.device.queue.submit([enc.finish()]);
        this.front = front;
        for (const [id, s] of this.sources) {
            if (this.frame - s.last > 120) {
                s.texture.destroy();
                this.sources.delete(id);
            }
        }
        this.stats = { layers: layers.length, passes: passes + 1, submitMs: performance.now() - started, textureBytes: [...this.sources.values()].reduce((n, s) => n + s.w * s.h * 4, 0) };
    }
    async flush() {
        await this.device.queue.onSubmittedWorkDone();
    }
    async capture() {
        const width = this.width, height = this.height;
        const bytesPerRow = Math.ceil(width * 4 / 256) * 256, b = this.device.createBuffer({ size: bytesPerRow * height, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }), e = this.device.createCommandEncoder();
        e.copyTextureToBuffer({ texture: this.targets[this.front] }, { buffer: b, bytesPerRow }, [width, height]);
        this.device.queue.submit([e.finish()]);
        await b.mapAsync(GPUMapMode.READ);
        const raw = new Uint8Array(b.getMappedRange()), pixels = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y++) {
            pixels.set(raw.subarray(y * bytesPerRow, y * bytesPerRow + width * 4), y * width * 4);
        }
        for (let i = 0; i < pixels.length; i += 4) {
            const a = pixels[i + 3] / 255;
            if (a > 0 && a < 1) {
                pixels[i] /= a;
                pixels[i + 1] /= a;
                pixels[i + 2] /= a;
            }
        }
        b.unmap();
        b.destroy();
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        c.getContext('2d').putImageData(new ImageData(pixels, width, height), 0, 0);
        return c;
    }
    dispose() {
        this.disposed = true;
        this.targets?.forEach(t => t.destroy());
        for (const s of this.sources.values())
            s.texture.destroy();
        this.uniforms?.destroy();
        this.dummy?.destroy();
        this.device?.destroy();
    }
}
export class CanvasRenderer {
    constructor(canvas, raster) {
        this.canvas = canvas;
        this.raster = raster;
        this.ctx = canvas.getContext('2d');
        this.kind = 'Canvas 2D';
        this.stats = {};
    }
    render(doc, scene, quality = 1) {
        const start = performance.now(), w = Math.round(doc.width * quality), h = Math.round(doc.height * quality);
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
        const c = this.ctx;
        c.resetTransform();
        c.clearRect(0, 0, w, h);
        if (!doc.transparent) {
            c.fillStyle = doc.background;
            c.fillRect(0, 0, w, h);
        }
        let count = 0;
        for (const l of scene) {
            if (l.opacity <= 0 || l.type === 'null')
                continue;
            const r = this.raster.get(l);
            c.save();
            c.scale(quality, quality);
            c.transform(...l.matrix);
            c.globalAlpha = l.opacity / 100;
            c.globalCompositeOperation = BLENDS[l.blend] ?? 'source-over';
            c.filter = `blur(${l.blur}px) brightness(${2 ** l.exposure}) saturate(${l.saturation}%) hue-rotate(${l.hue}deg)`;
            if (l.glow) {
                c.shadowColor = l.data.color ?? '#ad83ff';
                c.shadowBlur = l.glow;
                c.shadowOffsetX = 0;
                c.shadowOffsetY = 0;
            }
            c.drawImage(r.canvas, -r.pad, -r.pad, l.width + 2 * r.pad, l.height + 2 * r.pad);
            c.restore();
            count++;
        }
        this.stats = { layers: count, passes: 1, submitMs: performance.now() - start, textureBytes: this.raster.bytes };
    }
    async flush() {
    }
    async capture() {
        const c = document.createElement('canvas');
        c.width = this.canvas.width;
        c.height = this.canvas.height;
        c.getContext('2d').drawImage(this.canvas, 0, 0);
        return c;
    }
    dispose() {
    }
}
export async function createRenderer(canvas, raster, onFault, forceCanvas = false) {
    if (!forceCanvas) {
        const gpu = new GPURenderer(canvas, raster, onFault);
        try {
            return await gpu.init();
        }
        catch (e) {
            console.warn('WebGPU initialization:', e.message);
            gpu.dispose();
            if (canvas.getContext('2d') === null) {
                const replacement = canvas.cloneNode();
                canvas.replaceWith(replacement);
                canvas = replacement;
            }
        }
    }
    return new CanvasRenderer(canvas, raster);
}
