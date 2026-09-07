/** Dependency-free EBML/WebM muxer for VP8/VP9 VideoEncoder elementary streams.
 * All timestamps are in microseconds until converted to millisecond WebM timecodes.
 * Clusters start on keyframes; Cues contain actual byte positions for seeking. */
const te = new TextEncoder();
const join = parts => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    for (const p of parts) {
        out.set(p, offset);
        offset += p.length;
    }
    return out;
};
function uint(n) {
    if (!Number.isSafeInteger(n) || n < 0)
        throw new Error('Invalid EBML integer');
    let size = 1;
    while (n >= 2 ** (size * 8) && size < 8)
        size++;
    const a = new Uint8Array(size);
    for (let i = size - 1; i >= 0; i--) {
        a[i] = n % 256;
        n = Math.floor(n / 256);
    }
    return a;
}
function vint(n) {
    for (let bytes = 1; bytes <= 8; bytes++) {
        if (n < 2 ** (7 * bytes) - 1) {
            const a = new Uint8Array(bytes);
            for (let i = bytes - 1; i >= 0; i--) {
                a[i] = n % 256;
                n = Math.floor(n / 256);
            }
            a[0] |= 1 << (8 - bytes);
            return a;
        }
    }
    throw new Error('WebM element too large');
}
function elem(id, data) {
    return join([uint(id), vint(data.length), data]);
}
const num = (id, n) => elem(id, uint(n));
const txt = (id, s) => elem(id, te.encode(s));
function float(id, value) {
    const a = new Uint8Array(8);
    new DataView(a.buffer).setFloat64(0, value, false);
    return elem(id, a);
}
export function muxWebM(chunks, { width, height, fps, duration, codec = 'V_VP9' }) {
    const header = elem(0x1a45dfa3, join([num(0x4286, 1), num(0x42f7, 1), num(0x42f2, 4), num(0x42f3, 8), txt(0x4282, 'webm'), num(0x4287, 4), num(0x4285, 2)]));
    const info = elem(0x1549a966, join([num(0x2ad7b1, 1000000), txt(0x4d80, 'Aether Motion'), txt(0x5741, 'Aether Motion 1.0'), float(0x4489, duration * 1000)]));
    const tracks = elem(0x1654ae6b, elem(0xae, join([num(0xd7, 1), num(0x73c5, 1), num(0x83, 1), txt(0x86, codec), num(0x23e383, Math.round(1e9 / fps)), elem(0xe0, join([num(0xb0, width), num(0xba, height)]))])));
    const groups = [];
    let group;
    for (const chunk of chunks) {
        const ms = Math.round(chunk.timestamp / 1000);
        if (!group || (chunk.key && ms - group.time >= 1000) || ms - group.time > 30000) {
            group = { time: ms, blocks: [], key: chunk.key };
            groups.push(group);
        }
        const prefix = new Uint8Array(4), view = new DataView(prefix.buffer);
        prefix[0] = 0x81;
        view.setInt16(1, ms - group.time, false);
        prefix[3] = chunk.key ? 0x80 : 0;
        group.blocks.push(elem(0xa3, join([prefix, chunk.data])));
    }
    const clusters = groups.map(g => elem(0x1f43b675, join([num(0xe7, g.time), ...g.blocks])));
    let offset = info.length + tracks.length;
    const cues = [];
    groups.forEach((g, i) => {
        if (g.key)
            cues.push(elem(0xbb, join([num(0xb3, g.time), elem(0xb7, join([num(0xf7, 1), num(0xf1, offset)]))])));
        offset += clusters[i].length;
    });
    return new Blob([header, elem(0x18538067, join([info, tracks, ...clusters, elem(0x1c53bb6b, join(cues))]))], { type: 'video/webm' });
}
export function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function exportPNG(renderer) {
    const canvas = await renderer.capture();
    return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG encoding failed')), 'image/png'));
}
export async function encodeComposition({ doc, renderer, media, evaluate, onProgress = () => {
}, signal }) {
    if (!globalThis.VideoEncoder)
        throw new Error('Offline WebM export requires a browser with the WebCodecs VideoEncoder API. PNG export is still available.');
    const width = Math.round(doc.width / 2) * 2, height = Math.round(doc.height / 2) * 2;
    let config, codec;
    for (const [candidate, id] of [['vp09.00.10.08', 'V_VP9'], ['vp8', 'V_VP8']]) {
        const c = { codec: candidate, width, height, framerate: doc.fps, bitrate: Math.max(1500000, Math.round(width * height * doc.fps * .16)), latencyMode: 'quality' };
        try {
            if ((await VideoEncoder.isConfigSupported(c)).supported) {
                config = c;
                codec = id;
                break;
            }
        }
        catch {
        }
    }
    if (!config)
        throw new Error('This browser does not expose a VP8/VP9 video encoder.');
    let error = null, totalBytes = 0;
    const chunks = [];
    const encoder = new VideoEncoder({ output: chunk => {
            const data = new Uint8Array(chunk.byteLength);
            chunk.copyTo(data);
            totalBytes += data.length;
            if (totalBytes > 512 * 1024 * 1024) {
                error = new Error('Export exceeded the 512 MB in-memory limit.');
                return;
            }
            chunks.push({ data, timestamp: chunk.timestamp, key: chunk.type === 'key' });
        }, error: e => {
            error = e;
        } });
    encoder.configure(config);
    const count = Math.ceil(doc.duration * doc.fps), renderDoc = { ...doc, width, height };
    try {
        for (let f = 0; f < count; f++) {
            if (signal?.aborted)
                throw new DOMException('Export cancelled', 'AbortError');
            if (error)
                throw error;
            while (encoder.encodeQueueSize > 3) {
                await new Promise(r => setTimeout(r, 4));
                if (error)
                    throw error;
                if (signal?.aborted)
                    throw new DOMException('Export cancelled', 'AbortError');
            }
            const t = f / doc.fps;
            await media.seek(doc, t);
            renderer.render(renderDoc, evaluate(doc, t), 1);
            await renderer.flush();
            // Read the owned compositing target, not the transient WebGPU swapchain.
            // Its external reference may expire across await / compositor boundaries.
            const source = renderer.kind === 'WebGPU' ? await renderer.capture() : renderer.canvas;
            const frame = new VideoFrame(source, { timestamp: Math.round(f * 1e6 / doc.fps), duration: Math.round(1e6 / doc.fps) });
            try {
                encoder.encode(frame, { keyFrame: f % (doc.fps * 2) === 0 });
            }
            finally {
                frame.close();
            }
            onProgress((f + 1) / count, f + 1, count);
            if (f % 2 === 0)
                await new Promise(r => setTimeout(r, 0));
        }
        await encoder.flush();
        if (error)
            throw error;
    }
    finally {
        if (encoder.state !== 'closed')
            encoder.close();
    }
    return muxWebM(chunks, { width, height, fps: doc.fps, duration: count / doc.fps, codec });
}
