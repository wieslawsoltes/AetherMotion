/** Verify that every public build file is served unchanged, with executable MIME types. */
import { createHash } from 'node:crypto';
import { appendFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.dirname(fileURLToPath(import.meta.url));
const input = process.argv[2];
if (!input) throw new Error('Usage: node verify-deployment.mjs <site-base-url>');
const base = new URL(input.endsWith('/') ? input : input + '/');
if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) {
    throw new Error('Deployment verification requires HTTPS (or localhost for local tests).');
}
base.search = '';
base.hash = '';
const distribution = path.join(root, 'dist');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function walk(directory, prefix = '') {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const relative = prefix + entry.name;
        if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), relative + '/'));
        else if (entry.isFile()) files.push(relative);
        else throw new Error(`Unsupported build entry: ${relative}`);
    }
    return files.sort();
}
const files = await walk(distribution);
if (!files.includes('index.html') || !files.includes('src/app.js') || !files.includes('AetherMotion.html')) {
    throw new Error('The Pages artifact is incomplete; build and stage the standalone HTML first.');
}
const expected = new Map(await Promise.all(files.map(async file => [file, sha256(await readFile(path.join(distribution, file)))])));
const checks = new Map();
const failed = new Map();
const attempts = 12;
for (let attempt = 1; attempt <= attempts; attempt++) {
    await Promise.all(files.filter(file => !checks.has(file)).map(async file => {
        try {
            const url = new URL(file.split('/').map(encodeURIComponent).join('/'), base);
            url.searchParams.set('revision', process.env.GITHUB_SHA || 'local');
            url.searchParams.set('attempt', String(attempt));
            const response = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
            const required = file.endsWith('.html') ? ['text/html']
                : file.endsWith('.js') ? ['text/javascript', 'application/javascript']
                : file.endsWith('.css') ? ['text/css'] : null;
            if (required && !required.includes(type)) throw new Error(`Incorrect MIME type: ${type}`);
            const actual = sha256(Buffer.from(await response.arrayBuffer()));
            if (actual !== expected.get(file)) throw new Error(`SHA-256 mismatch: ${actual}`);
            checks.set(file, actual);
            failed.delete(file);
            console.log(`PASS ${file} ${actual}`);
        } catch (error) {
            failed.set(file, error.message);
        }
    }));
    if (checks.size === files.length) break;
    console.warn(`Attempt ${attempt}/${attempts}: ${checks.size}/${files.length} files verified.`);
    for (const [file, reason] of failed) console.warn(`  ${file}: ${reason}`);
    if (attempt < attempts) await delay(5000);
}
if (checks.size !== files.length) throw new Error(`Deployment verification failed: ${JSON.stringify(Object.fromEntries(failed))}`);
const message = `Verified ${checks.size} public files against the build using SHA-256; HTML, JavaScript and CSS MIME types are correct.`;
console.log(message);
if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY,
        `## Aether Motion deployment verified\n\n[Open the application](${base.href})\n\n${message}\n\nSource commit: \`${process.env.GITHUB_SHA || 'local'}\`\n`);
}
