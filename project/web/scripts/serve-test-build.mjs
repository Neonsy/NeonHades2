import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, relative, resolve } from 'node:path';

const host = '127.0.0.1';
const port = 4322;
const outputDirectory = resolve(process.cwd(), 'dist');
const contentTypes = {
    '.avif': 'image/avif',
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

if (!existsSync(outputDirectory)) {
    throw new Error('Missing dist/. Run the production build before running Playwright tests.');
}

const responseFile = (pathname) => {
    let decodedPathname;
    try {
        decodedPathname = decodeURIComponent(pathname);
    } catch {
        return null;
    }

    const candidate = resolve(outputDirectory, `.${decodedPathname}`);
    if (relative(outputDirectory, candidate).startsWith('..')) return null;

    try {
        return statSync(candidate).isDirectory() ? resolve(candidate, 'index.html') : candidate;
    } catch {
        return null;
    }
};

const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', `http://${host}:${port}`);
    const file = responseFile(requestUrl.pathname);
    if (!file || !existsSync(file)) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
    }

    response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream',
    });
    if (request.method === 'HEAD') {
        response.end();
        return;
    }

    createReadStream(file)
        .on('error', () => response.destroy())
        .pipe(response);
});

const closeServer = () => server.close(() => process.exit(0));
process.once('SIGINT', closeServer);
process.once('SIGTERM', closeServer);

await new Promise((resolveServer, rejectServer) => {
    server.once('error', rejectServer);
    server.listen(port, host, resolveServer);
});

process.stdout.write(`Serving ${outputDirectory} at http://${host}:${port}\n`);
