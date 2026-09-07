import { uid } from './core.js';
const MAX_ASSET_BYTES = 80 * 1024 * 1024;
function readData(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
    });
}
function loaded(element, event) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => finish(new Error('Media decoding timed out.')), 15000);
        const ok = () => finish(), fail = () => finish(new Error('This browser cannot decode the media file.'));
        function finish(err) {
            clearTimeout(timer);
            element.removeEventListener(event, ok);
            element.removeEventListener('error', fail);
            err ? reject(err) : resolve();
        }
        element.addEventListener(event, ok, { once: true });
        element.addEventListener('error', fail, { once: true });
    });
}
export class MediaLibrary {
    constructor(invalidate = () => {
    }) {
        this.assets = new Map();
        this.invalidate = invalidate;
    }
    get(id) {
        return this.assets.get(id);
    }
    async importFile(file) {
        if (file.size > MAX_ASSET_BYTES)
            throw new Error('One media asset may be at most 80 MB.');
        const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;
        if (!type)
            throw new Error('Import PNG, JPEG, WebP, GIF, SVG, or a browser-decodable video.');
        const asset = { id: uid(), name: file.name, type, mime: file.type, src: await readData(file) };
        return this.add(asset);
    }
    async add(asset) {
        if (!asset || !['image', 'video'].includes(asset.type) || typeof asset.id !== 'string' || typeof asset.src !== 'string' || asset.src.length > 115 * 1024 * 1024 || !/^data:(image|video)\/[a-z0-9.+-]+;base64,/i.test(asset.src))
            throw new Error('Invalid embedded media asset.');
        let element;
        if (asset.type === 'image') {
            element = new Image();
            const ready = loaded(element, 'load');
            element.src = asset.src;
            await ready;
        }
        else {
            element = document.createElement('video');
            element.muted = true;
            element.playsInline = true;
            element.preload = 'auto';
            const ready = loaded(element, 'loadeddata');
            element.src = asset.src;
            await ready;
        }
        const entry = { ...asset, element, width: element.naturalWidth || element.videoWidth, height: element.naturalHeight || element.videoHeight, duration: element.duration || 0, version: 1 };
        if (entry.width > 8192 || entry.height > 8192)
            throw new Error('Media dimensions exceed 8192 pixels.');
        if (asset.type === 'video') {
            element.addEventListener('seeked', () => {
                entry.version++;
                this.invalidate();
            });
            const frame = () => {
                if (!this.assets.has(entry.id))
                    return;
                entry.version++;
                this.invalidate();
                element.requestVideoFrameCallback?.(frame);
            };
            element.requestVideoFrameCallback?.(frame);
        }
        this.assets.set(entry.id, entry);
        return entry;
    }
    sync(doc, time, playing) {
        const active = new Set();
        for (const l of doc.layers) {
            if (l.type !== 'video')
                continue;
            const a = this.get(l.data.assetId);
            if (!a)
                continue;
            const v = a.element;
            const visible = l.enabled && time >= l.start && time < l.end;
            const local = Math.max(0, Math.min(time - l.start, Math.max(0, (a.duration || 1) - .02)));
            if (visible) {
                active.add(a.id);
                if (!v.seeking && Math.abs(v.currentTime - local) > (playing ? .14 : .5 / doc.fps))
                    v.currentTime = local;
                if (playing && v.paused)
                    v.play().catch(() => {
                    });
                if (!playing && !v.paused)
                    v.pause();
            }
        }
        for (const a of this.assets.values())
            if (a.type === 'video' && !active.has(a.id) && !a.element.paused)
                a.element.pause();
    }
    async seek(doc, time) {
        await Promise.all(doc.layers.filter(l => l.type === 'video' && l.enabled && time >= l.start && time < l.end).map(async (l) => {
            const a = this.get(l.data.assetId);
            if (!a)
                return;
            const v = a.element;
            v.pause();
            const t = Math.min(Math.max(0, time - l.start), Math.max(0, a.duration - .025));
            if (Math.abs(v.currentTime - t) < .001 && v.readyState >= 2)
                return;
            const ready = loaded(v, 'seeked');
            v.currentTime = t;
            await ready;
            a.version++;
        }));
    }
    serialize() {
        return [...this.assets.values()].map(({ id, name, type, mime, src }) => ({ id, name, type, mime, src }));
    }
    clear() {
        for (const a of this.assets.values()) {
            if (a.type === 'video') {
                a.element.pause();
                a.element.removeAttribute('src');
                a.element.load();
            }
        }
        this.assets.clear();
    }
}
export class ProjectStore {
    async open() {
        if (this.db)
            return this.db;
        this.db = await new Promise((res, rej) => {
            const r = indexedDB.open('aether-motion', 1);
            r.onupgradeneeded = () => r.result.createObjectStore('projects');
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
        });
        return this.db;
    }
    async save(document, assets) {
        const db = await this.open();
        return new Promise((res, rej) => {
            const tx = db.transaction('projects', 'readwrite');
            tx.objectStore('projects').put({ document, assets, savedAt: Date.now() }, 'autosave');
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
            tx.onabort = () => rej(tx.error || new Error('Save aborted'));
        });
    }
    async load() {
        const db = await this.open();
        return new Promise((res, rej) => {
            const r = db.transaction('projects').objectStore('projects').get('autosave');
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
        });
    }
}
