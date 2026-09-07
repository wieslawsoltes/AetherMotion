/** Raster source cache. Text uses the browser's shaping engine; compositing/effects stay on GPU.
 * Raster sources are versioned by visual content, not animation time or transforms. */
export function rgba(hex, a = 1) {
    return `rgba(${parseInt(hex.slice(1, 3), 16) || 0},${parseInt(hex.slice(3, 5), 16) || 0},${parseInt(hex.slice(5, 7), 16) || 0},${a})`;
}
export function rgb(hex) {
    return [1, 3, 5].map(i => (parseInt(hex?.slice(i, i + 2), 16) || 0) / 255);
}
function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}
let orbitBitmap;
/** Deterministic, one-time procedural material baking. No stock image or network dependency. */
function bakeOrbit() {
    if (orbitBitmap)
        return orbitBitmap;
    const size = 620, c = canvas(size, size), ctx = c.getContext('2d'), im = ctx.createImageData(size, size), a = im.data;
    const cx = Math.cos(.57), sx = Math.sin(.57), cy = Math.cos(-.34), sy = Math.sin(-.34), cz = Math.cos(-.5), sz = Math.sin(-.5);
    function rot(x, y, z) {
        const ax = x * cz - y * sz, ay = x * sz + y * cz;
        const az = z * cx - ay * sx, by = z * sx + ay * cx;
        return [ax * cy + az * sy, by, -ax * sy + az * cy];
    }
    const R = .92, r = .345;
    function sdf(x, y, z) {
        const p = rot(x, y, z);
        return Math.hypot(Math.hypot(p[0], p[1]) - R, p[2]) - r;
    }
    const light = [-.45, -.65, 1], len = Math.hypot(...light);
    for (let i = 0; i < 3; i++)
        light[i] /= len;
    for (let py = 0; py < size; py++)
        for (let px = 0; px < size; px++) {
            const x = (px + .5 - size / 2) / (size * .34), y = (py + .5 - size / 2) / (size * .34);
            if (x * x + y * y > 1.9)
                continue;
            let z = 2.4, hit = false;
            for (let step = 0; step < 64; step++) {
                const d = sdf(x, y, z);
                if (d < .0015) {
                    hit = true;
                    break;
                }
                z -= Math.max(d, .001);
                if (z < -1.6)
                    break;
            }
            if (!hit)
                continue;
            const e = .002, n = [sdf(x + e, y, z) - sdf(x - e, y, z), sdf(x, y + e, z) - sdf(x, y - e, z), sdf(x, y, z + e) - sdf(x, y, z - e)], nl = Math.hypot(...n);
            for (let k = 0; k < 3; k++)
                n[k] /= nl;
            const p = rot(x, y, z), angle = Math.atan2(p[1], p[0]);
            const warm = Math.max(0, Math.min(1, (Math.cos(angle + .9) + .35) / 1.35));
            const diffuse = Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
            const h = [light[0], light[1], light[2] + 1], hl = Math.hypot(...h);
            for (let k = 0; k < 3; k++)
                h[k] /= hl;
            const spec = Math.pow(Math.max(0, n[0] * h[0] + n[1] * h[1] + n[2] * h[2]), 65);
            const fresnel = Math.pow(1 - Math.max(0, n[2]), 2.4), band = Math.pow(Math.max(0, Math.cos(n[0] * 3.2 + n[1] * 4.1 + .7)), 15);
            const b = [100 + 155 * warm, 42 + 106 * warm, 208 - 135 * warm];
            const idx = (py * size + px) * 4;
            for (let k = 0; k < 3; k++)
                a[idx + k] = Math.min(255, b[k] * (.24 + diffuse * .85) + spec * 220 + fresnel * ([65, 30, 110][k]) + band * 40);
            a[idx + 3] = 255;
        }
    ctx.putImageData(im, 0, 0);
    orbitBitmap = c;
    return c;
}
export class RasterCache {
    constructor(media, budget = 128 * 1024 * 1024) {
        this.media = media;
        this.entries = new Map();
        this.budget = budget;
        this.bytes = 0;
        this.clock = 0;
    }
    get(l) {
        const pad = Math.min(128, Math.ceil(Math.max(l.blur * 2, l.glow * 1.5, 4))), resScale = Math.min(1, 2048 / Math.max(l.width + pad * 2, l.height + pad * 2));
        const w = Math.max(1, Math.ceil((l.width + pad * 2) * resScale)), h = Math.max(1, Math.ceil((l.height + pad * 2) * resScale));
        const media = this.media?.get(l.data.assetId), version = l.type === 'video' ? (media?.version ?? 0) : 0;
        const key = JSON.stringify([l.type, l.width, l.height, pad, l.data, version]);
        let e = this.entries.get(l.id);
        if (e?.key === key) {
            e.last = ++this.clock;
            return e;
        }
        if (e)
            this.bytes -= e.bytes;
        const c = e?.canvas.width === w && e?.canvas.height === h ? e.canvas : canvas(w, h), ctx = c.getContext('2d');
        if (ctx.reset)
            ctx.reset();
        else
            c.width = c.width;
        ctx.resetTransform();
        ctx.clearRect(0, 0, w, h);
        ctx.scale(resScale, resScale);
        ctx.translate(pad, pad);
        const d = l.data ?? {}, W = l.width, H = l.height, col = d.color ?? '#c0a2ff';
        ctx.fillStyle = col;
        ctx.strokeStyle = d.stroke ?? col;
        ctx.lineWidth = d.strokeWidth ?? 0;
        if (d.mask === 'ellipse') {
            ctx.beginPath();
            ctx.ellipse(W / 2, H / 2, W / 2, H / 2, 0, 0, Math.PI * 2);
            ctx.clip();
        }
        if (d.mask === 'rounded') {
            ctx.beginPath();
            ctx.roundRect(0, 0, W, H, Math.min(W, H) * .16);
            ctx.clip();
        }
        switch (l.type) {
            case 'text': {
                ctx.fillStyle = col;
                ctx.textBaseline = 'top';
                ctx.font = `${d.fontWeight ?? 700} ${d.fontSize ?? 100}px "${d.fontFamily ?? 'Arial'}"`;
                if ('letterSpacing' in ctx)
                    ctx.letterSpacing = `${d.tracking ?? 0}px`;
                ctx.textAlign = d.align ?? 'left';
                const x = d.align === 'center' ? W / 2 : d.align === 'right' ? W : 0;
                (d.text ?? 'Text').split('\n').forEach((line, i) => ctx.fillText(line, x, i * (d.fontSize ?? 100) * (d.lineHeight ?? 1.06)));
                break;
            }
            case 'rect':
            case 'solid':
                ctx.beginPath();
                ctx.roundRect(0, 0, W, H, l.type === 'solid' ? 0 : Math.min(d.roundness ?? 28, W / 2, H / 2));
                ctx.fill();
                if (ctx.lineWidth)
                    ctx.stroke();
                break;
            case 'ellipse':
                ctx.beginPath();
                ctx.ellipse(W / 2, H / 2, W / 2, H / 2, 0, 0, Math.PI * 2);
                ctx.fill();
                if (ctx.lineWidth)
                    ctx.stroke();
                break;
            case 'path': {
                const pts = d.points ?? [];
                if (pts.length) {
                    ctx.beginPath();
                    ctx.moveTo(pts[0].x, pts[0].y);
                    for (const p of pts.slice(1))
                        ctx.lineTo(p.x, p.y);
                    ctx.closePath();
                    ctx.fill();
                    if (ctx.lineWidth)
                        ctx.stroke();
                }
                break;
            }
            case 'torus':
                ctx.drawImage(bakeOrbit(), 0, 0, W, H);
                break;
            case 'glow': {
                const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
                g.addColorStop(0, rgba(col, .72));
                g.addColorStop(.35, rgba(col, .31));
                g.addColorStop(.7, rgba(col, .08));
                g.addColorStop(1, rgba(col, 0));
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, W, H);
                break;
            }
            case 'rings': {
                ctx.strokeStyle = rgba(col, .5);
                ctx.lineWidth = 1.4;
                for (let i = 0; i < 3; i++) {
                    ctx.beginPath();
                    ctx.ellipse(W / 2, H / 2, W * (.43 + i * .025), H * (.25 + i * .022), -.16, 0, Math.PI * 2);
                    ctx.stroke();
                }
                for (const [x, y, r] of [[.06, .38, 4], [.95, .52, 6], [.71, .86, 3]]) {
                    ctx.beginPath();
                    ctx.arc(W * x, H * y, r, 0, 7);
                    ctx.fill();
                }
                break;
            }
            case 'grid': {
                const g = ctx.createLinearGradient(0, 0, W, H);
                g.addColorStop(0, '#11101e');
                g.addColorStop(1, '#080813');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, W, H);
                ctx.strokeStyle = 'rgba(156,137,188,.075)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let x = 0; x < W; x += 90) {
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, H);
                }
                for (let y = 0; y < H; y += 90) {
                    ctx.moveTo(0, y);
                    ctx.lineTo(W, y);
                }
                ctx.stroke();
                let seed = 417;
                for (let i = 0; i < 440; i++) {
                    seed = (seed * 16807) % 2147483647;
                    const x = seed % W;
                    seed = (seed * 16807) % 2147483647;
                    const y = seed % H;
                    ctx.fillStyle = `rgba(191,177,214,${.03 + (seed % 7) / 55})`;
                    ctx.fillRect(x, y, 1.3, 1.3);
                }
                break;
            }
            case 'image':
            case 'video':
                if (media?.element && (l.type !== 'video' || media.element.readyState >= 2))
                    ctx.drawImage(media.element, 0, 0, W, H);
                break;
            case 'null': break;
        }
        ctx.resetTransform();
        e = { canvas: c, key, pad, resScale, revision: (e?.revision ?? 0) + 1, bytes: w * h * 4, last: ++this.clock };
        this.entries.set(l.id, e);
        this.bytes += e.bytes;
        this.trim(l.id);
        return e;
    }
    trim(keep) {
        while (this.bytes > this.budget && this.entries.size > 1) {
            const oldest = [...this.entries].filter(([id]) => id !== keep).sort((a, b) => a[1].last - b[1].last)[0];
            this.entries.delete(oldest[0]);
            this.bytes -= oldest[1].bytes;
        }
    }
    clear() {
        this.entries.clear();
        this.bytes = 0;
    }
}
