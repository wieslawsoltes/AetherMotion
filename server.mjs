import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webm': 'video/webm', '.aether': 'application/json' };
http.createServer((req, res) => {
    let file;
    try {
        file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    }
    catch {
        res.writeHead(400).end('Bad request');
        return;
    }
    if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403).end('Forbidden');
        return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory())
        file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
        if (err) {
            res.writeHead(404).end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }).end(data);
    });
}).listen(port, '0.0.0.0', () => console.log(`Aether Motion: http://localhost:${port}`));
