# Recorded validation

Date: 6 September 2026.

## Environment

Chromium 144.0.7559.96, Linux x86-64, a headed Playwright browser under Xvfb, and a SwiftShader software Vulkan adapter. WebGPU was active; Canvas 2D fallback was tested separately. No JavaScript page errors or WebGPU validation errors were observed in the recorded suite.

The GPU result is API/rendering conformance evidence, not a hardware-acceleration benchmark. Real desktop GPUs, Safari, Firefox, mobile devices, browser quotas, huge projects and device-loss recovery were not exhaustively qualified.

## Core tests

13 / 13 Node tests passed. The original TAP output is in `unit-tests.tap`. These cover sampling, holds, easing, frame quantization, matrices, parenting and cycles, stack/solo/time filtering, transactional undo/redo, history limits, schema round-trip, invalid inputs, timecodes and EBML construction.

## Browser integration checks

37 / 37 checks passed. Re-run using `tests/browser_integration.py`; the machine-readable recorded results are in `validation-results.json`.

1. WebGPU initialization and WGSL validation.
2. Demo composition has eleven real layers.
3. Text editing updates the document.
4. Undo restores editable text.
5. Animated inspector value inserts a keyframe.
6. Pointer drawing creates sized vector layer.
7. Canvas manipulation changes model coordinates.
8. Two-keyframe opacity animation.
9. Timeline keyframe drag changes key time.
10. Value graph editor is functional.
11. Easing selector changes selected keyframe.
12. Visibility switch removes layer from evaluated scene.
13. Solo isolates selected layer.
14. Image media import.
15. Project file includes media and editable tracks.
16. Project roundtrip loads embedded media.
17. IndexedDB autosave survives reload.
18. PNG export dimensions and pixels.
19. WebM decodes to exact frame count and resolution.
20. WebM duration matches the composition.
21. WebM contains real composition pixels, not a blank canvas.
22. Video import and decoder.
23. Video timeline seeking.
24. GPU premultiplied-alpha readback unpremultiplies correctly.
25. GPU blend reference: normal.
26. GPU blend reference: multiply.
27. GPU blend reference: screen.
28. GPU blend reference: add.
29. GPU blend reference: overlay.
30. GPU blend reference: difference.
31. GPU exposure effect doubles encoded channel values.
32. Ellipse mask clips source alpha.
33. GPU blur spreads beyond source bounds.
34. GPU glow spreads beyond source bounds.
35. No JavaScript or GPU validation errors.
36. Portable single-file build starts.
37. Canvas fallback playback advances the timeline.

## Independent output verification

A 320 × 180 composition was rendered offline at 10 fps for 1.2 seconds. `ffprobe -count_frames` reported VP9, 320 × 180, exactly 12 decoded frames, and duration 1.200000 seconds. `ffmpeg` decoded its first frame and a pixel check verified the orange moving-square geometry rather than a blank frame. The original source archive contains `validated-render.webm` and the corresponding PNG export `validated-frame.png`. Binary evidence is not duplicated in this repository; rerunning the browser suite produces fresh outputs in `test-results/`.

Blend conformance compared Normal, Multiply, Screen, Add, Overlay and Difference against independently calculated pixel values, using a 50% alpha source. GPU premultiplied-alpha readback was tested separately. Soft blur/glow checks verify spread beyond the source bounds, not convergence to an exact Gaussian kernel.

Video import/seek checks establish decoder integration and the absence of an error during seeking. They do not establish frame-exact source decoding. Pixel-reference checks were not run for every transform/effect combination, mask boundary, Unicode font, or source codec.

The screenshot in the original source archive (`docs/preview.png`) was captured from a clean default application context, not assembled or generated as a mockup.
