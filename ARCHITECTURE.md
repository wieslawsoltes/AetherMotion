# Aether Motion engine architecture

## 1. Document and evaluated scene

The authoritative project document contains dimensions, integer frame rate, duration, work-area bounds, markers, and a top-to-bottom layer array. Media bytes are stored separately in the project envelope, and layers refer to an asset ID. Decoder elements, GPU resources, editor selection, pointer-capture state, panel dimensions and cache bookkeeping never enter the document model.

Each layer has translation, percent scale, degrees of rotation, percentage anchor coordinates, opacity, an optional parent ID, in/out times, blend mode, keyed properties and source data. Coordinates are composition pixels with positive X to the right and positive Y downward. A 50/50 anchor denotes the center of the untransformed layer box. The affine matrix layout is `[a, b, c, d, tx, ty]`:

```text
x' = a*x + c*y + tx
y' = b*x + d*y + ty
```

The local matrix is translation × rotation × scale × negative-anchor translation. Parent matrices multiply on the left. Child coordinates are expressed in the parent's local pixel space. Parent opacity does not automatically multiply child opacity, and parent visibility does not suppress children. Parenting supplies transforms, not a group-compositing operation.

`evaluate(document, time)` binary-searches each keyed property, resolves parent matrices with per-evaluation memoization and cycle detection, applies visibility/solo/in-out filtering, and reverses the top-first model stack into painter order. Evaluation does not mutate the project. Layer out-points are exclusive. A property without keys falls back to its static value; before its first key or after its last key it holds that endpoint value.

Keys are quantized by `round(time * fps) / fps`; editing an existing frame changes that key rather than adding a duplicate. The named easing stored on a key determines its outgoing segment. `ease` is smoothstep, `ease-in/out` are cubic curves, and `hold` jumps at the next key. The pure `ease()` function also accepts a four-control-value cubic Bézier representation, but imported project tracks whitelist the named modes.

### Minimal model example

```js
import {
  blankDocument, layer, setKey, evaluate, validateDocument
} from './src/core.js';

const project = blankDocument();
project.name = 'Animated title';
project.duration = project.workOut = 4;

const title = layer('text', {
  name: 'Headline',
  end: 4,
  x: 960,
  y: 540,
  width: 1200,
  height: 240,
  data: {
    text: 'MAKE IT MOVE.',
    color: '#ffffff',
    fontFamily: 'Arial',
    fontWeight: 800,
    fontSize: 140,
    align: 'center',
    lineHeight: 1.05
  }
});

setKey(title, 'y', 0, 690, project.fps, 'ease-out');
setKey(title, 'y', 1, 540, project.fps, 'linear');
setKey(title, 'opacity', 0, 0, project.fps, 'ease');
setKey(title, 'opacity', 0.7, 100, project.fps, 'linear');
project.layers.push(title);

const validated = validateDocument(project);
const scene = evaluate(validated, 0.5);
// renderer.render(validated, scene, 1) renders at composition resolution.
```

## 2. Edit transactions

Pointer-down begins a snapshot transaction; pointer moves update live document values and invalidate the view; pointer-up commits one undo entry. A numeric/character edit is similarly coalesced, so undo follows editing intent rather than pointer event frequency. Unchanged transactions do not enter history. Media is an independent library; snapshots retain references by ID rather than copying embedded bytes for every gesture.

History is bounded by snapshot count and an estimated serialized undo-payload size. It is not structural sharing, a persistent rope, a CRDT or an operation-log database. The current snapshot design is intentionally easy to inspect and test. For very large documents, a next step is command-based patches with asset-lifetime reachability shared by current, undo and redo roots. Multi-tab collaboration would also require stable operation IDs and a storage conflict protocol.

## 3. Source rasterization

`RasterCache` produces padded source canvases for text, shapes, paths, imported images, decoder frames and procedural elements. Browser text shaping and rasterization are intentionally reused instead of implementing a font engine. Layer source data and dimensions contribute to the cache key. Changes to position, rotation, scale, opacity or color-effect values do not ordinarily rerasterize source pixels. Blur/glow extents affect padding and therefore can invalidate the raster.

Video revisions increment when decoder frames arrive or seeking completes. The compositor uploads changed sources with `copyExternalImageToTexture`; unchanged source textures are reused. The demo torus is generated once by CPU ray marching and reused as a texture. It is an original procedural source, not evidence of a 3D scene kernel.

The CPU cache uses estimated RGBA byte counts with LRU eviction. GPU textures have their own lifetime and evict after a source goes unused for 120 rendered frames. Framebuffer resize destroys and recreates both composition targets and invalidates target-dependent bind groups. Explicit renderer disposal destroys owned textures, uniforms, dummy resources and the device. Stale-source eviction is not viewport culling or a hard VRAM allocator.

## 4. WebGPU rendering

The compositor owns two RGBA8 render textures. Their usage includes render attachment, sampled texture, copy source and copy destination. The presentation canvas is a separate destination using the browser's preferred canvas format.

Each evaluated layer supplies six `vec4f` fields (96 bytes) in a uniform arena. Dynamic bind offsets use 256-byte slots; the arena reserves 512 entries. One bulk buffer write supplies per-frame layer data. Every layer is a six-vertex quad generated from `vertex_index`; there is no per-layer vertex-buffer upload. The vertex shader maps the padded local box through the evaluated affine transform and into normalized device coordinates. Preview quality changes framebuffer resolution, not document coordinates.

