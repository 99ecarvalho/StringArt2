/**
 * String Art Generator - Minimal static file server for local testing
 *
 * Usage: node serve.js [directory] [port]
 *   npm run serve          serves the project folder on http://localhost:8080
 *   npm run serve:dist     serves the build output (dist/)
 *
 * Only for local use: it serves files read-only from one directory and
 * listens on localhost.
 *
 * Copyright (c) 2025-2026 Eduardo Correia <ecorreia@apliant.com.br>
 *
 * This file is part of String Art Generator. It is free software, licensed
 * under the GNU Lesser General Public License v3.0 or later. See
 * COPYING.LESSER and COPYING for details.
 *
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, process.argv[2] || '.');
const port = parseInt(process.argv[3] || process.env.PORT || '8080', 10);

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.md': 'text/plain; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch (e) {
        res.writeHead(400).end('Bad request');
        return;
    }
    if (pathname.endsWith('/')) pathname += 'index.html';

    // Refuse anything that resolves outside the served directory
    const file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403).end('Forbidden');
        return;
    }

    fs.stat(file, (err, stat) => {
        if (err || !stat.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
            return;
        }
        res.writeHead(200, {
            'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
            'Content-Length': stat.size,
            'Cache-Control': 'no-cache'
        });
        fs.createReadStream(file).pipe(res);
    });
});

server.listen(port, '127.0.0.1', () => {
    console.log(`Serving ${root}`);
    console.log(`Open http://localhost:${port} (Ctrl+C to stop)`);
});
