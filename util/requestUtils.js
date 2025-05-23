// Common utility functions

/**
 * Parse the request body as JSON
 * @param {http.IncomingMessage} req - The HTTP request object
 * @param {http.ServerResponse} res - The HTTP response object
 * @param {Function} callback - Callback function to handle the parsed body
 */
function parseJsonBody(req, res, callback) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', () => {
    try {
      callback(JSON.parse(body));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
    }
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
