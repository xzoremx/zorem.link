/**
 * Simple HTTP server para servir los archivos estáticos del frontend
 * Ejecutar con: node server.js
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8080;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  // Parse URL and remove query string
  let urlPath = req.url.split('?')[0];
  
  // Default to landing.html for root
  if (urlPath === '/' || urlPath === '') {
    urlPath = '/landing.html';
  }
  
  // Remove leading slash and build file path
  const cleanPath = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
  let filePath = path.join(__dirname, cleanPath);
  
  // Normalize path (resolve .. and .)
  filePath = path.normalize(filePath);
  
  // Security: prevent directory traversal - ensure path is within __dirname
  if (!filePath.startsWith(__dirname)) {
    console.error(`403: Attempted directory traversal: ${req.url}`);
    res.writeHead(403, { 'Content-Type': 'text/html' });
    res.end('<h1>403 - Forbidden</h1>', 'utf-8');
    return;
  }
  
  // If no extension, try adding .html
  if (!path.extname(filePath)) {
    const htmlPath = filePath + '.html';
    try {
      if (fs.existsSync(htmlPath)) {
        filePath = htmlPath;
      }
    } catch (e) {
      // Ignore
    }
  }

  // Get file extension
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  // Read file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        console.error(`404: ${req.url}`);
        console.error(`   Looking for: ${filePath}`);
        console.error(`   __dirname: ${__dirname}`);
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`<h1>404 - File Not Found</h1><p>Requested: ${req.url}</p><p>Path: ${filePath}</p>`, 'utf-8');
      } else {
        console.error(`500: ${error.message}`);
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`, 'utf-8');
      }
    } else {
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`🌐 Frontend server running on http://localhost:${PORT}`);
  console.log(`📁 Serving files from: ${__dirname}`);
  console.log(`\n✨ Open http://localhost:${PORT} in your browser\n`);
});
