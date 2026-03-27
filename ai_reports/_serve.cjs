const http = require('http');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const PORT = 9999;

const TYPES = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

http.createServer((req, res) => {
  const url = req.url === '/' ? '/economic_collapse_report.html' : req.url;
  const filePath = path.join(DIR, decodeURIComponent(url));
  const ext = path.extname(filePath).toLowerCase();
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
    console.log('200', url);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found: ' + url);
    console.log('404', url);
  }
}).listen(PORT, () => {
  console.log('Server running at http://localhost:' + PORT);
});