For normal blend mode, premultiplied-alpha source-over blending occurs in fixed-function output blending. Multiple consecutive normal layers stay in the same render pass. For a destination-reading mode:

```text
end current pass
copy front target to back target
render the layer quad into back, sampling front as the backdrop
swap front/back
resume normal rendering into the new front
```

The copy preserves pixels outside the layer quad. No pass samples the texture it is simultaneously writing. A final fullscreen triangle presents the selected owned target to the swapchain. The composition rendering path submits one command buffer per frame. Export and thumbnail readback add their own copy submissions.

### Alpha and blend equations

Textures and framebuffer colors are premultiplied. For a sampled source `s` and backdrop `b`, the blend shader obtains straight channels only for the blend function and uses guarded alpha divisors. With `Cs` and `Cb` the straight colors and `B` the selected separable blend:

```text
Ao = As + Ab*(1-As)
Co = (1-As)*Cb_premul + (1-Ab)*Cs_premul + As*Ab*B(Cb,Cs)
```

`B` implements Multiply, Screen, clamped Add, Overlay and Difference. The tests compare output against independent numerical reference values with nontrivial source alpha. GPU readback unpremultiplies channels before constructing `ImageData`, preserving PNG output alpha.

These are display-referred 8-bit channel operations, not linear-light color science. Exposure multiplies encoded channels by `2^exposure`; saturation interpolates around a luma estimate; hue uses RGB-axis rotation. Blur/glow use finite directional sampling, not a separable Gaussian convolution or an exact physical bloom model. Moving to float textures, explicit transfer functions and a color-space-aware effect graph requires corresponding format, blend and output-contract changes.

## 5. Scheduling and metrics

A requestAnimationFrame loop advances a frame-quantized playhead during preview and submits rendering when invalidated. Idle editing does not continuously rerender the composition. The UI timeline and inspector share the authoritative document; renderer output is never written back into editing state.

An export-state guard prevents the playback/render loop from resizing or overwriting targets during a full-resolution render. GPU readback snapshots width and height before awaiting mapping; asynchronous thumbnail capture cannot reinterpret a resized framebuffer using newer dimensions.

The status bar reports measured CPU-side render submission time, layer count, pass count, estimated source texture bytes and active backend. It does not report GPU timestamp queries, end-to-end frame latency, or a promised device frame rate. Software-adapter validation cannot establish hardware performance. CPU-side rasterization, decoder work and GPU submission are separate optimization targets.

## 6. Media, persistence and export

Media import uses file data URLs and local browser decoders. JSON import whitelists document fields, caps dimensions/counts, rejects parent cycles and restricts embedded sources to image/video data URLs. SVG is an image source, not injected markup. There is no script/expression execution in project loading. These guards reduce accidental allocations and obvious unsafe fields; they do not replace a security audit of all browser codecs.

IndexedDB stores the current project envelope after edits. Explicit `.aether` downloads contain schema version, the editable document and the media library. Source footage remains embedded, so large projects incur data-URL overhead. Autosave is one last-writer-wins project per origin and is not a revision database.

Offline export probes `VideoEncoder.isConfigSupported` for VP9 then VP8. For each composition frame it evaluates at `frameIndex / fps`, waits for media seeks, renders at quality 1, and captures the owned GPU target. It constructs a `VideoFrame` with explicit microsecond timestamp/duration, requests periodic keyframes, bounds the encode queue, collects encoded chunks, and closes each frame promptly. GPU export deliberately uses an explicit readback canvas rather than a transient swapchain external-image reference; this trades transfer cost for stable resource lifetime across async boundaries. It is not a zero-copy export path.

A dependency-free EBML writer emits WebM header, Segment Info, Tracks, timestamped SimpleBlocks, keyframe-aligned Clusters and Cues with actual byte positions. It stores all encoded chunks in memory and assembles the final Blob; a 512 MiB chunk cap is not an exact peak-memory cap. Progress and cancellation operate between frames and queue waits. Export has no audio track and does not expose alpha-video encoding.

Generated keyframes and output timestamps are deterministic. Source-video seeking is not frame-exact; `HTMLVideoElement` is not a substitute for a demuxer, an indexed decode timeline and a per-instance decoded-frame cache. Duplicate uses of one footage asset share a decoder. A future production source pipeline should distinguish an immutable asset, one or more independently timed footage instances, a decoder scheduler and reference-counted `VideoFrame` ownership.

## 7. Extension boundaries

A new layer source belongs in `RasterCache`, together with model validation, UI source-data editing and tests. An animatable numeric property must appear in the model property list, validation, inspector/graph mapping and effect/transform consumption. A new destination-dependent blend can extend the WGSL switch and fallback mapping, with a numerical pixel-reference test.

Nested compositions should not be bolted onto parenting: they need explicit composition assets, dependency-cycle validation, recursive offscreen rendering, and cache invalidation across dependency edges. Expressions require a defined deterministic evaluator and sandbox, never `eval()` on project text. Audio requires its own sample-accurate transport and offline mixing pipeline. A 3D subsystem would require cameras, geometry, materials, depth targets and transparent ordering, rather than treating existing sprite rotation as 3D.

For a larger editor, move source preparation and offline encoding behind worker protocols, adopt patch-based history, add render-target pooling with a strict VRAM budget, virtualize long timeline tracks, and expose a public document-command API instead of the current diagnostic `window.aether` bridge. The delivered bridge is useful for inspection/tests; it is not a versioned plugin contract.
