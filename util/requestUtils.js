function parseJsonBody(req, res) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('error', (err) => {
      console.error('Error reading request body stream:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Error reading request body' }));
      }
      resolve(null);
    });

    req.on('end', () => {
      try {
        if (body.trim() === '') {
          if (!res.headersSent) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Empty request body received, but JSON expected.' }));
          }
          resolve(null);
          return;
        }
        const parsedBody = JSON.parse(body);
        resolve(parsedBody);
      } catch (e) {
        if (!res.headersSent) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
        }
        resolve(null);
      }
    });
  });
}

function parseFormData(req, callback) {
  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', () => {
    const params = {};
    body.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    callback(params);
  });
}

module.exports = {
  parseJsonBody,
  parseFormData
};
