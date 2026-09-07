import { VERSION, clamp, clone, uid, PROPS, PROP_NAMES, EASINGS, layer, blankDocument, demoDocument, evaluate, getEvaluated, hitTest, setKey, sampleTrack, History, validateDocument, timecode, invert, point, mul, canParent } from './core.js';
import { RasterCache } from './raster.js';
import { createRenderer, CanvasRenderer } from './renderer.js';
import { MediaLibrary, ProjectStore } from './media.js';
import { download, exportPNG, encodeComposition } from './export.js';
const $ = (s, root = document) => root.querySelector(s), $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICONS = {
    'select': 'M5 3v16l4-5 4 6 3-2-4-6 6-1Z', 'hand': 'M8 11V6a1.5 1.5 0 0 1 3 0v4-6a1.5 1.5 0 0 1 3 0v6-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v7c0 5-3 7-7 7-3 0-5-2-6-4l-3-5c-1-2 1-3 2-2l2 2', 'zoom': 'M16 16l5 5M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14M7 10h6M10 7v6', 'rotate': 'M4 9a8 8 0 1 1 1 8M4 3v6h6', 'anchor': 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3', 'rect': 'M4 4h16v16H4Z', 'ellipse': 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0', 'pen': 'm4 20 3-12 9-5 5 5-5 9-12 3M4 20l7-7M16 3l5 5M13 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4', 'text': 'M4 5V3h16v2M12 3v18M8 21h8', 'undo': 'M8 5 3 10l5 5M3 10h10a7 7 0 0 1 7 7', 'redo': 'M16 5l5 5-5 5M21 10H11a7 7 0 0 0-7 7', 'magnet': 'M6 4v9a6 6 0 0 0 12 0V4h-4v9a2 2 0 0 1-4 0V4ZM6 8h4M14 8h4', 'help': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01', 'export': 'M12 15V3M8 7l4-4 4 4M5 13v7h14v-7', 'import': 'M12 3v12M8 11l4 4 4-4M4 16v5h16v-5', 'search': 'M17 17l4 4M10 17a7 7 0 1 1 0-14 7 7 0 0 1 0 14', 'more': 'M5 12h.1M12 12h.1M19 12h.1', 'composition': 'M3 4h18v16H3ZM3 8h18M7 4v4M12 4v4M17 4v4M8 11l7 3-7 3Z', 'settings': 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'checker': 'M3 3h18v18H3ZM3 9h18M3 15h18M9 3v18M15 3v18', 'safe': 'M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M7 7h10v10H7Z', 'grid': 'M3 3h18v18H3ZM3 11h18M11 3v18', 'camera': 'M3 7h5l2-3h4l2 3h5v13H3ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0', 'maximize': 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5', 'first': 'M4 5v14M18 5l-9 7 9 7Z', 'prev': 'M17 5 6 12l11 7Z', 'play': 'M7 4v16l13-8Z', 'pause': 'M7 4h3v16H7ZM15 4h3v16h-3Z', 'next': 'm7 5 11 7-11 7Z', 'last': 'M20 5v14M6 5l9 7-9 7Z', 'loop': 'M19 7H7a4 4 0 0 0-4 4M16 4l3 3-3 3M5 17h12a4 4 0 0 0 4-4M8 14l-3 3 3 3', 'queue': 'M3 5h18v15H3ZM7 9h3M7 13h3M14 9l4 3-4 3Z', 'marker': 'M6 3h12v18l-6-4-6 4Z', 'eye': 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'solo': 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0', 'lock': 'M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8 0v4', 'plus': 'M12 4v16M4 12h16', 'minus': 'M4 12h16', 'keyframe': 'M7 4h10M12 4v3M19 14a7 7 0 1 1-14 0 7 7 0 0 1 14 0M12 10v4l3 2', 'diamond': 'm12 4 8 8-8 8-8-8Z', 'diamond-plus': 'm9 4 7 8-7 8-7-8ZM18 3v6M15 6h6', 'graph': 'M3 3v18h18M5 17c6 0 6-12 15-12', 'folder': 'M3 5h7l2 3h9v12H3Z', 'folder-plus': 'M3 5h7l2 3h9v12H3ZM12 11v6M9 14h6', 'chevron': 'm8 5 7 7-7 7', 'down': 'm5 8 7 7 7-7', 'image': 'M3 3h18v18H3ZM3 17l6-6 5 5 3-3 4 4M17 7h.1', 'video': 'M3 4h18v16H3ZM9 8l7 4-7 4Z', 'effect': 'm12 2 2.7 6.5 7 .7-5.3 4.6 1.5 7-5.9-3.7-5.9 3.7 1.5-7L2.3 9.2l7-.7Z', 'sparkles': 'm12 3 2 6 6 2-6 2-2 6-2-6-6-2 6-2ZM20 17v5M17.5 19.5h5', 'reset': 'M4 9a8 8 0 1 1 1 8M4 3v6h6', 'link': 'm9 15 6-6M8 16l-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 0-6-6L8 4a4 4 0 0 0 0 6', 'trash': 'M4 6h16M8 6V3h8v3M6 6l1 15h10l1-15M10 10v7M14 10v7', 'duplicate': 'M8 8h13v13H8ZM3 16V3h13', 'save': 'M4 3h14l3 3v15H3V3ZM7 3v6h10V3M7 21v-8h10v8', 'new': 'M5 3h9l5 5v13H5ZM14 3v5h5M9 14h6M12 11v6', 'check': 'm4 12 5 5L20 6', 'close': 'm5 5 14 14M5 19 19 5', 'glow': 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2M12 20v2M2 12h2M20 12h2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2', 'color': 'M21 12A9 9 0 1 0 12 21h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h5a3 3 0 0 0 3-1ZM7 8h.1M12 6h.1M17 8h.1M6 13h.1', 'null': 'M4 4h16v16H4ZM4 4l16 16M4 20 20 4'
};
function icon(name, cls = '') {
    return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] ?? ICONS.effect}"/></svg>`;
}
function fillIcons(root = document) {
    $$('[data-icon]', root).forEach(el => {
        el.innerHTML = icon(el.dataset.icon);
        el.removeAttribute('data-icon');
    });
}
const root = document.documentElement, app = $('#app'), viewport = $('#viewport'), overlay = $('#overlay'), stage = $('#stage-box'), modal = $('#modal'), menu = $('#menu-popover');
let doc = demoDocument(), renderer, media = new MediaLibrary(() => invalidate()), raster = new RasterCache(media), history = new History(), store = new ProjectStore();
const state = { time: 2.4, playing: false, loop: true, tool: 'select', selected: doc.layers[2].id, prop: 'y', key: null, expanded: new Map([[doc.layers[2].id, ['y', 'opacity']]]), quality: .5, zoom: 'fit', panX: 0, panY: 0, fit: 1, scale: .5, snap: true, autoKey: false, linkedScale: true, guides: false, grid: false, checker: false, graph: false, timelineZoom: 1, trackWidth: 900, leftTab: 'project', rightTab: 'properties', dirty: true, exporting: false, pen: [], assetSearch: '', layerSearch: '', ready: false };
let drag = null, saveTimer, toastTimer, playStart = 0, playTime = 0, lastFrame = -1, lastPreview = 0, lastStats = 0, metrics = { frames: 0, start: performance.now() }, graphBounds = null;
function selected() {
    return doc.layers.find(l => l.id === state.selected);
}
function selectedEval() {
    return state.selected ? getEvaluated(doc, state.selected, state.time) : null;
}
function toast(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').classList.add('show');
    toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3400);
}
function invalidate() {
    state.dirty = true;
}
function begin(label) {
    history.begin(doc, label);
}
function commit(refresh = true) {
    if (history.commit(doc)) {
        scheduleSave();
    }
    invalidate();
    if (refresh)
        renderUI();
}
function mutate(label, fn) {
    if (state.exporting)
        return;
    begin(label);
    fn();
    commit();
}
function scheduleSave() {
    clearTimeout(saveTimer);
    $('#save-status').textContent = 'Saving…';
    saveTimer = setTimeout(async () => {
        try {
            await store.save(clone(doc), media.serialize());
            $('#save-status').textContent = 'Saved on this device';
        }
        catch (e) {
            $('#save-status').textContent = 'Autosave unavailable';
            toast(`Autosave failed: ${e.message}. Save a project file to keep your work.`);
        }
    }, 650);
}
function setTime(t, refresh = false) {
    state.time = clamp(Math.round(t * doc.fps) / doc.fps, 0, Math.max(0, doc.duration - 1 / doc.fps));
    lastFrame = -1;
    invalidate();
    updateDynamic();
    if (refresh)
        renderInspector();
}
function pause() {
    state.playing = false;
    $$('[data-action="play"]').forEach(b => b.innerHTML = icon('play'));
    media.sync(doc, state.time, false);
}
function togglePlay() {
    if (state.exporting)
        return;
    if (state.playing) {
        pause();
        return;
    }
    if (state.time >= doc.workOut - 1 / doc.fps || state.time < doc.workIn)
        state.time = doc.workIn;
    state.playing = true;
    playStart = performance.now();
    playTime = state.time;
    metrics = { frames: 0, start: playStart };
    $$('[data-action="play"]').forEach(b => b.innerHTML = icon('pause'));
}
function setSelection(id, refresh = true) {
    state.selected = id;
    state.key = null;
    if (refresh)
        renderUI();
    invalidate();
}
function updateProp(prop, value, l = selected()) {
    if (!l || l.locked || !Number.isFinite(value))
        return;
    if (['opacity', 'anchorX', 'anchorY'].includes(prop))
        value = clamp(value, 0, 100);
    if (['blur', 'glow'].includes(prop))
        value = clamp(value, 0, 100);
    if (prop === 'exposure')
        value = clamp(value, -8, 8);
    if (prop === 'saturation')
        value = clamp(value, 0, 300);
    if (l.tracks[prop]?.length || state.autoKey)
        setKey(l, prop, state.time, value, doc.fps);
    else
        l[prop] = value;
    invalidate();
}
const menus = {
    File: [['New composition', 'new', 'Ctrl N'], ['Open project…', 'open', 'Ctrl O'], ['Save project…', 'save', 'Ctrl S'], null, ['Import media…', 'import', 'Ctrl I'], ['Export composition…', 'export', 'Ctrl M'], ['Save frame as PNG', 'snapshot', ''], null, ['Open demo project', 'demo', '']],
    Edit: [['Undo', 'undo', 'Ctrl Z'], ['Redo', 'redo', 'Ctrl Shift Z'], null, ['Duplicate layer', 'duplicate', 'Ctrl D'], ['Delete layer / keyframe', 'delete', 'Delete'], ['Rename layer', 'rename', 'Enter'], null, ['Command palette', 'palette', 'Ctrl K']],
    Composition: [['Composition settings…', 'composition', 'Ctrl Shift K'], ['Preview / stop', 'play', 'Space'], ['Set work area start', 'work-in', 'B'], ['Set work area end', 'work-out', 'N'], ['Add marker', 'add-marker', '*'], null, ['Export composition…', 'export', 'Ctrl M']],
    Layer: [['New text', 'add-text', ''], ['New rectangle', 'add-rect', ''], ['New ellipse', 'add-ellipse', ''], ['New solid', 'add-solid', ''], ['New chromatic orbit', 'add-torus', ''], ['New null object', 'add-null', ''], null, ['Duplicate', 'duplicate', 'Ctrl D'], ['Move up', 'layer-up', 'Ctrl ]'], ['Move down', 'layer-down', 'Ctrl ['], ['Delete', 'delete', 'Delete']],
    Effect: [['Glow', 'fx-glow', ''], ['Soft Blur', 'fx-blur', ''], ['Exposure', 'fx-exposure', ''], ['Hue / Saturation', 'fx-saturation', ''], null, ['Reset all effects', 'reset-effects', '']],
    Animation: [['Add keyframe', 'keyframe', 'K'], ['Easy ease', 'ease', 'F9'], ['Linear interpolation', 'linear', ''], ['Hold interpolation', 'hold', ''], ['Graph editor', 'graph', 'Shift F3'], null, ['Fade in', 'preset-fade', ''], ['Slide up', 'preset-slide', ''], ['Pulse', 'preset-pulse', '']],
    View: [['Fit composition', 'fit', 'Shift /'], ['Title / action safe', 'guides', ''], ['Composition grid', 'grid', ''], ['Transparency grid', 'transparency', ''], ['Maximize viewer', 'fullscreen', '`'], null, ['Show animated properties', 'expand-animated', 'U']],
    Help: [['Keyboard shortcuts', 'shortcuts', '?'], ['About Aether Motion', 'about', '']]
};
const allCommands = Object.entries(menus).flatMap(([category, items]) => items.filter(Boolean).map(([name, action, key]) => ({ name, action, key, category }))).filter((v, i, a) => a.findIndex(x => x.action === v.action) === i);
function initShell() {
    $('#menubar').innerHTML = Object.keys(menus).map(name => `<button data-menu="${name}">${name}</button>`).join('');
    $('#tools').innerHTML = [['select', 'Selection tool (V)'], ['hand', 'Hand tool (H)'], ['zoom', 'Zoom tool (Z)'], ['rotate', 'Rotation tool (W)'], ['anchor', 'Anchor point tool (Y)'], ['rect', 'Rectangle tool (Q)'], ['ellipse', 'Ellipse tool'], ['pen', 'Pen tool (G) · Enter to finish'], ['text', 'Text tool']].map(([tool, title]) => `<button class="toolbar-button ${state.tool === tool ? 'active' : ''}" data-tool="${tool}" title="${title}" aria-label="${title}">${icon(tool)}</button>`).join('');
    fillIcons();
    $('#snap-button').classList.toggle('active', state.snap);
}
function renderUI() {
    const name = doc.name;
    for (const id of ['document-name', 'comp-tab-name', 'comp-crumb', 'timeline-tab-name'])
        $('#' + id).textContent = name;
    document.title = `${doc.name} — Aether Motion`;
    $('#comp-dimensions').textContent = `${doc.width} × ${doc.height}`;
    $('#preview-fps').textContent = `${doc.fps} fps`;
    $('#layer-count').textContent = `${doc.layers.length} layer${doc.layers.length === 1 ? '' : 's'}`;
    $('#timeline-duration').textContent = `${doc.duration.toFixed(2)} seconds`;
    renderProject();
    renderInspector();
    renderTimeline();
    renderPresets();
    updateDynamic();
    fitStage();
    $$('[data-action="undo"]').forEach(b => b.disabled = !history.past.length);
    $$('[data-action="redo"]').forEach(b => b.disabled = !history.future.length);
}
function renderProject() {
    const assets = [...media.assets.values()].filter(a => a.name.toLowerCase().includes(state.assetSearch.toLowerCase()));
    $('#project-content').innerHTML = `<div class="project-preview"><div class="project-thumbnail"><canvas id="mini-preview" width="180" height="102"></canvas></div><div class="project-meta"><strong>${esc(doc.name)}</strong>${doc.width} × ${doc.height} <span class="muted">(1.00)</span><br>${timecode(doc.duration, doc.fps)} · ${doc.fps}.00 fps</div></div><label class="project-search">${icon('search')}<input id="asset-search" placeholder="Search project" value="${esc(state.assetSearch)}" aria-label="Search project assets"></label><div class="project-list-head"><span>Name</span><span>Type</span></div><div class="project-item selected" data-action="composition">${icon('composition')}<span class="item-name">${esc(doc.name)}</span><span class="item-type">Comp</span></div><div class="project-item folder-row">${icon('down')}${icon('folder')}<span>Design elements</span><span class="item-type">2</span></div><div class="project-item indent" data-action="add-torus">${icon('ellipse')}<span class="item-name">Chromatic orbit</span><span class="item-type">Shape</span></div><div class="project-item indent" data-action="add-glow">${icon('glow')}<span class="item-name">Ambient light</span><span class="item-type">Shape</span></div><div class="project-item folder-row">${icon('down')}${icon('folder')}<span>Media</span><span class="item-type">${media.assets.size}</span></div>${assets.map(a => `<div class="project-item indent" draggable="true" data-asset="${a.id}" title="Double-click to add to the composition">${icon(a.type)}<span class="item-name">${esc(a.name)}</span><span class="item-type">${a.type === 'video' ? 'Video' : 'Image'}</span></div>`).join('')}<div class="import-card" data-action="import">${icon('import')}<div><strong>Bring your ideas in</strong><span>Drop footage, images, or SVG files</span></div></div><p class="project-hint"><span>Made for your next big idea.</span><br>Your project stays on this device.<br>No account. No uploads. Just create.</p>`;
    $('#project-content').hidden = state.leftTab !== 'project';
    $('#effect-content').hidden = state.leftTab !== 'effects';
    $('#asset-count').textContent = `${media.assets.size} media · 1 composition`;
    requestAnimationFrame(updateMini);
}
function layerIcon(l) {
    return l.type === 'text' ? 'T' : icon(({ torus: 'ellipse', solid: 'rect', grid: 'grid', glow: 'glow', rings: 'ellipse', path: 'pen', null: 'null' })[l.type] ?? l.type);
}
function propRow(l, e, p, label = PROP_NAMES[p]) {
    const keys = l.tracks[p], active = keys?.length, at = keys?.some(k => Math.abs(k.t - state.time) < .5 / doc.fps);
    return `<div class="property-row"><button class="key-toggle ${active ? 'active' : ''} ${at ? 'at-key' : ''}" data-keyprop="${p}" title="Toggle animation for ${label}">${icon('keyframe')}</button><label for="prop-${p}">${label}</label><input id="prop-${p}" data-prop="${p}" type="number" value="${format(e[p])}" step="${['scaleX', 'scaleY', 'opacity'].includes(p) ? 1 : .1}" ${l.locked ? 'disabled' : ''} aria-label="${label}"></div>`;
}
function format(v) {
    return Number.isFinite(v) ? Number(v.toFixed(2)) : 0;
}
function section(title, body, extra = '') {
    return `<section class="property-section"><div class="section-title">${icon('down')}${title}<span class="spacer"></span>${extra}</div>${body}</section>`;
}
function renderInspector() {
    const l = selected(), e = selectedEval();
    let html = '';
    if (!l) {
        html = `<div class="no-selection">${icon('select')}<br>Select a layer to shape its motion.<br><span class="muted">Or add something new to the canvas.</span></div>${section('Composition', `<div class="empty-stat"><span>Resolution</span><span>${doc.width} × ${doc.height}</span></div><div class="empty-stat"><span>Frame rate</span><span>${doc.fps} fps</span></div><div class="empty-stat"><span>Duration</span><span>${doc.duration} seconds</span></div><button class="effect-item" data-action="composition">${icon('settings')}Composition settings</button><button class="effect-item" data-action="add-text">${icon('text')}Add text</button><button class="effect-item" data-action="import">${icon('import')}Import media</button>`)}`;
    }
    else {
        html = `<div class="inspector-title"><div class="layer-type-chip">${layerIcon(l)}</div><div class="inspector-title-text"><strong>${esc(l.name)}</strong><small>${l.type === 'text' ? 'Text layer' : l.type === 'torus' ? 'Procedural artwork' : l.type + ' layer'}${l.locked ? ' · Locked' : ''}</small></div><span class="spacer"></span><button title="Rename layer" data-action="rename">${icon('more')}</button></div>`;
        html += section('Transform', ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity'].map(p => propRow(l, e, p)).join(''), `<button data-action="link-scale" title="${state.linkedScale ? 'Unlink' : 'Link'} scale" class="${state.linkedScale ? 'active' : ''}">${icon('link')}</button><button data-action="reset-transform" title="Reset transform">${icon('reset')}</button>`);
        if (l.type === 'text')
            html += section('Character', `<textarea class="text-editor" data-data="text" aria-label="Text content" ${l.locked ? 'disabled' : ''}>${esc(l.data.text)}</textarea><div class="font-fields"><select data-data="fontFamily" aria-label="Font family">${['Arial', 'Georgia', 'Courier New', 'Verdana', 'Trebuchet MS', 'Times New Roman'].map(f => `<option ${f === l.data.fontFamily ? 'selected' : ''}>${f}</option>`).join('')}</select><input data-data="fontSize" type="number" value="${l.data.fontSize}" min="6" max="600" aria-label="Font size"></div><div class="property-row wide"><label>Weight</label><select data-data="fontWeight">${[400, 500, 600, 700, 800, 900].map(w => `<option value="${w}" ${w === l.data.fontWeight ? 'selected' : ''}>${w === 400 ? 'Regular' : w === 700 ? 'Bold' : w === 800 ? 'Extra bold' : w === 900 ? 'Black' : w}</option>`).join('')}</select></div><div class="property-row wide"><label>Alignment</label><select data-data="align">${['left', 'center', 'right'].map(a => `<option ${a === l.data.align ? 'selected' : ''}>${a}</option>`).join('')}</select></div><div class="property-row wide"><label>Tracking</label><input data-data="tracking" type="number" value="${l.data.tracking ?? 0}" step=".5"></div><div class="property-row wide"><label>Line height</label><input data-data="lineHeight" type="number" value="${l.data.lineHeight ?? 1.06}" min=".5" max="3" step=".05"></div>`);
        html += section('Appearance', `<div class="property-row wide"><label>Fill color</label><input type="color" data-data="color" aria-label="Layer fill color" value="${l.data.color ?? '#c0a2ff'}"></div><div class="property-row wide"><label>Blend mode</label><select data-field="blend" aria-label="Blend mode">${Object.keys({ normal: 0, multiply: 1, screen: 2, add: 3, overlay: 4, difference: 5 }).map(b => `<option value="${b}" ${l.blend === b ? 'selected' : ''}>${b[0].toUpperCase() + b.slice(1)}</option>`).join('')}</select></div>${['rect', 'ellipse', 'path'].includes(l.type) ? `<div class="property-row wide"><label>Stroke</label><input type="color" data-data="stroke" value="${l.data.stroke ?? '#ffffff'}"></div><div class="property-row wide"><label>Stroke width</label><input type="number" data-data="strokeWidth" min="0" max="100" value="${l.data.strokeWidth ?? 0}"></div>` : ''}${l.type === 'rect' ? `<div class="property-row wide"><label>Corner radius</label><input type="number" data-data="roundness" min="0" max="500" value="${l.data.roundness ?? 28}"></div>` : ''}`);
        html += section('Effects', ['blur', 'glow', 'exposure', 'saturation', 'hue'].map(p => propRow(l, e, p)).join(''), `<button data-action="reset-effects" title="Reset effects">${icon('reset')}</button>`);
        html += section('Layer & geometry', `<div class="property-row wide"><label>Width</label><input type="number" data-field="width" value="${format(l.width)}" min="1" max="4096"></div><div class="property-row wide"><label>Height</label><input type="number" data-field="height" value="${format(l.height)}" min="1" max="4096"></div>${['anchorX', 'anchorY'].map(p => propRow(l, e, p)).join('')}<div class="property-row wide"><label>Parent</label><select data-field="parent"><option value="">None</option>${doc.layers.filter(a => a.id !== l.id && canParent(doc, l.id, a.id)).map(a => `<option value="${a.id}" ${a.id === l.parent ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div><div class="property-row wide"><label>Mask</label><select data-data="mask">${['none', 'ellipse', 'rounded'].map(a => `<option ${a === (l.data.mask ?? 'none') ? 'selected' : ''}>${a}</option>`).join('')}</select></div>`);
    }
    $('#inspector-content').innerHTML = html;
    $('#inspector-content').hidden = state.rightTab !== 'properties';
    $('#presets-content').hidden = state.rightTab !== 'presets';
    $('#effect-content').innerHTML = l ? `<div class="effect-applied"><strong>${esc(l.name)}</strong><br>Effects are evaluated after rasterization and before compositing.</div>${section('Effect stack', ['blur', 'glow', 'exposure', 'saturation', 'hue'].map(p => propRow(l, e, p)).join(''))}<p class="project-hint">Use the stopwatch to animate an effect.<br>Values are editable at the current frame.</p>` : `<div class="no-selection">Select a layer to edit its effects.</div>`;
}
function renderPresets() {
    $('#presets-content').innerHTML = `<p class="presets-title">Make a little magic.<br>Apply an effect or animate the selected layer.</p><label class="effect-search">${icon('search')}<input id="effect-search" placeholder="Search effects & presets" aria-label="Search effects and presets"></label><div class="effects-list"><div class="effects-category">${icon('down')}${icon('folder')}Animation presets</div>${[['Fade in', 'preset-fade', 'Opacity'], ['Slide up', 'preset-slide', 'Position'], ['Pulse', 'preset-pulse', 'Scale'], ['Slow spin', 'preset-spin', 'Rotation']].map(([n, a, t]) => `<button class="effect-item" data-action="${a}">${icon('sparkles')}<span>${n}</span><small>${t}</small></button>`).join('')}<div class="effects-category">${icon('down')}${icon('folder')}Blur & stylize</div>${[['Soft Blur', 'fx-blur', 'blur'], ['Glow', 'fx-glow', 'glow']].map(([n, a, i]) => `<button class="effect-item" data-action="${a}">${icon(i === 'blur' ? 'effect' : 'glow')}<span>${n}</span><small>GPU</small></button>`).join('')}<div class="effects-category">${icon('down')}${icon('folder')}Color correction</div>${[['Exposure', 'fx-exposure'], ['Hue / Saturation', 'fx-saturation']].map(([n, a]) => `<button class="effect-item" data-action="${a}">${icon('color')}<span>${n}</span><small>GPU</small></button>`).join('')}<div class="effects-category">${icon('down')}${icon('folder')}Generate</div><button class="effect-item" data-action="add-torus">${icon('ellipse')}Chromatic orbit<small>Shape</small></button><button class="effect-item" data-action="add-glow">${icon('glow')}Ambient light<small>Shape</small></button></div>`;
}
function renderTimeline() {
    const container = $('#timeline-scroll'), oldScroll = container.scrollTop, oldX = container.scrollLeft;
    const labelw = parseFloat(getComputedStyle(root).getPropertyValue('--labelw')), available = Math.max(400, container.clientWidth - labelw);
    state.trackWidth = Math.round(available * state.timelineZoom);
    root.style.setProperty('--trackwidth', state.trackWidth + 'px');
    root.style.setProperty('--tick', (state.trackWidth / doc.duration) + 'px');
    const step = state.trackWidth / doc.duration < 35 ? 2 : 1;
    let ticks = '';
    for (let t = 0; t <= doc.duration; t += step)
        ticks += `<span class="ruler-tick" style="left:${t / doc.duration * 100}%">${String(Math.floor(t / 60)).padStart(1, '0')}:${String(t % 60).padStart(2, '0')}</span>`;
    $('#ruler').innerHTML = ticks + doc.markers.map(m => `<span class="marker-flag" title="${esc(m.name)}" style="left:${m.t / doc.duration * 100}%"></span>`).join('') + `<div class="work-area" style="left:${doc.workIn / doc.duration * 100}%;width:${(doc.workOut - doc.workIn) / doc.duration * 100}%"><span class="work-handle in" data-work-handle="in"></span><span class="work-handle out" data-work-handle="out"></span></div><div class="playhead-head"></div>`;
    let html = '';
    doc.layers.forEach((l, index) => {
        if (state.layerSearch && !l.name.toLowerCase().includes(state.layerSearch.toLowerCase()))
            return;
        const exp = state.expanded.get(l.id), times = [...new Set(Object.values(l.tracks).flat().map(k => k.t))];
        html += `<div class="timeline-row ${state.selected === l.id ? 'selected' : ''}" data-layer-row="${l.id}"><div class="layer-label" data-layer="${l.id}" draggable="true"><button class="layer-toggle ${l.enabled ? '' : 'off'}" data-layer-toggle="enabled" data-id="${l.id}" title="${l.enabled ? 'Hide' : 'Show'} layer">${icon('eye')}</button><button class="layer-toggle ${l.solo ? 'solo-active' : 'off'}" data-layer-toggle="solo" data-id="${l.id}" title="Solo layer">${icon('solo')}</button><button class="layer-toggle ${l.locked ? 'locked' : 'off'}" data-layer-toggle="locked" data-id="${l.id}" title="${l.locked ? 'Unlock' : 'Lock'} layer">${icon('lock')}</button><span class="layer-index">${index + 1}</span><i class="layer-swatch" style="background:${l.label}"></i><button class="expand-layer" data-expand="${l.id}" title="Expand layer properties">${icon(exp ? 'down' : 'chevron')}</button><span class="layer-type-icon">${layerIcon(l)}</span><span class="layer-name" title="${esc(l.name)}">${esc(l.name)}</span><button class="layer-mode" data-cycle-blend="${l.id}" title="Change blend mode">${l.blend}</button></div><div class="track" data-track-layer="${l.id}"><div class="layer-bar" data-bar="${l.id}" style="left:${l.start / doc.duration * 100}%;width:${(l.end - l.start) / doc.duration * 100}%;background:${l.label}88;border-color:${l.label}99"><span class="bar-handle start" data-trim="start"></span>${esc(l.name)}<span class="bar-handle end" data-trim="end"></span></div>${times.map(t => `<span class="key summary-key" style="left:${t / doc.duration * 100}%"></span>`).join('')}</div></div>`;
        if (exp)
            for (const p of exp) {
                const keys = l.tracks[p] ?? [];
                html += `<div class="timeline-row property" data-property-layer="${l.id}"><div class="layer-label property-label ${state.selected === l.id && state.prop === p ? 'active-property' : ''}" data-select-prop="${p}" data-id="${l.id}"><button data-keyprop="${p}" data-id="${l.id}" title="Toggle animation">${icon('keyframe')}</button><span class="prop-name">${PROP_NAMES[p]}</span><span class="property-value" data-value-layer="${l.id}" data-value-prop="${p}">${format(sampleTrack(keys, state.time, l[p]))}</span><button data-add-key="${p}" data-id="${l.id}" title="Add keyframe here">${icon('diamond')}</button></div><div class="track" data-track-prop="${p}" data-track-layer="${l.id}">${keys.map(k => `<span class="key ${state.key === k.id ? 'selected' : ''} ${typeof k.ease === 'string' ? k.ease : ''}" data-key="${k.id}" data-id="${l.id}" data-prop="${p}" style="left:${k.t / doc.duration * 100}%" title="${PROP_NAMES[p]}: ${format(k.v)} at ${timecode(k.t, doc.fps)} (${k.ease})"></span>`).join('')}</div></div>`;
            }
    });
    $('#timeline-rows').innerHTML = html || `<div class="no-selection">${state.layerSearch ? 'No matching layers.' : 'Your composition is ready. Add text, a shape, or import media.'}</div>`;
    container.scrollTop = oldScroll;
    container.scrollLeft = oldX;
    syncTimelineScroll();
    $('#graph-wrap').hidden = !state.graph;
    $('#graph-button').classList.toggle('active', state.graph);
    updateDynamic();
    if (state.graph)
        requestAnimationFrame(drawGraph);
}
function syncTimelineScroll() {
    $('#ruler').style.transform = `translateX(${-$('#timeline-scroll').scrollLeft}px)`;
}
function updateDynamic() {
    const tc = timecode(state.time, doc.fps);
    $('#current-time').textContent = tc;
    $('#viewer-time').textContent = tc;
    $('#current-frame').innerHTML = `${String(Math.round(state.time * doc.fps)).padStart(5, '0')} <span>(${doc.fps.toFixed(2)} fps)</span>`;
    root.style.setProperty('--playhead', (state.time / doc.duration * state.trackWidth) + 'px');
    const l = selected(), e = l ? getEvaluated(doc, l.id, state.time) : null;
    if (e) {
        $$('input[data-prop]').forEach(input => {
            if (document.activeElement !== input)
                input.value = format(e[input.dataset.prop]);
        });
        $$('[data-keyprop]').forEach(b => {
            const target = doc.layers.find(a => a.id === (b.dataset.id ?? l.id)), track = target?.tracks[b.dataset.keyprop];
            b.classList.toggle('active', !!track?.length);
            b.classList.toggle('at-key', !!track?.some(k => Math.abs(k.t - state.time) < .5 / doc.fps));
        });
    }
    $$('[data-value-layer]').forEach(el => {
        const a = doc.layers.find(l => l.id === el.dataset.valueLayer), p = el.dataset.valueProp;
        if (a)
            el.textContent = format(sampleTrack(a.tracks[p], state.time, a[p]));
    });
    if (state.graph)
        drawGraph();
}
function fitStage() {
    const w = viewport.clientWidth - 52, h = viewport.clientHeight - 42;
    state.fit = Math.max(.04, Math.min(w / doc.width, h / doc.height));
    state.scale = state.zoom === 'fit' ? state.fit : Number(state.zoom);
    stage.style.width = doc.width * state.scale + 'px';
    stage.style.height = doc.height * state.scale + 'px';
    stage.style.transform = `translate(${state.panX}px,${state.panY}px)`;
    stage.classList.toggle('checker', state.checker);
    overlay.setAttribute('viewBox', `0 0 ${doc.width} ${doc.height}`);
    drawOverlay();
}
function drawOverlay() {
    let out = '';
    const W = doc.width, H = doc.height;
    if (state.grid)
        for (let x = 0; x <= W; x += W / 12)
            out += `<path class="grid-line" d="M${x} 0V${H}"/>`;
    if (state.grid)
        for (let y = 0; y <= H; y += H / 8)
            out += `<path class="grid-line" d="M0 ${y}H${W}"/>`;
    if (state.guides)
        out += `<rect class="guide-line" x="${W * .05}" y="${H * .05}" width="${W * .9}" height="${H * .9}"/><rect class="guide-line" x="${W * .1}" y="${H * .1}" width="${W * .8}" height="${H * .8}"/><path class="guide-line" d="M${W / 2 - 12} ${H / 2}h24M${W / 2} ${H / 2 - 12}v24"/>`;
    const l = selectedEval();
    if (l && !state.playing && !state.exporting && state.time >= l.start && state.time < l.end && l.enabled) {
        const pts = [[0, 0], [l.width, 0], [l.width, l.height], [0, l.height]].map(([x, y]) => point(l.matrix, x, y));
        const anchor = point(l.matrix, l.width * l.anchorX / 100, l.height * l.anchorY / 100), size = 5 / state.scale;
        if (!l.locked) {
            out += `<polygon class="selection-outline" points="${pts.map(p => `${p.x},${p.y}`).join(' ')}"/>`;
            pts.forEach((p, i) => out += `<rect class="handle" data-handle="${i}" x="${p.x - size / 2}" y="${p.y - size / 2}" width="${size}" height="${size}"/>`);
            const top = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }, dx = top.x - anchor.x, dy = top.y - anchor.y, len = Math.hypot(dx, dy) || 1, rot = { x: top.x + dx / len * 22 / state.scale, y: top.y + dy / len * 22 / state.scale };
            out += `<path class="selection-outline" d="M${top.x} ${top.y}L${rot.x} ${rot.y}"/><circle class="handle rotation-handle" data-handle="rotate" cx="${rot.x}" cy="${rot.y}" r="${3 / state.scale}"/><circle class="anchor-cross" fill="#15101c" cx="${anchor.x}" cy="${anchor.y}" r="${3 / state.scale}"/><path class="anchor-cross" d="M${anchor.x - 7 / state.scale} ${anchor.y}h${14 / state.scale}M${anchor.x} ${anchor.y - 7 / state.scale}v${14 / state.scale}"/>`;
        }
    }
    if (state.pen.length) {
        out += `<polyline class="selection-outline" points="${state.pen.map(p => p.x + ',' + p.y).join(' ')}"/>`;
        for (const p of state.pen)
            out += `<circle fill="#c9adf7" cx="${p.x}" cy="${p.y}" r="${3 / state.scale}"/>`;
    }
    overlay.innerHTML = out;
}
let miniPending = false;
async function updateMini() {
    if (!renderer || !$('#mini-preview') || miniPending || state.exporting)
        return;
    miniPending = true;
    try {
        const image = renderer.kind === 'WebGPU' ? await renderer.capture() : renderer.canvas;
        const c = $('#mini-preview');
        if (c) {
            const ctx = c.getContext('2d');
            ctx.clearRect(0, 0, c.width, c.height);
            ctx.drawImage(image, 0, 0, c.width, c.height);
        }
    }
    catch {
    }
    finally {
        miniPending = false;
    }
}
function drawGraph() {
    if (!state.graph)
        return;
    const c = $('#graph-canvas'), rect = c.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    if (!rect.width || !rect.height)
        return;
    if (c.width !== Math.round(rect.width * dpr) || c.height !== Math.round(rect.height * dpr)) {
        c.width = Math.round(rect.width * dpr);
        c.height = Math.round(rect.height * dpr);
    }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);
    const l = selected(), p = state.prop, keys = l?.tracks[p] ?? [];
    $('#graph-label').textContent = `${PROP_NAMES[p]} · value graph`;
    const values = keys.map(k => k.v);
    if (l)
        values.push(l[p]);
    let min = Math.min(...values, 0), max = Math.max(...values, 1);
    const pad = Math.max(10, (max - min) * .18);
    min -= pad;
    max += pad;
    if (drag?.kind === 'graph' && graphBounds) {
        min = graphBounds.min;
        max = graphBounds.max;
    }
    else
        graphBounds = { min, max, w, h };
    const y = v => h - 24 - (v - min) / (max - min) * (h - 53);
    const x = t => (t / doc.duration * state.trackWidth) - $('#timeline-scroll').scrollLeft;
    ctx.lineWidth = 1;
    ctx.font = '9px Arial';
    ctx.strokeStyle = '#63527330';
    ctx.fillStyle = '#86708f';
    for (let i = 0; i <= 4; i++) {
        const v = min + (max - min) * i / 4, Y = y(v);
        ctx.beginPath();
        ctx.moveTo(0, Y);
        ctx.lineTo(w, Y);
        ctx.stroke();
        ctx.fillText(format(v), 7, Y - 4);
    }
    for (let t = 0; t <= doc.duration; t++) {
        ctx.beginPath();
        ctx.moveTo(x(t), 0);
        ctx.lineTo(x(t), h);
        ctx.stroke();
    }
    if (l) {
        ctx.strokeStyle = '#c4a1f2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let px = 0; px <= w; px += 2) {
            const t = (px + $('#timeline-scroll').scrollLeft) / state.trackWidth * doc.duration, v = sampleTrack(keys, t, l[p]);
            if (px === 0)
                ctx.moveTo(px, y(v));
            else
                ctx.lineTo(px, y(v));
        }
        ctx.stroke();
        for (const k of keys) {
            const X = x(k.t), Y = y(k.v);
            ctx.save();
            ctx.translate(X, Y);
            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = state.key === k.id ? '#f2c077' : '#c4a1f2';
            ctx.strokeStyle = '#ead6ff';
            ctx.fillRect(-3, -3, 6, 6);
            ctx.strokeRect(-3, -3, 6, 6);
            ctx.restore();
        }
    }
    ctx.strokeStyle = '#d485a3';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x(state.time), 0);
    ctx.lineTo(x(state.time), h);
    ctx.stroke();
}
function setTool(tool) {
    state.tool = tool;
    state.pen = [];
    $$('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    viewport.classList.toggle('panning', tool === 'hand');
    viewport.classList.toggle('drawing', ['rect', 'ellipse', 'pen', 'text', 'zoom'].includes(tool));
    $('#viewport-note').textContent = tool === 'pen' ? 'Click to add points · Enter to close the path · Esc to cancel' : tool === 'text' ? 'Click the composition to add text' : tool === 'anchor' ? 'Drag the layer to move its anchor point' : '';
    invalidate();
}
function addLayer(type, options = {}) {
    if (doc.layers.length >= 300) {
        toast('The project is limited to 300 layers.');
        return;
    }
    const l = layer(type, { x: doc.width / 2, y: doc.height / 2, end: doc.duration, ...options });
    if (type === 'solid') {
        l.width = doc.width;
        l.height = doc.height;
        l.name = 'Solid / ' + (doc.layers.length + 1);
    }
    if (type === 'text') {
        l.width = doc.width * .6;
        l.height = 160;
        l.data = { ...l.data, text: 'Your next idea.', fontSize: 100, color: '#f4efff' };
    }
    if (type === 'torus') {
        l.width = l.height = Math.min(doc.width, doc.height) * .8;
        l.name = 'Chromatic orbit';
    }
    if (type === 'glow') {
        l.width = doc.width * .8;
        l.height = doc.height * .9;
        l.data.color = '#885bd6';
        l.blend = 'screen';
    }
    if (type === 'null') {
        l.width = l.height = 100;
        l.name = 'Null / controller';
    }
    mutate('Add ' + type, () => {
        doc.layers.unshift(l);
        state.selected = l.id;
    });
    return l;
}
function addAssetLayer(id, position) {
    const a = media.get(id);
    if (!a)
        return;
    const max = Math.min(doc.width * .8 / a.width, doc.height * .8 / a.height, 1), l = layer(a.type, { name: a.name, x: position?.x ?? doc.width / 2, y: position?.y ?? doc.height / 2, width: Math.min(a.width, 4096), height: Math.min(a.height, 4096), scaleX: max * 100, scaleY: max * 100, end: a.type === 'video' ? Math.min(doc.duration, a.duration) : doc.duration, data: { assetId: a.id, color: '#ffffff', mask: 'none' } });
    mutate('Add media layer', () => {
        doc.layers.unshift(l);
        state.selected = l.id;
    });
}
async function importFiles(files, position) {
    pause();
    for (const file of files) {
        try {
            toast(`Importing ${file.name}…`);
            const a = await media.importFile(file);
            addAssetLayer(a.id, position);
        }
        catch (e) {
            toast(e.message);
        }
    }
    scheduleSave();
    renderUI();
}
function toggleAnimation(prop, id = state.selected) {
    const l = doc.layers.find(a => a.id === id);
    if (!l || l.locked)
        return;
    mutate('Toggle ' + PROP_NAMES[prop] + ' animation', () => {
        if (l.tracks[prop]?.length) {
            l[prop] = sampleTrack(l.tracks[prop], state.time, l[prop]);
            delete l.tracks[prop];
        }
        else
            setKey(l, prop, state.time, l[prop], doc.fps);
        state.selected = id;
        state.prop = prop;
        const rows = state.expanded.get(id) ?? [];
        if (!rows.includes(prop))
            state.expanded.set(id, [...rows, prop]);
    });
}
function addKey(prop = state.prop, id = state.selected) {
    const l = doc.layers.find(a => a.id === id);
    if (!l || l.locked) {
        toast('Select an unlocked layer first.');
        return;
    }
    mutate('Add keyframe', () => {
        const value = sampleTrack(l.tracks[prop], state.time, l[prop]);
        setKey(l, prop, state.time, value, doc.fps);
        state.prop = prop;
        const rows = state.expanded.get(id) ?? [];
        if (!rows.includes(prop))
            state.expanded.set(id, [...rows, prop]);
        state.key = l.tracks[prop].find(k => Math.abs(k.t - state.time) < .5 / doc.fps)?.id;
    });
}
function applyEase(mode) {
    const l = selected();
    if (!l)
        return;
    mutate('Set interpolation', () => {
        const keys = l.tracks[state.prop] ?? [];
        if (state.key) {
            const key = keys.find(k => k.id === state.key);
            if (key)
                key.ease = mode;
        }
        else
            for (const key of keys)
                key.ease = mode;
    });
    toast(mode === 'ease' ? 'Easy ease applied.' : `${mode} interpolation applied.`);
}
function applyPreset(kind) {
    const l = selected();
    if (!l || l.locked) {
        toast('Select an unlocked layer first.');
        return;
    }
    mutate('Apply ' + kind + ' preset', () => {
        const t = state.time, end = Math.min(doc.duration, t + 1.2), e = selectedEval();
        const pairs = kind === 'fade' ? [['opacity', 0, 100]] : kind === 'slide' ? [['y', e.y + 100, e.y], ['opacity', 0, 100]] : kind === 'pulse' ? [['scaleX', e.scaleX, e.scaleX * 1.12], ['scaleY', e.scaleY, e.scaleY * 1.12]] : [['rotation', e.rotation, e.rotation + 360]];
        for (const [p, a, b] of pairs) {
            setKey(l, p, t, a, doc.fps, 'ease');
            setKey(l, p, kind === 'spin' ? Math.min(doc.duration, t + 4) : end, b, doc.fps, 'ease');
            if (kind === 'pulse')
                setKey(l, p, Math.min(doc.duration, end + 1.2), a, doc.fps, 'ease');
        }
        state.expanded.set(l.id, pairs.map(a => a[0]));
        state.prop = pairs[0][0];
    });
}
function reparent(l, parent) {
    if (!canParent(doc, l.id, parent))
        return;
    const world = getEvaluated(doc, l.id, state.time).matrix, parentWorld = parent ? getEvaluated(doc, parent, state.time).matrix : [1, 0, 0, 1, 0, 0], inv = invert(parentWorld);
    if (!inv)
        throw new Error('Cannot parent to a zero-scale layer.');
    const local = mul(inv, world), sx = Math.hypot(local[0], local[1]), det = local[0] * local[3] - local[1] * local[2], sy = sx ? det / sx : 0, rotation = Math.atan2(local[1], local[0]) * 180 / Math.PI, anchor = point(local, l.width * l.anchorX / 100, l.height * l.anchorY / 100);
    l.parent = parent;
    updateProp('x', anchor.x, l);
    updateProp('y', anchor.y, l);
    updateProp('scaleX', sx * 100, l);
    updateProp('scaleY', sy * 100, l);
    updateProp('rotation', rotation, l);
    const dot = local[0] * local[2] + local[1] * local[3];
    if (Math.abs(dot) > .001)
        toast('Reparented. Non-uniform rotated parents may introduce shear; this editor uses TRS transforms.');
}
async function dispatch(action) {
    if (state.exporting && !['cancel-export'].includes(action))
        return;
    const l = selected();
    if (action.startsWith('add-') && ['text', 'rect', 'ellipse', 'solid', 'torus', 'null', 'glow'].includes(action.slice(4))) {
        addLayer(action.slice(4));
        return;
    }
    if (action.startsWith('preset-')) {
        applyPreset(action.slice(7));
        return;
    }
    if (action.startsWith('fx-')) {
        if (!l || l.locked) {
            toast('Select an unlocked layer first.');
            return;
        }
        const p = action.slice(3), values = { blur: 12, glow: 24, exposure: .6, saturation: 145 };
        mutate('Apply effect', () => updateProp(p, values[p], l));
        state.rightTab = 'properties';
        switchRightTab('properties');
        toast(`${PROP_NAMES[p]} applied.`);
        return;
    }
    switch (action) {
        case 'new':
            showComposition(true);
            break;
        case 'demo':
            pause();
            begin('Load demo');
            doc = demoDocument();
            state.selected = doc.layers[2].id;
            state.expanded = new Map([[doc.layers[2].id, ['y', 'opacity']]]);
            state.time = 2.4;
            commit();
            toast('Orbit demo loaded. Your media remains in the project.');
            break;
        case 'open':
            $('#project-input').click();
            break;
        case 'save':
            saveProject();
            break;
        case 'import':
            $('#media-input').click();
            break;
        case 'undo':
            pause();
            doc = history.undo(doc);
            if (!doc.layers.some(a => a.id === state.selected))
                state.selected = null;
            state.key = null;
            scheduleSave();
            renderUI();
            invalidate();
            break;
        case 'redo':
            pause();
            doc = history.redo(doc);
            state.key = null;
            scheduleSave();
            renderUI();
            invalidate();
            break;
        case 'duplicate':
            if (l)
                mutate('Duplicate layer', () => {
                    const copy = clone(l);
                    copy.id = uid();
                    copy.name = l.name + ' copy';
                    for (const track of Object.values(copy.tracks))
                        for (const k of track)
                            k.id = uid();
                    copy.x += 25;
                    copy.y += 25;
                    doc.layers.splice(doc.layers.indexOf(l), 0, copy);
                    state.selected = copy.id;
                });
            break;
        case 'delete':
            if (l && !l.locked)
                mutate(state.key ? 'Delete keyframe' : 'Delete layer', () => {
                    if (state.key) {
                        for (const p of PROPS)
                            if (l.tracks[p])
                                l.tracks[p] = l.tracks[p].filter(k => k.id !== state.key);
                        state.key = null;
                    }
                    else {
                        for (const a of doc.layers.filter(a => a.parent === l.id))
                            reparent(a, null);
                        doc.layers = doc.layers.filter(a => a.id !== l.id);
                        state.selected = null;
                    }
                });
            break;
        case 'rename':
            if (l)
                showTextDialog('Rename layer', 'Layer name', l.name, value => mutate('Rename layer', () => l.name = value));
            break;
        case 'layer-up':
        case 'layer-down':
            if (l)
                mutate('Reorder layer', () => {
                    const i = doc.layers.indexOf(l), j = clamp(i + (action === 'layer-up' ? -1 : 1), 0, doc.layers.length - 1);
                    doc.layers.splice(i, 1);
                    doc.layers.splice(j, 0, l);
                });
            break;
        case 'add-layer': {
            const b = $('[data-action="add-layer"]');
            showMenu(menus.Layer, b.getBoundingClientRect());
            break;
        }
        case 'composition':
            showComposition(false);
            break;
        case 'play':
            togglePlay();
            break;
        case 'home':
            pause();
            setTime(0, true);
            break;
        case 'end':
            pause();
            setTime(doc.duration - 1 / doc.fps, true);
            break;
        case 'prev':
            pause();
            setTime(state.time - 1 / doc.fps);
            break;
        case 'next':
            pause();
            setTime(state.time + 1 / doc.fps);
            break;
        case 'goto':
            showTextDialog('Go to time', 'Seconds', String(state.time), value => {
                const t = Number(value);
                if (Number.isFinite(t)) {
                    pause();
                    setTime(t, true);
                }
            });
            break;
        case 'loop':
            state.loop = !state.loop;
            $('#loop-button').classList.toggle('active', state.loop);
            break;
        case 'snap':
            state.snap = !state.snap;
            $('#snap-button').classList.toggle('active', state.snap);
            break;
        case 'autokey':
            state.autoKey = !state.autoKey;
            $('#autokey-button').classList.toggle('active', state.autoKey);
            toast(`Auto-keyframing ${state.autoKey ? 'on' : 'off'}.`);
            break;
        case 'keyframe':
            addKey();
            break;
        case 'ease':
            applyEase('ease');
            break;
        case 'linear':
            applyEase('linear');
            break;
        case 'hold':
            applyEase('hold');
            break;
        case 'graph':
            state.graph = !state.graph;
            renderTimeline();
            break;
        case 'show-timeline':
            state.graph = false;
            renderTimeline();
            break;
        case 'expand-animated':
            if (l) {
                const props = Object.keys(l.tracks).filter(p => l.tracks[p].length);
                state.expanded.set(l.id, props.length ? props : ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity']);
                renderTimeline();
            }
            break;
        case 'link-scale':
            state.linkedScale = !state.linkedScale;
            renderInspector();
            break;
        case 'reset-transform':
            if (l)
                mutate('Reset transform', () => {
                    for (const [p, v] of Object.entries({ x: doc.width / 2, y: doc.height / 2, scaleX: 100, scaleY: 100, rotation: 0, opacity: 100, anchorX: 50, anchorY: 50 })) {
                        delete l.tracks[p];
                        l[p] = v;
                    }
                });
            break;
        case 'reset-effects':
            if (l)
                mutate('Reset effects', () => {
                    for (const p of ['blur', 'glow', 'exposure', 'hue', 'saturation']) {
                        delete l.tracks[p];
                        l[p] = p === 'saturation' ? 100 : 0;
                    }
                });
            break;
        case 'fit':
            state.zoom = 'fit';
            state.panX = state.panY = 0;
            $('#zoom-select').value = 'fit';
            fitStage();
            break;
        case 'guides':
            state.guides = !state.guides;
            $$('[data-action="guides"]').forEach(b => b.classList.toggle('active', state.guides));
            invalidate();
            break;
        case 'grid':
            state.grid = !state.grid;
            $$('[data-action="grid"]').forEach(b => b.classList.toggle('active', state.grid));
            invalidate();
            break;
        case 'transparency':
            state.checker = !state.checker;
            $$('[data-action="transparency"]').forEach(b => b.classList.toggle('active', state.checker));
            fitStage();
            break;
        case 'fullscreen':
            app.classList.toggle('maximized');
            requestAnimationFrame(fitStage);
            break;
        case 'work-in':
            mutate('Set work area', () => doc.workIn = Math.min(state.time, doc.workOut - 1 / doc.fps));
            break;
        case 'work-out':
            mutate('Set work area', () => doc.workOut = Math.max(doc.workIn + 1 / doc.fps, Math.min(doc.duration, state.time + 1 / doc.fps)));
            break;
        case 'add-marker':
            showTextDialog('Add marker', 'Marker label', 'Marker ' + (doc.markers.length + 1), value => mutate('Add marker', () => doc.markers.push({ id: uid(), t: state.time, name: value })));
            break;
        case 'timeline-in':
        case 'timeline-out':
            state.timelineZoom = clamp(state.timelineZoom + (action === 'timeline-in' ? .5 : -.5), 1, 5);
            $('#timeline-zoom').value = state.timelineZoom;
            renderTimeline();
            break;
        case 'snapshot':
            pause();
            state.exporting = true;
            try {
                await media.seek(doc, state.time);
                renderer.render(doc, evaluate(doc, state.time), 1);
                await renderer.flush();
                download(await exportPNG(renderer), `${safeName(doc.name)}-${timecode(state.time, doc.fps).replaceAll(':', '-')}.png`);
                toast('PNG frame rendered at composition resolution.');
            }
            catch (e) {
                toast('PNG export failed: ' + e.message);
            }
            finally {
                state.exporting = false;
                invalidate();
            }
            break;
        case 'export':
            showExport();
            break;
        case 'cancel-export':
            exportAbort?.abort();
            break;
        case 'palette':
            showPalette();
            break;
        case 'shortcuts':
            showShortcuts();
            break;
        case 'about':
            showAbout();
            break;
    }
}
function safeName(s) {
    return s.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-|-$/g, '') || 'composition';
}
function showMenu(items, rect) {
    menu.innerHTML = items.map(item => item ? `<button class="menu-item" data-action="${item[1]}">${esc(item[0])}<span>${esc(item[2] ?? '')}</span></button>` : `<div class="menu-separator"></div>`).join('');
    menu.hidden = false;
    menu.style.left = Math.min(rect.left, innerWidth - 230) + 'px';
    menu.style.top = Math.min(rect.bottom + 3, innerHeight - menu.offsetHeight - 10) + 'px';
}
function closeMenu() {
    menu.hidden = true;
}
function switchRightTab(tab) {
    state.rightTab = tab;
    $$('[data-right-tab]').forEach(b => b.classList.toggle('active', b.dataset.rightTab === tab));
    $('#inspector-content').hidden = tab !== 'properties';
    $('#presets-content').hidden = tab !== 'presets';
}
function openModal(html, onSubmit) {
    pause();
    $('#modal-content').innerHTML = html;
    modal.showModal();
    $('#modal-form').onsubmit = event => {
        if (event.submitter?.value === 'cancel') {
            if (state.exporting) {
                event.preventDefault();
                exportAbort?.abort();
                return;
            }
            return;
        }
        event.preventDefault();
        onSubmit?.(new FormData($('#modal-form')));
    };
}
const modalHead = (title, subtitle = '', glyph = 'settings') => `<div class="modal-head"><div class="modal-logo">${icon(glyph)}</div><div><h2>${title}</h2><p>${subtitle}</p></div><button type="submit" value="cancel" class="modal-close" aria-label="Close">×</button></div>`;
const modalActions = (text = 'Apply') => `<div class="modal-actions"><button type="submit" value="cancel">Cancel</button><button class="primary" type="submit" value="ok">${text}</button></div>`;
function showComposition(isNew) {
    const d = isNew ? blankDocument() : doc;
    openModal(modalHead(isNew ? 'New composition' : 'Composition settings', 'Set the stage for your next idea.', 'composition') + `<div class="modal-body"><div class="modal-row"><label>Name</label><input name="name" value="${esc(d.name)}" required maxlength="256"></div><div class="modal-row"><label>Dimensions</label><div class="two-fields"><input name="width" type="number" value="${d.width}" min="64" max="4096" required><span>×</span><input name="height" type="number" value="${d.height}" min="64" max="4096" required></div></div><div class="modal-row"><label>Frame rate</label><select name="fps">${[24, 25, 30, 50, 60, 120].map(v => `<option value="${v}" ${d.fps === v ? 'selected' : ''}>${v} fps</option>`).join('')}</select></div><div class="modal-row"><label>Duration</label><input name="duration" type="number" value="${d.duration}" min=".1" max="600" step=".1" required><span class="muted">seconds</span></div><div class="modal-row"><label>Background</label><input name="background" type="color" value="${d.background}"></div><div class="modal-row"><label>Transparent</label><input name="transparent" type="checkbox" ${d.transparent ? 'checked' : ''}><span class="muted">Preserve alpha in PNG frames</span></div><p class="modal-note">RGBA8 · sRGB composition. Media and editable project files stay on your device.</p></div>` + modalActions(isNew ? 'Create composition' : 'Apply settings'), data => {
        begin(isNew ? 'New composition' : 'Composition settings');
        const oldDuration = doc.duration;
        if (isNew) {
            doc = blankDocument();
            state.selected = null;
            state.expanded.clear();
            state.time = 0;
        }
        doc.name = String(data.get('name'));
        doc.width = clamp(Math.round(Number(data.get('width'))), 64, 4096);
        doc.height = clamp(Math.round(Number(data.get('height'))), 64, 4096);
        doc.fps = Number(data.get('fps'));
        doc.duration = clamp(Number(data.get('duration')), .1, 600);
        doc.background = data.get('background');
        doc.transparent = data.has('transparent');
        doc.workIn = Math.min(doc.workIn, doc.duration - 1 / doc.fps);
        doc.workOut = doc.duration;
        for (const l of doc.layers) {
            if (l.end === oldDuration)
                l.end = doc.duration;
            l.start = Math.min(l.start, Math.max(0, doc.duration - 1 / doc.fps));
            l.end = clamp(l.end, l.start + 1 / doc.fps, doc.duration);
            for (const p of PROPS)
                if (l.tracks[p]) {
                    const m = new Map();
                    for (const k of l.tracks[p]) {
                        k.t = Math.round(clamp(k.t, 0, doc.duration) * doc.fps) / doc.fps;
                        m.set(k.t, k);
                    }
                    l.tracks[p] = [...m.values()].sort((a, b) => a.t - b.t);
                }
        }
        doc.markers = doc.markers.filter(m => m.t <= doc.duration);
        state.time = clamp(state.time, 0, Math.max(0, doc.duration - 1 / doc.fps));
        modal.close();
        commit();
    });
}
function showTextDialog(title, label, value, done) {
    openModal(modalHead(title, '', 'text') + `<div class="modal-body"><div class="modal-row"><label>${label}</label><input name="value" value="${esc(value)}" required maxlength="256" autofocus></div></div>` + modalActions(), data => {
        modal.close();
        done(String(data.get('value')));
    });
    setTimeout(() => $('input[name="value"]')?.select(), 0);
}
function saveProject() {
    const payload = { format: 'aether-motion', version: VERSION, document: doc, assets: media.serialize() };
    download(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), safeName(doc.name) + '.aether');
    scheduleSave();
    toast('Editable project saved with embedded media.');
}
async function loadProjectFile(file) {
    if (file.size > 220 * 1024 * 1024) {
        toast('Project files are limited to 220 MB.');
        return;
    }
    pause();
    try {
        const payload = JSON.parse(await file.text()), next = validateDocument(payload.document ?? payload);
        if ((payload.assets?.length ?? 0) > 100)
            throw new Error('Too many embedded media assets.');
        const library = new MediaLibrary(() => invalidate());
        for (const a of payload.assets ?? [])
            await library.add(a);
        media.clear();
        media = library;
        raster.media = media;
        raster.clear();
        doc = next;
        history.clear();
        state.selected = doc.layers[0]?.id ?? null;
        state.expanded.clear();
        state.time = 0;
        state.key = null;
        scheduleSave();
        renderUI();
        invalidate();
        toast('Project opened.');
    }
    catch (e) {
        toast('Could not open project: ' + e.message);
    }
}
let exportAbort;
function showExport() {
    openModal(modalHead('Render your next big idea.', 'From your timeline to the world.', 'export') + `<div class="modal-body"><div class="export-stats"><div class="export-stat"><strong>${doc.width} × ${doc.height}</strong><span>Resolution</span></div><div class="export-stat"><strong>${doc.fps} fps</strong><span>Frame rate</span></div><div class="export-stat"><strong>${doc.duration.toFixed(1)}s</strong><span>Duration</span></div></div><div class="modal-row"><label>Format</label><select name="format"><option value="webm">WebM video · VP9 / VP8</option><option value="png">PNG image · current frame</option><option value="project">Aether project · editable</option></select></div><div class="modal-row"><label>File name</label><input name="filename" value="${esc(safeName(doc.name))}" required></div><p class="modal-note">WebM uses an offline WebCodecs render: every frame has an explicit timestamp. Video export is silent; PNG preserves composition alpha. Large renders use in-memory encoding (512 MB cap).</p><div id="export-progress" hidden><div class="progress-track"><div class="progress-fill" id="export-fill" style="width:0%"></div></div><div class="progress-text"><span id="export-frame">Preparing frames…</span><span id="export-percent">0%</span></div></div><div id="export-error" hidden class="inline-warning"></div></div>` + modalActions('Render'), async (data) => {
        if (state.exporting)
            return;
        const type = data.get('format'), name = safeName(data.get('filename'));
        if (type === 'project') {
            saveProject();
            modal.close();
            return;
        }
        state.exporting = true;
        exportAbort = new AbortController();
        $('#export-progress').hidden = false;
        const submit = $('#modal-form button[value="ok"]');
        submit.disabled = true;
        submit.textContent = 'Rendering…';
        $('#export-error').hidden = true;
        try {
            let blob;
            if (type === 'png') {
                await media.seek(doc, state.time);
                renderer.render(doc, evaluate(doc, state.time), 1);
                await renderer.flush();
                blob = await exportPNG(renderer);
            }
            else
                blob = await encodeComposition({ doc, renderer, media, evaluate, signal: exportAbort.signal, onProgress: (p, n, total) => {
                        $('#export-fill').style.width = p * 100 + '%';
                        $('#export-frame').textContent = `Frame ${n} of ${total}`;
                        $('#export-percent').textContent = Math.round(p * 100) + '%';
                    } });
            download(blob, name + (type === 'png' ? '.png' : '.webm'));
            modal.close();
            toast(type === 'png' ? 'Full-resolution PNG rendered.' : 'Every frame rendered. Your WebM is ready.');
        }
        catch (e) {
            if (e.name === 'AbortError') {
                modal.close();
                toast('Render cancelled.');
            }
            else {
                $('#export-error').hidden = false;
                $('#export-error').textContent = e.message;
            }
        }
        finally {
            state.exporting = false;
            submit.disabled = false;
            submit.textContent = 'Render';
            invalidate();
        }
    });
}
function showPalette() {
    openModal(modalHead('Command palette', 'Make the next move.', 'search') + `<div class="modal-body"><input class="palette-input" id="palette-query" placeholder="Search commands…" autocomplete="off" autofocus><div class="palette-results" id="palette-results"></div></div>`, () => {
        const first = $('#palette-results button');
        if (first) {
            modal.close();
            dispatch(first.dataset.command);
        }
    });
    filterPalette('');
    $('#palette-query').focus();
}
function filterPalette(q) {
    $('#palette-results').innerHTML = allCommands.filter(c => (c.name + ' ' + c.category).toLowerCase().includes(q.toLowerCase())).slice(0, 18).map(c => `<button type="button" data-command="${c.action}">${esc(c.name)}<span>${esc(c.key || c.category)}</span></button>`).join('');
}
function showShortcuts() {
    const rows = [['Play / pause', 'Space'], ['Selection tool', 'V'], ['Hand tool', 'H'], ['Zoom tool', 'Z'], ['Rotate tool', 'W'], ['Anchor tool', 'Y'], ['Shape tool', 'Q'], ['Pen tool', 'G'], ['Position', 'P'], ['Scale', 'S'], ['Rotation', 'R'], ['Opacity', 'T'], ['Animated properties', 'U'], ['Add keyframe', 'K'], ['Easy ease', 'F9'], ['Graph editor', 'Shift F3'], ['Undo', '⌘ / Ctrl Z'], ['Duplicate', '⌘ / Ctrl D'], ['Import media', '⌘ / Ctrl I'], ['Save project', '⌘ / Ctrl S'], ['Export', '⌘ / Ctrl M'], ['Command palette', '⌘ / Ctrl K'], ['Previous / next frame', 'PgUp / PgDn'], ['Nudge layer', 'Arrow keys'], ['Large nudge', 'Shift + Arrow'], ['Work area bounds', 'B / N']];
    openModal(modalHead('A little muscle memory.', 'Your shortcuts to better motion.', 'keyframe') + `<div class="modal-body shortcut-grid">${rows.map(([a, b]) => `<div class="shortcut-row"><span>${a}</span><kbd>${b}</kbd></div>`).join('')}</div><div class="modal-actions"><button class="primary" type="submit" value="cancel">Back to creating</button></div>`);
}
function showAbout() {
    openModal(modalHead('Aether Motion', 'Motion, without limits.', 'sparkles') + `<div class="modal-body"><p>An independent, local-first 2D motion graphics editor. Built with plain JavaScript, native browser typography, and a real WebGPU compositor.</p><p><strong>Engine:</strong> ${renderer?.kind ?? 'Initializing'}<br><strong>Project model:</strong> deterministic keyframe evaluation, bounded transactional history, parent transforms, browser media decoding, GPU effects and blending, offline WebM export.</p><p class="modal-note">This is not Adobe software and does not read .aep files. It does not include 3D cameras, Adobe plug-ins, motion tracking, expressions, audio mixing, HDR color management, or lossless source-codec video decoding. Canvas 2D fallback has approximate effect parity.</p><p>Version 1.0 · MIT licensed · No runtime dependencies</p></div><div class="modal-actions"><button class="primary" type="submit" value="cancel">Keep creating</button></div>`);
}
function compositionPoint(event) {
    const r = stage.getBoundingClientRect();
    return { x: (event.clientX - r.left) / state.scale, y: (event.clientY - r.top) / state.scale };
}
function rulerTime(event) {
    const rect = $('#ruler-viewport').getBoundingClientRect();
    return clamp((event.clientX - rect.left + $('#timeline-scroll').scrollLeft) / state.trackWidth * doc.duration, 0, doc.duration);
}
function snapTime(t, ignoreId = null) {
    t = Math.round(t * doc.fps) / doc.fps;
    if (!state.snap)
        return t;
    const candidates = [0, doc.duration, state.time, doc.workIn, doc.workOut, ...doc.markers.map(m => m.t)];
    for (const l of doc.layers) {
        if (l.id === ignoreId)
            continue;
        candidates.push(l.start, l.end);
        for (const keys of Object.values(l.tracks))
            for (const k of keys)
                candidates.push(k.t);
    }
    let best = t, dist = 6 / state.trackWidth * doc.duration;
    for (const v of candidates)
        if (Math.abs(v - t) < dist) {
            best = v;
            dist = Math.abs(v - t);
        }
    return best;
}
function startViewportDrag(event) {
    if (state.exporting || event.button > 1)
        return;
    pause();
    const p = compositionPoint(event);
    viewport.focus({ preventScroll: true });
    event.preventDefault();
    if (state.tool === 'hand' || event.button === 1 || event.altKey && state.tool === 'select') {
        drag = { kind: 'pan', x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY };
        viewport.setPointerCapture(event.pointerId);
        return;
    }
    if (state.tool === 'zoom') {
        zoomAt(event, event.shiftKey ? .8 : 1.25);
        return;
    }
    if (state.tool === 'text') {
        const l = addLayer('text', { x: p.x, y: p.y });
        setTool('select');
        setTimeout(() => {
            $('textarea[data-data="text"]')?.focus();
            $('textarea[data-data="text"]')?.select();
        }, 0);
        return;
    }
    if (state.tool === 'pen') {
        state.pen.push(p);
        invalidate();
        return;
    }
    if (['rect', 'ellipse'].includes(state.tool)) {
        begin('Draw ' + state.tool);
        const l = layer(state.tool, { x: p.x, y: p.y, width: 1, height: 1, end: doc.duration, data: { color: state.tool === 'ellipse' ? '#e9a487' : '#b49bda', roundness: 18, strokeWidth: 0, mask: 'none' } });
        doc.layers.unshift(l);
        state.selected = l.id;
        drag = { kind: 'draw', id: l.id, start: p };
        viewport.setPointerCapture(event.pointerId);
        renderTimeline();
        return;
    }
    const handle = event.target.closest('[data-handle]')?.dataset.handle;
    let id = handle ? state.selected : hitTest(evaluate(doc, state.time), p.x, p.y);
    if (id !== state.selected)
        setSelection(id);
    const l = selected();
    if (!l || l.locked) {
        invalidate();
        return;
    }
    const e = selectedEval();
    const center = point(e.matrix, e.width * e.anchorX / 100, e.height * e.anchorY / 100);
    const kind = handle === 'rotate' || state.tool === 'rotate' ? 'rotate' : handle ? 'scale' : state.tool === 'anchor' ? 'anchor' : 'move';
    begin(({ move: 'Move layer', rotate: 'Rotate layer', scale: 'Scale layer', anchor: 'Move anchor point' })[kind]);
    drag = { kind, id: l.id, start: p, e, center, handle, inv: invert(e.matrix), angle: Math.atan2(p.y - center.y, p.x - center.x), parentInv: l.parent ? invert(getEvaluated(doc, l.parent, state.time).matrix) : null };
    viewport.setPointerCapture(event.pointerId);
}
function zoomAt(event, multiplier) {
    const r = viewport.getBoundingClientRect(), x = event.clientX - r.left - r.width / 2, y = event.clientY - r.top - r.height / 2, old = state.scale, next = clamp(old * multiplier, .04, 4), ratio = next / old;
    state.panX = x - (x - state.panX) * ratio;
    state.panY = y - (y - state.panY) * ratio;
    state.zoom = next;
    let option = $('#zoom-select option[data-custom]');
    if (!option) {
        option = document.createElement('option');
        option.dataset.custom = 'true';
        $('#zoom-select').append(option);
    }
    option.value = String(next);
    option.textContent = Math.round(next * 100) + '%';
    $('#zoom-select').value = String(next);
    fitStage();
}
function finishPen() {
    if (state.pen.length < 3) {
        state.pen = [];
        invalidate();
        return;
    }
    const pts = state.pen, minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x)), minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
    addLayer('path', { name: 'Path / ' + (doc.layers.length + 1), x: (minX + maxX) / 2, y: (minY + maxY) / 2, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY), data: { points: pts.map(p => ({ x: p.x - minX, y: p.y - minY })), color: '#b59aea', stroke: '#e1caff', strokeWidth: 2 } });
    state.pen = [];
    setTool('select');
}
function movePointer(event) {
    if (!drag)
        return;
    const d = drag;
    if (d.kind === 'resize') {
        const delta = d.axis === 'timeline' ? d.y - event.clientY : event.clientX - d.x;
        root.style.setProperty('--' + d.axis, clamp(d.value + (d.axis === 'right' ? -delta : delta), d.axis === 'timeline' ? 185 : 180, d.axis === 'timeline' ? innerHeight * .68 : 440) + 'px');
        fitStage();
        renderTimeline();
        return;
    }
    if (d.kind === 'pan') {
        state.panX = d.panX + event.clientX - d.x;
        state.panY = d.panY + event.clientY - d.y;
        fitStage();
        return;
    }
    if (d.kind === 'scrub') {
        setTime(rulerTime(event));
        return;
    }
    if (d.kind === 'work') {
        const t = snapTime(rulerTime(event));
        if (d.edge === 'in')
            doc.workIn = clamp(t, 0, doc.workOut - 1 / doc.fps);
        else
            doc.workOut = clamp(t, doc.workIn + 1 / doc.fps, doc.duration);
        renderTimeline();
        invalidate();
        return;
    }
    const l = doc.layers.find(a => a.id === d.id);
    if (!l)
        return;
    if (d.kind === 'key' || d.kind === 'bar') {
        const delta = (event.clientX - d.x) / state.trackWidth * doc.duration;
        if (d.kind === 'key') {
            const key = l.tracks[d.prop]?.find(k => k.id === d.key);
            if (key) {
                key.t = clamp(snapTime(d.time + delta, l.id), 0, doc.duration);
                l.tracks[d.prop].sort((a, b) => a.t - b.t);
            }
        }
        else if (d.trim === 'start')
            l.start = clamp(snapTime(d.original.start + delta, l.id), 0, l.end - 1 / doc.fps);
        else if (d.trim === 'end')
            l.end = clamp(snapTime(d.original.end + delta, l.id), l.start + 1 / doc.fps, doc.duration);
        else {
            const length = d.original.end - d.original.start, newStart = clamp(snapTime(d.original.start + delta, l.id), 0, doc.duration - length), shift = newStart - d.original.start;
            l.start = newStart;
            l.end = newStart + length;
            for (const [p, keys] of Object.entries(d.original.tracks))
                l.tracks[p] = keys.map(k => ({ ...k, t: clamp(k.t + shift, 0, doc.duration) }));
        }
        renderTimeline();
        invalidate();
        return;
    }
    if (d.kind === 'graph') {
        const r = $('#graph-canvas').getBoundingClientRect(), b = d.bounds, key = l.tracks[d.prop]?.find(k => k.id === d.key);
        if (key) {
            key.t = clamp(Math.round((event.clientX - r.left + $('#timeline-scroll').scrollLeft) / state.trackWidth * doc.duration * doc.fps) / doc.fps, 0, doc.duration);
            let value = b.min + (b.h - 24 - (event.clientY - r.top)) / (b.h - 53) * (b.max - b.min);
            if (d.prop === 'opacity')
                value = clamp(value, 0, 100);
            if (['glow', 'blur'].includes(d.prop))
                value = clamp(value, 0, 100);
            if (d.prop === 'saturation')
                value = clamp(value, 0, 300);
            if (d.prop === 'exposure')
                value = clamp(value, -8, 8);
            key.v = value;
            l.tracks[d.prop].sort((a, b) => a.t - b.t);
            drawGraph();
            invalidate();
            updateDynamic();
        }
        return;
    }
    const p = compositionPoint(event);
    let dx = p.x - d.start.x, dy = p.y - d.start.y;
    if (d.kind === 'draw') {
        l.width = Math.max(1, Math.abs(dx));
        l.height = Math.max(1, event.shiftKey ? Math.abs(dx) : Math.abs(dy));
        l.x = d.start.x + (dx < 0 ? -l.width : l.width) / 2;
        l.y = d.start.y + (dy < 0 ? -l.height : l.height) / 2;
    }
    if (d.kind === 'move') {
        if (d.parentInv) {
            const a = point(d.parentInv, d.start.x, d.start.y), b = point(d.parentInv, p.x, p.y);
            dx = b.x - a.x;
            dy = b.y - a.y;
        }
        if (event.shiftKey) {
            if (Math.abs(dx) > Math.abs(dy))
                dy = 0;
            else
                dx = 0;
        }
        let x = d.e.x + dx, y = d.e.y + dy;
        if (state.snap && !l.parent) {
            if (Math.abs(x - doc.width / 2) < 6 / state.scale)
                x = doc.width / 2;
            if (Math.abs(y - doc.height / 2) < 6 / state.scale)
                y = doc.height / 2;
        }
        updateProp('x', x, l);
        updateProp('y', y, l);
    }
    if (d.kind === 'rotate') {
        let rotation = d.e.rotation + (Math.atan2(p.y - d.center.y, p.x - d.center.x) - d.angle) * 180 / Math.PI;
        if (event.shiftKey)
            rotation = Math.round(rotation / 15) * 15;
        updateProp('rotation', rotation, l);
    }
    if (d.kind === 'scale' && d.inv) {
        const q = point(d.inv, p.x, p.y), corner = [[0, 0], [1, 0], [1, 1], [0, 1]][Number(d.handle)], ax = d.e.width * d.e.anchorX / 100, ay = d.e.height * d.e.anchorY / 100, rx = (q.x - ax) / (corner[0] * l.width - ax || 1), ry = (q.y - ay) / (corner[1] * l.height - ay || 1);
        let sx = d.e.scaleX * rx, sy = d.e.scaleY * ry;
        if (state.linkedScale || event.shiftKey) {
            const ratio = Math.abs(rx) > Math.abs(ry) ? rx : ry;
            sx = d.e.scaleX * ratio;
            sy = d.e.scaleY * ratio;
        }
        updateProp('scaleX', clamp(sx, -5000, 5000), l);
        updateProp('scaleY', clamp(sy, -5000, 5000), l);
    }
    if (d.kind === 'anchor' && d.inv) {
        const a = point(d.inv, d.start.x, d.start.y), b = point(d.inv, p.x, p.y), ax = clamp(d.e.anchorX + (b.x - a.x) / l.width * 100, 0, 100), ay = clamp(d.e.anchorY + (b.y - a.y) / l.height * 100, 0, 100), localDx = (ax - d.e.anchorX) * l.width / 100, localDy = (ay - d.e.anchorY) * l.height / 100, r = d.e.rotation * Math.PI / 180;
        updateProp('anchorX', ax, l);
        updateProp('anchorY', ay, l);
        updateProp('x', d.e.x + Math.cos(r) * d.e.scaleX / 100 * localDx - Math.sin(r) * d.e.scaleY / 100 * localDy, l);
        updateProp('y', d.e.y + Math.sin(r) * d.e.scaleX / 100 * localDx + Math.cos(r) * d.e.scaleY / 100 * localDy, l);
    }
    invalidate();
    updateDynamic();
}
function finishPointer(cancel = false) {
    if (!drag)
        return;
    const kind = drag.kind, l = doc.layers.find(a => a.id === drag.id);
    if (cancel && history.pending) {
        doc = history.cancel();
    }
    else {
        if (l && ['key', 'graph', 'bar'].includes(kind)) {
            for (const p of PROPS) {
                if (!l.tracks[p])
                    continue;
                const byTime = new Map();
                for (const k of l.tracks[p]) {
                    const time = Math.round(k.t * doc.fps) / doc.fps;
                    const existing = byTime.get(time);
                    if (!existing || k.id === state.key)
                        byTime.set(time, { ...k, t: time });
                }
                l.tracks[p] = [...byTime.values()].sort((a, b) => a.t - b.t);
            }
        }
        if (kind === 'draw' && l && (l.width < 4 || l.height < 4)) {
            l.width = 260;
            l.height = 160;
        }
        if (!['pan', 'scrub', 'resize'].includes(kind))
            commit(false);
    }
    drag = null;
    if (kind === 'draw')
        setTool('select');
    renderUI();
    invalidate();
}
function handleTimelineDown(event) {
    if (event.button !== 0 || state.exporting)
        return;
    const keyEl = event.target.closest('[data-key]'), bar = event.target.closest('[data-bar]');
    if (keyEl) {
        event.preventDefault();
        pause();
        const id = keyEl.dataset.id, p = keyEl.dataset.prop, l = doc.layers.find(a => a.id === id), k = l.tracks[p].find(a => a.id === keyEl.dataset.key);
        state.selected = id;
        state.prop = p;
        state.key = k.id;
        begin('Move keyframe');
        drag = { kind: 'key', id, prop: p, key: k.id, time: k.t, x: event.clientX };
        renderTimeline();
        renderInspector();
        return;
    }
    if (bar) {
        const l = doc.layers.find(a => a.id === bar.dataset.bar);
        if (l.locked)
            return;
        event.preventDefault();
        pause();
        state.selected = l.id;
        state.key = null;
        begin('Move / trim layer');
        drag = { kind: 'bar', id: l.id, trim: event.target.closest('[data-trim]')?.dataset.trim, x: event.clientX, original: clone(l) };
        renderInspector();
        renderTimeline();
        return;
    }
    const track = event.target.closest('.track');
    if (track) {
        pause();
        setSelection(track.dataset.trackLayer);
        if (track.dataset.trackProp)
            state.prop = track.dataset.trackProp;
        setTime(rulerTime(event));
        drag = { kind: 'scrub' };
        event.preventDefault();
    }
}
function editInput(el) {
    const l = selected();
    if (!l || l.locked)
        return;
    const p = el.dataset.prop, d = el.dataset.data, f = el.dataset.field;
    if (!p && !d && !f)
        return;
    if (!history.pending)
        begin('Edit ' + (p ?? d ?? f));
    if (p) {
        const v = Number(el.value);
        updateProp(p, v, l);
        if (state.linkedScale && (p === 'scaleX' || p === 'scaleY'))
            updateProp(p === 'scaleX' ? 'scaleY' : 'scaleX', v, l);
        state.prop = p;
    }
    if (d) {
        let value = el.value;
        if (['fontSize', 'fontWeight', 'tracking', 'lineHeight', 'roundness', 'strokeWidth'].includes(d))
            value = Number(value);
        if (d === 'fontSize')
            value = clamp(value, 6, 600);
        if (d === 'lineHeight')
            value = clamp(value, .5, 3);
        if (d === 'strokeWidth')
            value = clamp(value, 0, 100);
        if (d === 'roundness')
            value = clamp(value, 0, 500);
        if (d === 'tracking')
            value = clamp(value, -20, 100);
        l.data[d] = value;
    }
    if (f) {
        if (f === 'parent') {
            try {
                reparent(l, el.value || null);
            }
            catch (e) {
                toast(e.message);
            }
        }
        else if (['width', 'height'].includes(f))
            l[f] = clamp(Number(el.value) || 1, 1, 4096);
        else
            l[f] = el.value;
    }
    invalidate();
}
function bindEvents() {
    document.addEventListener('click', event => {
        const target = event.target;
        const menuButton = target.closest('[data-menu]');
        if (menuButton) {
            const already = menu.dataset.open === menuButton.dataset.menu && !menu.hidden;
            menu.dataset.open = menuButton.dataset.menu;
            if (already)
                closeMenu();
            else
                showMenu(menus[menuButton.dataset.menu], menuButton.getBoundingClientRect());
            return;
        }
        const tool = target.closest('[data-tool]');
        if (tool) {
            setTool(tool.dataset.tool);
            closeMenu();
            return;
        }
        const command = target.closest('[data-command]');
        if (command) {
            modal.close();
            dispatch(command.dataset.command);
            return;
        }
        const act = target.closest('[data-action]');
        if (act) {
            event.preventDefault();
            closeMenu();
            dispatch(act.dataset.action);
            return;
        }
        const left = target.closest('[data-left-tab]');
        if (left) {
            state.leftTab = left.dataset.leftTab;
            $$('[data-left-tab]').forEach(b => b.classList.toggle('active', b === left));
            $('#project-content').hidden = state.leftTab !== 'project';
            $('#effect-content').hidden = state.leftTab !== 'effects';
            return;
        }
        const right = target.closest('[data-right-tab]');
        if (right) {
            switchRightTab(right.dataset.rightTab);
            return;
        }
        const workspace = target.closest('[data-workspace]');
        if (workspace) {
            $$('[data-workspace]').forEach(b => b.classList.toggle('active', b === workspace));
            app.classList.remove('animation', 'effect-workspace', 'review');
            if (workspace.dataset.workspace === 'animation')
                app.classList.add('animation');
            if (workspace.dataset.workspace === 'effects') {
                app.classList.add('effect-workspace');
                switchRightTab('presets');
                state.leftTab = 'effects';
                renderProject();
            }
            if (workspace.dataset.workspace === 'minimal')
                app.classList.add('review');
            requestAnimationFrame(() => {
                fitStage();
                renderTimeline();
            });
            return;
        }
        const toggle = target.closest('[data-layer-toggle]');
        if (toggle) {
            const l = doc.layers.find(a => a.id === toggle.dataset.id);
            if (l)
                mutate('Toggle ' + toggle.dataset.layerToggle, () => l[toggle.dataset.layerToggle] = !l[toggle.dataset.layerToggle]);
            return;
        }
        const exp = target.closest('[data-expand]');
        if (exp) {
            const id = exp.dataset.expand;
            if (state.expanded.has(id))
                state.expanded.delete(id);
            else {
                const l = doc.layers.find(a => a.id === id), props = Object.keys(l.tracks).filter(p => l.tracks[p].length);
                state.expanded.set(id, props.length ? props : ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity']);
            }
            renderTimeline();
            return;
        }
        const keyprop = target.closest('[data-keyprop]');
        if (keyprop) {
            toggleAnimation(keyprop.dataset.keyprop, keyprop.dataset.id ?? state.selected);
            return;
        }
        const add = target.closest('[data-add-key]');
        if (add) {
            addKey(add.dataset.addKey, add.dataset.id);
            return;
        }
        const cycle = target.closest('[data-cycle-blend]');
        if (cycle) {
            const l = doc.layers.find(a => a.id === cycle.dataset.cycleBlend);
            if (l && !l.locked)
                mutate('Change blend mode', () => {
                    const modes = ['normal', 'multiply', 'screen', 'add', 'overlay', 'difference'];
                    l.blend = modes[(modes.indexOf(l.blend) + 1) % modes.length];
                });
            return;
        }
        const prop = target.closest('[data-select-prop]');
        if (prop) {
            state.selected = prop.dataset.id;
            state.prop = prop.dataset.selectProp;
            state.key = null;
            renderTimeline();
            renderInspector();
            invalidate();
            return;
        }
        const label = target.closest('[data-layer]');
        if (label) {
            setSelection(label.dataset.layer);
            return;
        }
        if (!target.closest('#menu-popover'))
            closeMenu();
    });
    document.addEventListener('dblclick', event => {
        const asset = event.target.closest('[data-asset]');
        if (asset) {
            addAssetLayer(asset.dataset.asset);
            return;
        }
        const label = event.target.closest('.layer-name');
        if (label) {
            setSelection(label.closest('[data-layer]').dataset.layer);
            dispatch('rename');
        }
    });
    document.addEventListener('input', event => {
        const el = event.target;
        if (el.id === 'palette-query') {
            filterPalette(el.value);
            return;
        }
        if (el.id === 'effect-search') {
            $$('.effect-item', $('#presets-content')).forEach(b => b.hidden = !b.textContent.toLowerCase().includes(el.value.toLowerCase()));
            return;
        }
        if (el.id === 'layer-search') {
            state.layerSearch = el.value;
            renderTimeline();
            return;
        }
        if (el.id === 'asset-search') {
            state.assetSearch = el.value;
            $$('[data-asset]').forEach(row => row.hidden = !media.get(row.dataset.asset).name.toLowerCase().includes(el.value.toLowerCase()));
            return;
        }
        if (el.id === 'timeline-zoom') {
            state.timelineZoom = Number(el.value);
            renderTimeline();
            return;
        }
        if (el.matches('input[data-prop],input[data-data],textarea[data-data],input[data-field]'))
            editInput(el);
    });
    document.addEventListener('change', event => {
        const el = event.target;
        if (el.matches('select[data-data],select[data-field]'))
            editInput(el);
        if (el.matches('[data-prop],[data-data],[data-field]') && history.pending)
            commit();
    });
    $('#zoom-select').addEventListener('change', e => {
        state.zoom = e.target.value === 'fit' ? 'fit' : Number(e.target.value);
        state.panX = state.panY = 0;
        fitStage();
    });
    $('#quality-select').addEventListener('change', e => {
        state.quality = Number(e.target.value);
        invalidate();
    });
    $('#graph-easing').addEventListener('change', e => applyEase(e.target.value));
    $('#media-input').addEventListener('change', e => {
        importFiles([...e.target.files]);
        e.target.value = '';
    });
    $('#project-input').addEventListener('change', e => {
        if (e.target.files[0])
            loadProjectFile(e.target.files[0]);
        e.target.value = '';
    });
    viewport.addEventListener('pointerdown', startViewportDrag);
    viewport.addEventListener('contextmenu', e => e.preventDefault());
    viewport.addEventListener('wheel', e => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey)
            zoomAt(e, Math.exp(-e.deltaY * .005));
        else if (e.shiftKey) {
            state.panX -= e.deltaY;
            fitStage();
        }
        else {
            state.panX -= e.deltaX;
            state.panY -= e.deltaY;
            fitStage();
        }
    }, { passive: false });
    $('#timeline-scroll').addEventListener('pointerdown', handleTimelineDown);
    $('#timeline-scroll').addEventListener('scroll', () => {
        syncTimelineScroll();
        if (state.graph)
            drawGraph();
    });
    $('#ruler-viewport').addEventListener('pointerdown', event => {
        if (state.exporting)
            return;
        event.preventDefault();
        pause();
        const edge = event.target.closest('[data-work-handle]')?.dataset.workHandle;
        if (edge) {
            begin('Adjust work area');
            drag = { kind: 'work', edge };
        }
        else {
            setTime(rulerTime(event));
            drag = { kind: 'scrub' };
        }
        $('#ruler-viewport').setPointerCapture(event.pointerId);
    });
    $('#graph-canvas').addEventListener('pointerdown', event => {
        const l = selected();
        if (!l || l.locked)
            return;
        const r = event.currentTarget.getBoundingClientRect(), b = graphBounds, keys = l.tracks[state.prop] ?? [];
        let nearest = null, dist = 12;
        for (const k of keys) {
            const x = k.t / doc.duration * state.trackWidth - $('#timeline-scroll').scrollLeft, y = b.h - 24 - (k.v - b.min) / (b.max - b.min) * (b.h - 53), d = Math.hypot(x - (event.clientX - r.left), y - (event.clientY - r.top));
            if (d < dist) {
                dist = d;
                nearest = k;
            }
        }
        if (nearest) {
            event.preventDefault();
            state.key = nearest.id;
            begin('Edit value graph');
            drag = { kind: 'graph', id: l.id, prop: state.prop, key: nearest.id, bounds: { ...b } };
            event.currentTarget.setPointerCapture(event.pointerId);
            drawGraph();
        }
        else {
            setTime(rulerTime(event));
            drag = { kind: 'scrub' };
        }
    });
    $$('[data-resize]').forEach(el => el.addEventListener('pointerdown', e => {
        e.preventDefault();
        const axis = el.dataset.resize;
        drag = { kind: 'resize', axis, x: e.clientX, y: e.clientY, value: axis === 'timeline' ? $('.timeline').getBoundingClientRect().height : parseFloat(getComputedStyle(root).getPropertyValue('--' + axis)) };
        el.setPointerCapture(e.pointerId);
    }));
    document.addEventListener('pointermove', movePointer);
    document.addEventListener('pointerup', () => finishPointer());
    document.addEventListener('pointercancel', () => finishPointer(true));
    document.addEventListener('dragstart', event => {
        const label = event.target.closest('[data-layer]'), asset = event.target.closest('[data-asset]');
        if (label) {
            event.dataTransfer.setData('application/x-aether-layer', label.dataset.layer);
            event.dataTransfer.effectAllowed = 'move';
        }
        if (asset) {
            event.dataTransfer.setData('application/x-aether-asset', asset.dataset.asset);
            event.dataTransfer.effectAllowed = 'copy';
        }
    });
    document.addEventListener('dragover', event => {
        const label = event.target.closest('[data-layer]');
        if (label && event.dataTransfer.types.includes('application/x-aether-layer')) {
            event.preventDefault();
            $$('.drop-target').forEach(e => e.classList.remove('drop-target'));
            label.classList.add('drop-target');
        }
    });
    document.addEventListener('drop', event => {
        const label = event.target.closest('[data-layer]');
        $$('.drop-target').forEach(e => e.classList.remove('drop-target'));
        if (label) {
            const id = event.dataTransfer.getData('application/x-aether-layer');
            if (id && id !== label.dataset.layer) {
                event.preventDefault();
                mutate('Reorder layers', () => {
                    const moving = doc.layers.find(l => l.id === id);
                    doc.layers = doc.layers.filter(l => l.id !== id);
                    doc.layers.splice(doc.layers.findIndex(l => l.id === label.dataset.layer), 0, moving);
                });
            }
        }
    });
    viewport.addEventListener('dragover', e => {
        e.preventDefault();
        viewport.classList.add('drag-over');
    });
    viewport.addEventListener('dragleave', e => {
        if (!viewport.contains(e.relatedTarget))
            viewport.classList.remove('drag-over');
    });
    viewport.addEventListener('drop', e => {
        e.preventDefault();
        viewport.classList.remove('drag-over');
        const p = compositionPoint(e), asset = e.dataTransfer.getData('application/x-aether-asset');
        if (asset)
            addAssetLayer(asset, p);
        else if (e.dataTransfer.files.length)
            importFiles([...e.dataTransfer.files], p);
    });
    document.addEventListener('keydown', handleKeyDown);
    modal.addEventListener('cancel', event => {
        if (state.exporting) {
            event.preventDefault();
            exportAbort?.abort();
        }
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden)
            pause();
    });
    new ResizeObserver(() => {
        fitStage();
        renderTimeline();
    }).observe(viewport);
}
function handleKeyDown(event) {
    if (state.exporting)
        return;
    const key = event.key.toLowerCase(), mod = event.ctrlKey || event.metaKey, typing = event.target.matches('input,textarea,select,[contenteditable]');
    if (mod && key === 's') {
        event.preventDefault();
        event.target.blur?.();
        saveProject();
        return;
    }
    if (mod && key === 'k' && !event.shiftKey) {
        event.preventDefault();
        if (!modal.open)
            showPalette();
        return;
    }
    if (mod && event.shiftKey && key === 'k' && !modal.open) {
        event.preventDefault();
        showComposition(false);
        return;
    }
    if (mod && key === 'o' && !modal.open) {
        event.preventDefault();
        dispatch('open');
        return;
    }
    if (typing || modal.open)
        return;
    if (key === 'escape') {
        if (drag)
            finishPointer(true);
        else {
            state.pen = [];
            closeMenu();
            setTool('select');
        }
        return;
    }
    if (mod) {
        const action = ({ n: 'new', i: 'import', m: 'export', d: 'duplicate', z: event.shiftKey ? 'redo' : 'undo', y: 'redo', ']': 'layer-up', '[': 'layer-down' })[key];
        if (action) {
            event.preventDefault();
            dispatch(action);
            return;
        }
    }
    if (event.shiftKey && key === 'f3') {
        event.preventDefault();
        dispatch('graph');
        return;
    }
    const action = ({ ' ': 'play', home: 'home', end: 'end', pageup: 'prev', pagedown: 'next', delete: 'delete', backspace: 'delete', f9: 'ease', k: 'keyframe', u: 'expand-animated', b: 'work-in', n: 'work-out', '*': 'add-marker', '`': 'fullscreen', '?': 'shortcuts' })[key];
    if (action) {
        event.preventDefault();
        dispatch(action);
        return;
    }
    if (key === 'enter') {
        event.preventDefault();
        if (state.pen.length)
            finishPen();
        else
            dispatch('rename');
        return;
    }
    if (key === '/' && event.shiftKey) {
        event.preventDefault();
        dispatch('fit');
        return;
    }
    const propList = ({ p: ['x', 'y'], s: ['scaleX', 'scaleY'], r: ['rotation'], t: ['opacity'] })[key];
    if (propList && selected()) {
        state.prop = propList[0];
        state.expanded.set(state.selected, propList);
        renderTimeline();
        return;
    }
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key) && selected()) {
        event.preventDefault();
        const e = selectedEval(), delta = event.shiftKey ? 10 : 1, p = key === 'arrowleft' || key === 'arrowright' ? 'x' : 'y', sign = key === 'arrowleft' || key === 'arrowup' ? -1 : 1;
        mutate('Nudge layer', () => updateProp(p, e[p] + sign * delta));
        return;
    }
    const tool = ({ v: 'select', h: 'hand', z: 'zoom', w: 'rotate', y: 'anchor', q: state.tool === 'rect' ? 'ellipse' : 'rect', g: 'pen' })[key];
    if (tool) {
        event.preventDefault();
        setTool(tool);
    }
}
let fallingBack = false;
async function fallback(message) {
    if (fallingBack || renderer?.kind === 'Canvas 2D')
        return;
    fallingBack = true;
    pause();
    console.warn(message);
    const old = renderer.canvas, newCanvas = old.cloneNode();
    old.replaceWith(newCanvas);
    renderer.dispose();
    renderer = new CanvasRenderer(newCanvas, raster);
    updateRendererLabels();
    invalidate();
    toast('GPU unavailable. Switched to Canvas 2D compatibility rendering.');
    fallingBack = false;
}
function updateRendererLabels() {
    const gpu = renderer.kind === 'WebGPU';
    $('#engine-badge').innerHTML = `<i style="background:${gpu ? '#92cbb2' : '#d5b581'}"></i>${gpu ? 'WebGPU accelerated' : 'Canvas 2D fallback'}`;
    $('#renderer-status').textContent = gpu ? 'WebGPU · RGBA8' : 'Canvas 2D · compatibility';
}
function frameLoop(now) {
    requestAnimationFrame(frameLoop);
    if (!state.ready || state.exporting)
        return;
    if (state.playing) {
        let t = playTime + (now - playStart) / 1000;
        if (t >= doc.workOut) {
            if (state.loop) {
                t = doc.workIn + (t - doc.workIn) % (doc.workOut - doc.workIn);
                playStart = now;
                playTime = t;
            }
            else {
                t = doc.workOut - 1 / doc.fps;
                pause();
            }
        }
        const frame = Math.floor(t * doc.fps);
        if (frame !== lastFrame) {
            lastFrame = frame;
            state.time = frame / doc.fps;
            state.dirty = true;
            updateDynamic();
            metrics.frames++;
        }
    }
    if (state.dirty) {
        state.dirty = false;
        media.sync(doc, state.time, state.playing);
        try {
            renderer.render(doc, evaluate(doc, state.time), state.quality);
            drawOverlay();
        }
        catch (e) {
            console.error(e);
            if (renderer.kind === 'WebGPU')
                fallback(e.message);
            else {
                pause();
                toast('Render failed: ' + e.message);
            }
        }
        if (now - lastPreview > 500) {
            lastPreview = now;
            updateMini();
        }
    }
    if (now - lastStats > 650) {
        lastStats = now;
        const s = renderer.stats;
        if (s.submitMs !== undefined)
            $('#render-stats').textContent = `${s.layers} layers · ${s.passes} passes · ${s.submitMs.toFixed(1)} ms CPU · ${((s.textureBytes || 0) / 1048576).toFixed(1)} MB textures`;
        if (state.playing) {
            const elapsed = (now - metrics.start) / 1000;
            $('#status-message').textContent = `Preview · ${(metrics.frames / Math.max(.01, elapsed)).toFixed(1)} rendered fps`;
            if (elapsed > 3)
                metrics = { frames: 0, start: now };
        }
        else
            $('#status-message').textContent = 'Local-first. Your canvas, your possibilities.';
    }
}
async function boot() {
    initShell();
    renderUI();
    bindEvents();
    try {
        const saved = await store.load();
        if (saved?.document) {
            const restored = validateDocument(saved.document);
            for (const a of saved.assets ?? [])
                await media.add(a);
            doc = restored;
            state.selected = doc.layers.find(l => l.type === 'text')?.id ?? doc.layers[0]?.id ?? null;
            state.time = Math.min(2.4, doc.duration - 1 / doc.fps);
            state.expanded.clear();
            if (state.selected)
                state.expanded.set(state.selected, ['y', 'opacity']);
            renderUI();
            $('#save-status').textContent = 'Restored local project';
        }
    }
    catch (e) {
        console.warn('Local restore:', e.message);
        $('#save-status').textContent = 'Local project';
    }
    renderer = await createRenderer($('#scene'), raster, fallback, new URLSearchParams(location.search).get('renderer') === 'canvas');
    updateRendererLabels();
    renderer.render(doc, evaluate(doc, state.time), state.quality);
    await renderer.flush();
    $('#loading').hidden = true;
    state.ready = true;
    invalidate();
    fitStage();
    requestAnimationFrame(frameLoop);
    scheduleSave();
    window.aether = { version: VERSION, getDocument: () => clone(doc), getTime: () => state.time, setTime: t => setTime(t, true), select: setSelection, dispatch, getRenderer: () => renderer, getState: () => ({ ...state, expanded: [...state.expanded] }), evaluate: t => evaluate(doc, t), testExport: async (options) => {
            if (state.exporting)
                throw new Error('An export is already active.');
            pause();
            state.exporting = true;
            try {
                return await encodeComposition({ doc: { ...doc, ...options }, renderer, media, evaluate });
            }
            finally {
                state.exporting = false;
                invalidate();
            }
        }, loadDocument: raw => {
            pause();
            doc = validateDocument(raw);
            history.clear();
            state.expanded.clear();
            state.key = null;
            state.time = 0;
            state.selected = doc.layers[0]?.id ?? null;
            renderUI();
            invalidate();
        } };
}
boot().catch(error => {
    console.error(error);
    $('#loading').innerHTML = `<div class="inline-warning">Unable to start: ${esc(error.message)}<br>Serve the app over localhost or HTTPS and reload.</div>`;
});
