/** Build with Node's standard library only. No code is downloaded or evaluated. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = relative => fs.readFile(path.join(root, relative), 'utf8');
const destination = path.join(root, 'dist');
const modules = ['core', 'raster', 'shaders', 'renderer', 'media', 'export', 'app'];

// Explicit module boundaries preserve lexical isolation in the portable build.
// Add exports/imports here when extending the module interfaces.
const exportsByModule = {
    core: ['VERSION', 'clamp', 'clone', 'uid', 'PROPS', 'PROP_NAMES', 'EASINGS', 'TYPES',
        'ease', 'localMatrix', 'layer', 'blankDocument', 'demoDocument', 'evaluate',
        'getEvaluated', 'hitTest', 'setKey', 'sampleTrack', 'History', 'validateDocument',
        'timecode', 'invert', 'point', 'mul', 'canParent'],
    raster: ['RasterCache', 'rgba', 'rgb'],
    shaders: ['COMPOSITOR_WGSL', 'PRESENT_WGSL'],
    renderer: ['createRenderer', 'CanvasRenderer', 'GPURenderer'],
    media: ['MediaLibrary', 'ProjectStore'],
    export: ['download', 'exportPNG', 'encodeComposition', 'muxWebM'],
    app: []
};
const imports = {
    renderer: 'const {COMPOSITOR_WGSL,PRESENT_WGSL}=Modules.shaders;const {rgb}=Modules.raster;',
    media: 'const {uid}=Modules.core;',
    app: `const {${exportsByModule.core.join(',')}}=Modules.core;`
        + 'const {RasterCache}=Modules.raster;'
        + 'const {createRenderer,CanvasRenderer}=Modules.renderer;'
        + 'const {MediaLibrary,ProjectStore}=Modules.media;'
        + 'const {download,exportPNG,encodeComposition}=Modules.export;'
};

await fs.mkdir(destination, { recursive: true });
await fs.copyFile(path.join(root, 'index.html'), path.join(destination, 'index.html'));
await fs.cp(path.join(root, 'src'), path.join(destination, 'src'), { recursive: true });

let bundle = 'const Modules={};\n';
for (const name of modules) {
    const source = (await read(`src/${name}.js`))
        .replace(/^import\s+[\s\S]*?\sfrom\s+['"][^'"]+['"];\s*/gm, '')
        .replace(/^export /gm, '');
    bundle += `\n// ---- ${name}.js ----\nModules.${name}=(()=>{${imports[name] || ''}\n`
        + `${source}\nreturn {${exportsByModule[name].join(',')}};})();\n`;
}

const stylePlaceholder = '<link rel="stylesheet" href="./src/style.css">';
const scriptPlaceholder = '<script type="module" src="./src/app.js"></script>';
const css = await read('src/style.css');
let html = await read('index.html');
if (!html.includes(stylePlaceholder) || !html.includes(scriptPlaceholder)) {
    throw new Error('Application shell no longer matches the portable build entry points.');
}
// Replacement callbacks preserve JavaScript $$ selectors and other $ sequences.
html = html.replace(stylePlaceholder, () => `<style>${css}</style>`)
    .replace(scriptPlaceholder, () => `<script type="module">${bundle.replaceAll('</script', '<\\/script')}</script>`);
await fs.writeFile(path.join(root, 'AetherMotion.html'), html);
console.log('Built dist/ and AetherMotion.html');
