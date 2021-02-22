const {extname} = require('path');
const fs = require('fs');
const http = require('http');

const mimeMap = {
  bin: 'application/octet-stream',
  css: 'text/css',
  gif: 'image/gif',
  html: 'text/html; charset=utf-8',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'text/javascript',
  json: 'application/json',
  png: 'image/png',
  txt: 'text/plain',
}

const getContentType = (path) =>  {
  const ext = extname(path).split('.').pop();
  return mimeMap[ext] || mimeMap['bin'];
}

const humanFileSize = (bytes, si = false, dp = 1) => {
  const thresh = si ? 1000 : 1024;
  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }
  const units = si
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  const r = 10**dp;
  do {
    bytes /= thresh;
    ++u;
  } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);
  return bytes.toFixed(dp) + ' ' + units[u];
}

const buildDoc = (title, body) => {
  const style = `body {font-family: monospace;}
    th {text-align: left; padding-bottom: 10px}
    td {padding-right: 40px}
    a {text-decoration: none}`;
  return [
    '<html>',
    `<head><title>${title}</title><style>${style}</style></head>`,
    `<body>${body}</body>`,
    '</html>'
  ].join('\n');
}

const listDir = (path) => {
  const url = path[0] === '.' ? path.substring(1) : path;
  const files = fs.readdirSync(path);
  if (files.includes('index.html')) {
    return fs.readFileSync(path + '/index.html');
  }
  const title = `<h1>Index of ${url}</h1>`;
  const list = ['<table><tr><th>Name</th><th>Last modified</th><th>Size</th></tr>'];
  const sep = path !== './' ? '/' : '';
  for (const f of files) {
    const p = `${path}${sep}${f}`;
    const u = `${url}${sep}${f}`;
    const stat = fs.lstatSync(p)
    const isDir = stat.isDirectory();
    const mtime = stat.mtime.toISOString().split('.')[0].replace('T', ' ');
    if (f[0] !== '.') {
      list.push(`<tr>
        <td>${isDir ? '📁' : '📄'} <a href="${u}">${f}</a></td>
        <td>${mtime}</td>
        <td>${isDir ? '-' : humanFileSize(stat.size)}</td>
      </tr>`);
    }
  }
  list.push('</table>')
  return buildDoc(`Index of ${url}`, [title, ...list].join('\n'));
}

const server = http.createServer((req, res) => {
  console.log(req.method, req.url);
  try {
    const url = new URL(`http://domain.com${req.url}`);
    const sanitizedUrl = url.pathname.split('/').filter((i) => !!i).join('/');
    const path = `./${sanitizedUrl}`;
    if (!fs.existsSync(path)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const isDir = fs.lstatSync(path).isDirectory();
    const type = isDir ? mimeMap['html'] : getContentType(path);
    const body = isDir ? listDir(path) : fs.readFileSync(path);
    res.writeHead(200, {'Content-Length': Buffer.byteLength(body), 'Content-Type': type});
    res.end(body);
  } catch (error) {
    res.writeHead(500);
    res.end(`Internal Server Error\n\n${error}`);
  }
});

const port = (process.argv[2] === '-p' && parseInt(process.argv[3])) || 8000;
server.on('error', (e) => console.error(`Error starting server on port ${port}.`, e.message));
server.listen({port}, () => console.log(`Listening on port ${port}`));
