import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleTrack, ease, setKey, layer, blankDocument, demoDocument, evaluate, History, validateDocument, mul, invert, point, canParent, timecode } from '../src/core.js';
import { muxWebM } from '../src/export.js';
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
test('interpolation clamps endpoints and linearly interpolates', () => {
    const k = [{ t: 1, v: 10, ease: 'linear' }, { t: 3, v: 30 }];
    assert.equal(sampleTrack(k, 0, 0), 10);
    assert.equal(sampleTrack(k, 4, 0), 30);
    assert.equal(sampleTrack(k, 2, 0), 20);
    assert.equal(sampleTrack([], 2, 4), 4);
});
test('hold transitions exactly at the next keyframe', () => {
    const k = [{ t: 0, v: 0, ease: 'hold' }, { t: 1, v: 100 }];
    assert.equal(sampleTrack(k, .999, 0), 0);
    assert.equal(sampleTrack(k, 1, 0), 100);
});
test('smoothstep and cubic-bezier interpolation', () => {
    close(ease(.5, 'ease'), .5);
    close(ease(.5, [.42, 0, .58, 1]), .5);
    assert.equal(ease(0, 'ease-in'), 0);
    assert.equal(ease(1, 'ease-out'), 1);
});
test('keyframes quantize and update without duplicate frame times', () => {
    const l = layer('rect');
    setKey(l, 'x', .1001, 2, 30);
    setKey(l, 'x', .099, 4, 30);
    assert.equal(l.tracks.x.length, 1);
    assert.equal(l.tracks.x[0].t, .1);
    assert.equal(l.tracks.x[0].v, 4);
});
test('affine inverse roundtrip', () => {
    const a = [1.2, .3, -.5, 2, 600, -321], q = point(a, 42, -13), p = point(invert(a), q.x, q.y);
    close(p.x, 42);
    close(p.y, -13);
    const m = mul(a, invert(a));
    [1, 0, 0, 1, 0, 0].forEach((v, i) => close(m[i], v));
    assert.equal(invert([0, 0, 0, 0, 0, 0]), null);
});
test('parent transforms compose and cycles are rejected', () => {
    const d = blankDocument(), p = layer('null', { x: 100, y: 200, anchorX: 0, anchorY: 0 }), c = layer('rect', { x: 10, y: 20, parent: p.id, anchorX: 0, anchorY: 0 });
    d.layers = [c, p];
    const out = evaluate(d, 0).find(l => l.id === c.id);
    close(out.matrix[4], 110);
    close(out.matrix[5], 220);
    assert.equal(canParent(d, p.id, c.id), false);
    assert.equal(canParent(d, c.id, p.id), true);
    p.parent = c.id;
    assert.throws(() => evaluate(d, 0), /cycle/);
});
test('layer order, solo, visibility and exclusive out-points', () => {
    const d = blankDocument(), a = layer('rect'), b = layer('text');
    d.layers = [a, b];
    assert.deepEqual(evaluate(d, 0).map(l => l.id), [b.id, a.id]);
    a.solo = true;
    assert.deepEqual(evaluate(d, 0).map(l => l.id), [a.id]);
    a.end = 1;
    assert.equal(evaluate(d, 1).length, 0);
});
test('transaction history coalesces all drag writes and supports redo', () => {
    const h = new History(), d = blankDocument();
    h.begin(d, 'Drag');
    for (let i = 0; i < 100; i++)
        d.name = 'Step ' + i;
    h.commit(d);
    assert.equal(h.past.length, 1);
    const old = h.undo(d);
    assert.equal(old.name, 'Untitled composition');
    const next = h.redo(old);
    assert.equal(next.name, 'Step 99');
    h.begin(next, 'No change');
    assert.equal(h.commit(next), false);
});
test('history respects count and memory bounds', () => {
    const h = new History(3, 100000), d = blankDocument();
    for (let i = 0; i < 10; i++) {
        h.begin(d, 'change');
        d.name = 'n' + i;
        h.commit(d);
    }
    assert.equal(h.past.length, 3);
});
test('project roundtrip preserves demo, animation and schema', () => {
    const d = demoDocument(), round = validateDocument(JSON.parse(JSON.stringify(d)));
    assert.equal(round.layers.length, 11);
    assert.equal(round.layers.find(l => l.type === 'text').data.fontFamily, 'Arial');
    assert.equal(round.layers[2].tracks.y.length, 4);
    assert.equal(evaluate(round, 2.4).length, 11);
});
test('untrusted project validation rejects cycles and clamps allocations', () => {
    const d = blankDocument();
    d.width = 1e12;
    d.height = NaN;
    d.layers = [layer('rect')];
    const out = validateDocument(d);
    assert.equal(out.width, 4096);
    assert.equal(out.height, 1080);
    const cycle = blankDocument();
    cycle.layers = [layer('rect')];
    cycle.layers[0].parent = cycle.layers[0].id;
    assert.throws(() => validateDocument(cycle), /cyclic/);
    assert.throws(() => validateDocument({ version: 2, layers: [] }), /version/);
});
test('timecode uses integer frames', () => {
    assert.equal(timecode(2.4, 30), '00:00:02:12');
    assert.equal(timecode(60, 30), '00:01:00:00');
    assert.equal(timecode(1 / 30, 30), '00:00:00:01');
});
test('WebM muxer writes EBML, track codec, clusters and cues', async () => {
    const blob = muxWebM([{ data: new Uint8Array([1, 2, 3]), timestamp: 0, key: true }, { data: new Uint8Array([4]), timestamp: 33333, key: false }], { width: 320, height: 180, fps: 30, duration: 2 / 30 });
    assert.equal(blob.type, 'video/webm');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 4)], [0x1a, 0x45, 0xdf, 0xa3]);
    const text = new TextDecoder().decode(bytes);
    assert.ok(text.includes('webm'));
    assert.ok(text.includes('V_VP9'));
    assert.ok(text.includes('Aether Motion'));
});
