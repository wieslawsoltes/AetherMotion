# Aether Motion

**An independent, local-first 2D motion-design editor built with plain HTML, CSS, JavaScript, and WebGPU.**

A working application, not a screenshot mockup: edit the supplied eleven-layer brand animation, draw and transform layers, animate properties, import media, save editable projects, and render PNG or silent WebM output. The panel layout and keyboard conventions are inspired by After Effects; the code, branding, artwork, and icons are original to this implementation.

This first release is a substantial 2D editor foundation, **not feature parity with Adobe After Effects**. The limitations below are part of its delivery contract.

[Open Aether Motion](https://wieslawsoltes.github.io/AetherMotion/) · [Standalone HTML](https://wieslawsoltes.github.io/AetherMotion/AetherMotion.html) · [Build and deployment](https://github.com/wieslawsoltes/AetherMotion/actions/workflows/pages.yml)

## Run

Requires Node.js 20 or later for the included development server. There are no runtime packages to install.

```sh
git clone https://github.com/wieslawsoltes/AetherMotion.git
cd AetherMotion
npm start
```

Open **http://localhost:4173**. The supplied demo opens at 00:00:02:12; press Space to preview it, or select any layer and start editing.

Run `npm run build` to generate `AetherMotion.html`, the complete portable build, with all JavaScript, CSS, and icons embedded. Opening the file directly can run the fallback editor, but localhost or HTTPS is the recommended route for consistent WebGPU, WebCodecs, and browser-storage availability. Browser capability and adapter availability determine the active backend. The UI shows the backend actually in use; it never labels Canvas 2D as WebGPU.

To explicitly exercise the fallback, open:

```text
http://localhost:4173/?renderer=canvas
http://localhost:4173/AetherMotion.html?renderer=canvas
```

## Implemented editing

| Area | Working features |
|---|---|
| Workspace | Project/media panel; composition viewer; properties; effect controls; presets; timeline; value graph; workspace presets; resizable panels; command palette |
| Layers | Text, rectangles, ellipses, solids, polygon paths, images, videos, nulls, and procedural visual elements; rename, duplicate, delete, reorder, lock, visibility, solo, parent |
| Canvas tools | Selection, move, scale, rotate, anchor manipulation, pan, zoom, shape drawing, polygon drawing, text insertion, guides and transparency preview |
| Typography | Editable multiline text, system font selection, size, weight, alignment, color, tracking, line-height; browser-native rasterization |
| Animation | Thirteen animatable numeric properties; frame-quantized keys; linear, smooth ease, ease-in, ease-out and hold; keyframe dragging; value/time graph editing; fade, slide, pulse and spin presets |
| Timeline | Scrubbing; frame stepping; loop preview; layer time movement and in/out trimming; work-area bounds; markers; time snapping; search and zoom |
| Compositing | Normal, Multiply, Screen, Add, Overlay, Difference; layer opacity; ellipse and rounded-rectangle source masks |
| Effects | GPU soft blur, glow, exposure, saturation and hue rotation; effect properties can be keyframed |
| Media | Local image import, including SVG decoded as an image; browser-decodable video; muted preview and timeline seeking |
| Persistence | Undo/redo transactions; IndexedDB autosave; versioned `.aether` project files with embedded media |
| Output | Full-composition-resolution PNG with alpha; offline silent VP9/VP8 WebM with explicit frame timestamps, progress and cancellation |

A selected animated property updates or inserts the key at the current frame. Enabling a property's stopwatch creates its initial key. The graph editor modifies key times and values, not just a decorative curve. Easing applies to the outgoing segment of the selected key. The pen tool creates polygon vertices; Enter finishes the path and Escape cancels it.

The work area bounds preview playback. WebM export currently renders the **entire composition duration**, not only the work area. Source-video playback is silent. The render-queue affordance opens the render dialog; it is not a persistent multi-job scheduler.

## Useful shortcuts

| Operation | Shortcut |
|---|---|
| Play / pause | Space |
| Select / hand / zoom / rotate / anchor / shape / pen | V / H / Z / W / Y / Q / G |
| Position / scale / rotation / opacity / animated properties | P / S / R / T / U |
| Add keyframe / easy ease / graph | K / F9 / Shift+F3 |
| Previous / next frame | Page Up / Page Down |
| Work-area start / end | B / N |
| Undo / redo | Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z |
| Duplicate / import / save / export | Ctrl/Cmd+D / I / S / M |
| Command palette | Ctrl/Cmd+K |
| Move selected layer | Arrow keys; Shift for larger increments |

Text and numeric fields retain normal keyboard editing rather than executing these shortcuts while typing. The in-app Help menu contains the shortcut reference.

## Engine structure

```text
index.html              semantic application shell
src/style.css           theme tokens, panel layout and editor controls
src/core.js             document schema, animation, matrices, validation, history
src/raster.js           browser text/shape rasterization and procedural sources
src/shaders.js          WGSL compositing, color and sampling effects
src/renderer.js         WebGPU render graph, GPU readback and Canvas 2D fallback
src/media.js            local asset decoding, seeking and IndexedDB persistence
src/export.js           offline WebCodecs encoding and dependency-free WebM muxer
src/app.js              interaction controller, panels, tools and transport
server.mjs              dependency-free local server
build.mjs               static distribution and portable HTML builder
examples/               editable example project
```

The document is serializable data, separate from DOM elements, decoder state and GPU resources. Animation evaluation is a pure function of the document and time. Cached source pixels are independent of most animated transform/color values. Adjacent normal-blend layers share a render pass; destination-dependent blends use two owned render targets and explicit copies. Uniform records occupy 96 bytes with 256-byte dynamic-offset slots.

Text and vector sources are rasterized with browser Canvas 2D before upload. The compositor, transformed quads, color effects, soft blur/glow and blend calculations are genuinely WebGPU operations. The iridescent torus in the demo is a procedurally generated, cached source image—not a 3D camera or mesh subsystem.

See [ARCHITECTURE.md](ARCHITECTURE.md) for coordinate conventions, alpha equations, resource lifetime, export design, and extension seams.

## Build and test

```sh
npm test         # 13 deterministic Node core / container tests
npm run build    # dist/ static site + AetherMotion.html
```

The build uses only Node's standard library. No framework, bundler dependency, network font, stock image, analytics script, cloud API, or remote asset is required at runtime.

The included browser integration suite additionally requires Python, Playwright, Pillow, a Chromium browser, `ffmpeg`, and `ffprobe`. With the server running:

```sh
python -m pip install playwright pillow
python -m playwright install chromium
python tests/browser_integration.py
```

Optional environment variables:

```text
AETHER_BASE_URL       defaults to http://127.0.0.1:4173
AETHER_CHROMIUM       explicit Chromium executable path
AETHER_TEST_OUTPUT    output directory; defaults to ./test-results
AETHER_HEADLESS       1 enables headless; default is a visible test browser
AETHER_SOFTWARE_GPU   1 requests SwiftShader/Vulkan for GPU API conformance testing
```

In an Xvfb/Linux environment with a compatible SwiftShader installation, the browser suite can be launched under `xvfb-run -a`. Software WebGPU configurations are platform-specific; the test does not modify browser policies or system security settings.

**Recorded pre-publication validation:** all 13 Node tests and 37 browser checks passed. The Pages workflow reruns the core tests and validates the build and HTTP delivery; it does not rerun the full browser suite. Browser checks cover actual pointer and keyboard editing, keyframes, undo, project round-trip, media, autosave, the portable build, Canvas fallback, six blend equations against pixel references, masks, effects, PNG alpha, and independently decoded WebM output. Chromium 144 on Linux with **software Vulkan/SwiftShader** was used. This validates API behavior and rendering correctness in that environment, not hardware-GPU throughput or universal browser compatibility. See [docs/VALIDATION.md](docs/VALIDATION.md) and its machine-readable report.

## Static deployment

The application is published at **https://wieslawsoltes.github.io/AetherMotion/**. The GitHub Actions workflow in `.github/workflows/pages.yml` runs the Node tests, checks JavaScript syntax, builds the application, and deploys on pushes to `main`. Pull requests run the test/build stage without deploying. Manual runs are available through `workflow_dispatch`.

The published artifact includes the modular application, `AetherMotion.html`, the editable `examples/Orbit-Brand-Film.aether` project, and a `deployment.json` record containing the source commit. The deployment job verifies the served files against the build with SHA-256 hashes and checks HTML/JavaScript/CSS MIME types. A failed verification fails the workflow rather than silently reporting success.

For another static host, run `npm run build` and upload the **contents of `dist/`**. Relative asset paths support repository subpaths. The Pages workflow additionally stages the standalone HTML and example project; copy those into `dist/` as needed for an equivalent manual deployment.

The included server is a local development convenience, not a hardened public application server. Serve the generated static files through an established HTTPS host for public use.

## Limits and explicit non-goals of this release

There is no `.aep` import/export, Adobe plugin compatibility, expression interpreter, 3D cameras/lights, nested compositions, motion tracking, roto tools, audio mixer or audio export, collaborative editing, persistent multi-job rendering, arbitrary Bézier path editor, professional color management, or HDR/linear-light pipeline. Custom cubic Bézier easing is available in the pure evaluator but the editor and serialized schema currently expose named easing modes only.

Rendering uses **8-bit RGBA and sRGB-like, display-referred arithmetic**. Exposure/saturation/hue are artistic effects on encoded channels, not a color-managed grading pipeline. Blur and glow use finite shader sampling approximations; the Canvas fallback has approximate effect parity and is not expected to match the GPU backend pixel for pixel. Local system fonts can change text metrics across operating systems.

Generated animation evaluates deterministically at frame timestamps. Imported video uses `HTMLVideoElement` seeking, **not** an indexed demuxer plus frame-exact `VideoDecoder`; exact source-frame identity is therefore not guaranteed. Multiple uses of the same video asset share a decoder and are not suitable for independent simultaneous source offsets. Animated image formats import as browser-decoded image sources rather than independently timed footage.

Practical guards include 300 layers, 64–4096 pixels per composition dimension, 1–120 integer fps, up to 600 seconds, 80 MiB per imported asset, 8192-pixel media dimensions, 220 MiB project files, a 128 MiB estimated CPU raster cache, and a 512 MiB accumulated encoded-chunk cap. History uses at most 80 undo snapshots with an estimated 32 MiB undo-payload budget; that estimate is not a whole-process memory limit. GPU textures are cached with stale-source eviction, not a strict VRAM budget. Data URLs, decoder allocations, export readback and WebM assembly can temporarily consume additional memory.

GPU uniform capacity is 512 layers, while project validation admits 300. When embedding the renderer directly, validate documents and respect those limits. Individual source rasters are capped at 2048 pixels on their longest dimension; 4K composition export does not make cached source rasters infinitely sharp. WebM dimensions are rounded to even values and a nonintegral duration is rounded up to a whole number of frames. PNG preserves alpha; the WebM export does not provide a transparent-video delivery contract.

Parent transforms are affine, with cycle rejection. Reparenting attempts to preserve the current appearance using translation/rotation/scale decomposition; combinations that require shear cannot be represented exactly by the editable TRS fields. There is no automatic bake of the full animation when changing parents. Selection is single-layer and hit testing is primarily geometric bounds, not arbitrary per-pixel alpha.

Autosave uses browser storage and can be unavailable, quota-limited, or cleared externally. Export `.aether` files for durable copies. Importing large untrusted media still invokes browser decoders; field validation is not a formal security audit. Multi-tab autosave conflict resolution is not implemented.

## References and license

Platform contracts: [WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API), [VideoEncoder](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder), [WebCodecs codec configuration](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder/isConfigSupported_static).

MIT license. Aether Motion is independent software and is not affiliated with or endorsed by Adobe. “After Effects” is referenced only to describe the requested workflow inspiration.
