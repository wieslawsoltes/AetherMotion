/** Serializable document model, frame-accurate animation, affine transforms and transactions.
 * No DOM, GPU objects, executable expressions, or media bytes enter the model. */
export const VERSION = 1;
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const uid = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const clone = value => structuredClone(value);
export const PROPS = ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity', 'anchorX', 'anchorY', 'blur', 'glow', 'exposure', 'saturation', 'hue'];
export const PROP_NAMES = { x: 'Position X', y: 'Position Y', scaleX: 'Scale X', scaleY: 'Scale Y', rotation: 'Rotation', opacity: 'Opacity', anchorX: 'Anchor X', anchorY: 'Anchor Y', blur: 'Soft blur', glow: 'Glow', exposure: 'Exposure', saturation: 'Saturation', hue: 'Hue' };
export const TYPES = ['text', 'rect', 'ellipse', 'solid', 'torus', 'grid', 'glow', 'rings', 'path', 'image', 'video', 'null'];
export const EASINGS = ['linear', 'ease', 'ease-in', 'ease-out', 'hold'];
const finite = (v, fallback, lo = -1e6, hi = 1e6) => typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
export function ease(t, mode = 'linear') {
    t = clamp(t, 0, 1);
    if (mode === 'hold')
        return t < 1 ? 0 : 1;
    if (mode === 'ease')
        return t * t * (3 - 2 * t);
    if (mode === 'ease-in')
        return t * t * t;
    if (mode === 'ease-out')
        return 1 - (1 - t) ** 3;
    if (Array.isArray(mode) && mode.length === 4) {
        const [x1, y1, x2, y2] = mode;
        const bez = (s, a, b) => 3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s * s * b + s ** 3;
        let lo = 0, hi = 1, s = t;
        for (let i = 0; i < 22; i++) {
            s = (lo + hi) / 2;
            if (bez(s, x1, x2) < t)
                lo = s;
            else
                hi = s;
        }
        return bez(s, y1, y2);
    }
    return t;
}
export function sampleTrack(keys, t, fallback) {
    if (!keys?.length)
        return fallback;
    if (t <= keys[0].t)
        return keys[0].v;
    const last = keys.at(-1);
    if (t >= last.t)
        return last.v;
    let lo = 0, hi = keys.length - 1;
    while (hi - lo > 1) {
        const m = (hi + lo) >> 1;
        if (keys[m].t <= t)
            lo = m;
        else
            hi = m;
    }
    const a = keys[lo], b = keys[hi], d = b.t - a.t;
    return a.v + (b.v - a.v) * ease(d > 0 ? (t - a.t) / d : 1, a.ease);
}
export function setKey(layer, prop, t, value, fps = 30, easing = 'ease') {
    if (!PROPS.includes(prop))
        throw new Error(`Not an animatable property: ${prop}`);
    const time = Math.round(t * fps) / fps;
    const track = layer.tracks[prop] ??= [];
    const key = track.find(k => Math.abs(k.t - time) < 0.5 / fps);
    if (key)
        key.v = value;
    else
        track.push({ id: uid(), t: time, v: value, ease: easing });
    track.sort((a, b) => a.t - b.t);
}
export const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
export function invert(m) {
    const d = m[0] * m[3] - m[1] * m[2];
    if (Math.abs(d) < 1e-10)
        return null;
    return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d];
}
export const point = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
export function localMatrix(l) {
    const r = l.rotation * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), sx = l.scaleX / 100, sy = l.scaleY / 100, a = c * sx, b = s * sx, cc = -s * sy, d = c * sy, ax = l.width * l.anchorX / 100, ay = l.height * l.anchorY / 100;
    return [a, b, cc, d, l.x - a * ax - cc * ay, l.y - b * ax - d * ay];
}
export function evaluate(doc, t) {
    const map = new Map(doc.layers.map(l => [l.id, l])), memo = new Map(), visiting = new Set();
    function resolve(l) {
        if (memo.has(l.id))
            return memo.get(l.id);
        if (visiting.has(l.id))
            throw new Error('Parent cycle detected');
        visiting.add(l.id);
        const e = { ...l };
        for (const p of PROPS)
            e[p] = sampleTrack(l.tracks[p], t, l[p]);
        e.opacity = clamp(e.opacity, 0, 100);
        e.matrix = localMatrix(e);
        if (l.parent && map.has(l.parent)) {
            const parent = resolve(map.get(l.parent));
            e.matrix = mul(parent.matrix, e.matrix);
        }
        visiting.delete(l.id);
        memo.set(l.id, e);
        return e;
    }
    const solo = doc.layers.some(l => l.solo);
    return doc.layers.filter(l => l.enabled && (!solo || l.solo) && t >= l.start && t < l.end).map(resolve).reverse();
}
export function getEvaluated(doc, id, t) {
    const copy = { ...doc, layers: doc.layers.map(l => ({ ...l, enabled: true, solo: false, start: -Infinity, end: Infinity })) };
    return evaluate(copy, t).find(l => l.id === id);
}
export function canParent(doc, id, parent) {
    let p = parent;
    const seen = new Set([id]);
    while (p) {
        if (seen.has(p))
            return false;
        seen.add(p);
        p = doc.layers.find(l => l.id === p)?.parent;
    }
    return true;
}
export function hitTest(scene, x, y) {
    for (const l of [...scene].reverse()) {
        if (l.locked || l.type === 'null')
            continue;
        const inv = invert(l.matrix);
        if (!inv)
            continue;
        const p = point(inv, x, y);
        if (p.x >= 0 && p.x <= l.width && p.y >= 0 && p.y <= l.height) {
            if (l.type === 'ellipse' && ((p.x / l.width - .5) ** 2 + (p.y / l.height - .5) ** 2) > .25)
                continue;
            return l.id;
        }
    }
    return null;
}
export function layer(type, options = {}) {
    return { id: uid(), name: ({ text: 'Text', rect: 'Rectangle', ellipse: 'Ellipse', solid: 'Solid', torus: 'Chromatic orbit', null: 'Null object' })[type] ?? type,
        type, label: ({ text: '#b39be8', torus: '#e69a7b', image: '#88b5d4', video: '#88b5d4', solid: '#818ba4', null: '#e48484' })[type] ?? '#79c9b1',
        enabled: true, locked: false, solo: false, parent: null, blend: 'normal', start: 0, end: 12, x: 960, y: 540, width: 520, height: 260,
        scaleX: 100, scaleY: 100, rotation: 0, opacity: 100, anchorX: 50, anchorY: 50, blur: 0, glow: 0, exposure: 0, saturation: 100, hue: 0,
        tracks: {}, data: { color: '#c0a2ff', text: 'Your next idea.', fontSize: 100, fontFamily: 'Arial', fontWeight: 700, align: 'left', lineHeight: 1.06, roundness: 28, stroke: '#ffffff', strokeWidth: 0, mask: 'none', feather: 0 }, ...options };
}
export function blankDocument() {
    return { version: VERSION, id: uid(), name: 'Untitled composition', width: 1920, height: 1080, fps: 30, duration: 12, background: '#101019', transparent: false, workIn: 0, workOut: 12, markers: [], layers: [] };
}
export function demoDocument() {
    const d = { ...blankDocument(), name: 'Orbit — Brand Film', background: '#090915' };
    const title = layer('text', { name: 'Beyond the frame', width: 1080, height: 334, x: 650, y: 520, data: { color: '#f6f3ff', text: 'BEYOND\nTHE FRAME.', fontSize: 148, fontFamily: 'Arial', fontWeight: 800, align: 'left', lineHeight: 1.0, tracking: -5 } });
    title.tracks.y = [{ id: uid(), t: 0, v: 620, ease: 'ease-out' }, { id: uid(), t: 1.2, v: 520, ease: 'ease' }, { id: uid(), t: 10, v: 520, ease: 'ease-in' }, { id: uid(), t: 11.8, v: 470, ease: 'linear' }];
    title.tracks.opacity = [{ id: uid(), t: 0, v: 0, ease: 'ease-out' }, { id: uid(), t: .9, v: 100, ease: 'linear' }, { id: uid(), t: 10.5, v: 100, ease: 'ease' }, { id: uid(), t: 12, v: 0, ease: 'linear' }];
    const tagline = layer('text', { name: 'A new dimension of motion', x: 550, y: 760, width: 880, height: 60, opacity: 78, data: { text: 'A new dimension of motion.', fontSize: 37, fontFamily: 'Arial', fontWeight: 400, color: '#e1d8f0' } });
    tagline.tracks.opacity = [{ id: uid(), t: .5, v: 0, ease: 'ease' }, { id: uid(), t: 1.8, v: 78, ease: 'linear' }];
    const logo = layer('text', { name: 'AETHER® / wordmark', x: 355, y: 130, width: 490, height: 52, data: { text: 'AETHER®', fontSize: 40, fontFamily: 'Arial', fontWeight: 700, color: '#f5efff', tracking: 6 } });
    const kicker = layer('text', { name: 'Design in motion', x: 370, y: 305, width: 480, height: 34, data: { text: 'D E S I G N   I N   M O T I O N', fontSize: 20, fontFamily: 'Arial', fontWeight: 400, color: '#c9b8ed' } });
    const footer = layer('text', { name: 'Edition / 2026', x: 480, y: 974, width: 740, height: 32, data: { text: 'BRAND EXPLORATION     /     2026', fontSize: 19, fontFamily: 'Arial', fontWeight: 400, color: '#a9a0bf', tracking: 2 } });
    const number = layer('text', { name: '001 / Infinite possibilities', x: 1520, y: 974, width: 590, height: 32, data: { text: '001  —  INFINITE POSSIBILITIES', fontSize: 18, fontFamily: 'Arial', fontWeight: 400, color: '#a9a0bf', align: 'right', tracking: 1 } });
    const orb = layer('torus', { name: 'Orbit / iridescent chrome', x: 1330, y: 528, width: 1090, height: 1090, rotation: -12, data: { color: '#9f5ffe' } });
    orb.tracks.rotation = [{ id: uid(), t: 0, v: -25, ease: 'ease' }, { id: uid(), t: 6, v: 14, ease: 'ease' }, { id: uid(), t: 12, v: -25, ease: 'linear' }];
    orb.tracks.scaleX = [{ id: uid(), t: 0, v: 82, ease: 'ease-out' }, { id: uid(), t: 2, v: 100, ease: 'ease' }, { id: uid(), t: 12, v: 110, ease: 'linear' }];
    orb.tracks.scaleY = orb.tracks.scaleX.map(k => ({ ...k, id: uid() }));
    const spark = layer('ellipse', { name: 'Signal / warm amber', x: 116, y: 292, width: 11, height: 11, data: { color: '#f4ae83' }, glow: 22 });
    const rings = layer('rings', { name: 'Orbital paths', x: 1350, y: 528, width: 1380, height: 1050, rotation: -18, opacity: 50, data: { color: '#a99ad0' } });
    rings.tracks.rotation = [{ id: uid(), t: 0, v: -18, ease: 'linear' }, { id: uid(), t: 12, v: 22, ease: 'linear' }];
    const glow = layer('glow', { name: 'Ambient / ultraviolet', x: 1190, y: 570, width: 1680, height: 1260, opacity: 80, blend: 'screen', data: { color: '#6136af' } });
    const grid = layer('grid', { name: 'Midnight / grid & grain', x: 960, y: 540, width: 1920, height: 1080, locked: true, data: { color: '#1c1730' } });
    d.layers = [logo, kicker, title, tagline, footer, number, spark, orb, rings, glow, grid];
    d.markers = [{ id: uid(), t: 0, name: 'INTRO' }, { id: uid(), t: 2, name: 'REVEAL' }, { id: uid(), t: 8, name: 'HOLD' }];
    return d;
}
/** Bounded snapshot history. A drag is one transaction, never one undo item per pointermove. */
export class History {
    constructor(limit = 80, maxBytes = 32 * 1024 * 1024) {
        this.limit = limit;
        this.maxBytes = maxBytes;
        this.past = [];
        this.future = [];
        this.pending = null;
        this.bytes = 0;
    }
    begin(doc, label) {
        if (!this.pending)
            this.pending = { doc: clone(doc), label };
    }
    commit(doc) {
        if (!this.pending)
            return false;
        const old = this.pending;
        this.pending = null;
        const before = JSON.stringify(old.doc), after = JSON.stringify(doc);
        if (before === after)
            return false;
        old.bytes = before.length * 2;
        this.past.push(old);
        this.bytes += old.bytes;
        while (this.past.length > this.limit || this.bytes > this.maxBytes) {
            this.bytes -= this.past.shift().bytes;
        }
        this.future = [];
        return true;
    }
    cancel() {
        const d = this.pending?.doc;
        this.pending = null;
        return d;
    }
    undo(doc) {
        const last = this.past.pop();
        if (!last)
            return doc;
        this.bytes -= last.bytes;
        this.future.push({ doc: clone(doc), label: last.label });
        return clone(last.doc);
    }
    redo(doc) {
        const next = this.future.pop();
        if (!next)
            return doc;
        const item = { doc: clone(doc), label: next.label, bytes: JSON.stringify(doc).length * 2 };
        this.past.push(item);
        this.bytes += item.bytes;
        return clone(next.doc);
    }
    clear() {
        this.past = [];
        this.future = [];
        this.pending = null;
        this.bytes = 0;
    }
}
const str = (v, max = 256) => typeof v === 'string' ? v.slice(0, max) : '';
const hex = (v, fallback = '#ffffff') => /^#[\da-f]{6}$/i.test(v) ? v : fallback;
/** Whitelist + bound all imported fields before they reach allocation or rendering code. */
export function validateDocument(raw) {
    if (!raw || raw.version !== VERSION || !Array.isArray(raw.layers))
        throw new Error('Not a supported Aether Motion project (version 1).');
    if (raw.layers.length > 300)
        throw new Error('Projects are limited to 300 layers.');
    const d = blankDocument();
    d.id = str(raw.id) || uid();
    d.name = str(raw.name) || 'Untitled composition';
    d.width = Math.round(finite(raw.width, 1920, 64, 4096));
    d.height = Math.round(finite(raw.height, 1080, 64, 4096));
    d.fps = Math.round(finite(raw.fps, 30, 1, 120));
    d.duration = finite(raw.duration, 12, .1, 600);
    d.background = hex(raw.background, '#101019');
    d.transparent = raw.transparent === true;
    d.workIn = finite(raw.workIn, 0, 0, d.duration - .01);
    d.workOut = finite(raw.workOut, d.duration, d.workIn + .01, d.duration);
    const ids = new Set();
    d.layers = raw.layers.map(r => {
        if (!r || !TYPES.includes(r.type))
            throw new Error('Unsupported layer type.');
        const l = layer(r.type);
        l.id = str(r.id) || uid();
        if (ids.has(l.id))
            throw new Error('Duplicate layer ID.');
        ids.add(l.id);
        l.name = str(r.name) || l.name;
        l.label = hex(r.label, l.label);
        l.enabled = r.enabled !== false;
        l.locked = r.locked === true;
        l.solo = r.solo === true;
        l.parent = str(r.parent) || null;
        l.blend = ['normal', 'multiply', 'screen', 'add', 'overlay', 'difference'].includes(r.blend) ? r.blend : 'normal';
        l.start = finite(r.start, 0, 0, d.duration);
        l.end = finite(r.end, d.duration, l.start, d.duration);
        l.width = finite(r.width, 520, 1, 4096);
        l.height = finite(r.height, 260, 1, 4096);
        for (const p of PROPS)
            l[p] = finite(r[p], l[p]);
        l.scaleX = clamp(l.scaleX, -5000, 5000);
        l.scaleY = clamp(l.scaleY, -5000, 5000);
        l.opacity = clamp(l.opacity, 0, 100);
        l.blur = clamp(l.blur, 0, 80);
        l.glow = clamp(l.glow, 0, 100);
        l.saturation = clamp(l.saturation, 0, 300);
        l.exposure = clamp(l.exposure, -8, 8);
        const a = r.data ?? {};
        l.data = { color: hex(a.color, '#c0a2ff'), text: str(a.text, 20000), fontFamily: ['Arial', 'Georgia', 'Courier New', 'Verdana', 'Trebuchet MS', 'Times New Roman'].includes(a.fontFamily) ? a.fontFamily : 'Arial', fontSize: finite(a.fontSize, 100, 6, 600), fontWeight: finite(a.fontWeight, 700, 100, 900), lineHeight: finite(a.lineHeight, 1.06, .5, 3), align: ['left', 'center', 'right'].includes(a.align) ? a.align : 'left', tracking: finite(a.tracking, 0, -20, 100), roundness: finite(a.roundness, 28, 0, 500), stroke: hex(a.stroke), strokeWidth: finite(a.strokeWidth, 0, 0, 100), mask: ['none', 'ellipse', 'rounded'].includes(a.mask) ? a.mask : 'none', feather: finite(a.feather, 0, 0, 100), assetId: str(a.assetId), points: Array.isArray(a.points) ? a.points.slice(0, 10000).map(p => ({ x: finite(p.x, 0), y: finite(p.y, 0) })) : [] };
        for (const p of PROPS) {
            const keys = r.tracks?.[p];
            if (!Array.isArray(keys))
                continue;
            if (keys.length > 5000)
                throw new Error('Too many keyframes.');
            const byTime = new Map();
            for (const k of keys) {
                const t = Math.round(finite(k.t, 0, 0, d.duration) * d.fps) / d.fps;
                byTime.set(t, { id: str(k.id) || uid(), t, v: finite(k.v, l[p]), ease: EASINGS.includes(k.ease) ? k.ease : 'linear' });
            }
            l.tracks[p] = [...byTime.values()].sort((a, b) => a.t - b.t);
        }
        return l;
    });
    for (const l of d.layers) {
        if (!ids.has(l.parent))
            l.parent = null;
        if (!canParent(d, l.id, l.parent))
            throw new Error('The project has a cyclic layer hierarchy.');
    }
    d.markers = Array.isArray(raw.markers) ? raw.markers.slice(0, 500).map(m => ({ id: str(m.id) || uid(), t: finite(m.t, 0, 0, d.duration), name: str(m.name, 100) })) : [];
    return d;
}
export function timecode(t, fps = 30) {
    const f = Math.max(0, Math.round(t * fps)), frames = f % fps, s = Math.floor(f / fps) % 60, m = Math.floor(f / fps / 60) % 60, h = Math.floor(f / fps / 3600);
    return [h, m, s, frames].map(x => String(x).padStart(2, '0')).join(':');
}
