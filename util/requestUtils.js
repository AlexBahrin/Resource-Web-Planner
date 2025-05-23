// Common utility functions

/**
 * Parse the request body as JSON. Returns a Promise.
 * Resolves with the parsed JSON object if successful.
 * If parsing fails or an error occurs, it sends an HTTP error response
 * and resolves with null to indicate the response has been handled.
 * @param {http.IncomingMessage} req - The HTTP request object
 * @param {http.ServerResponse} res - The HTTP response object
 * @returns {Promise<object|null>} A promise that resolves to the parsed JSON object or null.
 */
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
      resolve(null); // Indicate failure, response sent
    });

    req.on('end', () => {
      try {
        if (body.trim() === '') {
          if (!res.headersSent) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Empty request body received, but JSON expected.' }));
          }
          resolve(null); // Indicate failure, response sent
          return;
        }
        const parsedBody = JSON.parse(body);
        resolve(parsedBody); // Resolve with parsed body
      } catch (e) {
        if (!res.headersSent) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
        }
        resolve(null); // Indicate failure, response sent
      }
    });
  });
}

/**
 * Parse form data (x-www-form-urlencoded)
 * @param {http.IncomingMessage} req - The HTTP request object
 * @param {Function} callback - Callback function to handle the parsed form data
 */
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
