const templates = require('../views/templates');

function serveHTML(req, res, page) {
  const path = req.path;
  const method = req.method;
  
  if (method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(page);
    return true;
  }
  
  return false;
}

function serveResourcesPage(req, res) {
  return serveHTML(req, res, templates.resourcesHtml);
}

function serveUsersPage(req, res) {
  return serveHTML(req, res, templates.usersHtml);
}

function serveNotificationsPage(req, res) {
  return serveHTML(req, res, templates.notificationsHtml);
}

function serveStatisticsPage(req, res) {
  return serveHTML(req, res, templates.statisticsHtml);
}

module.exports = {
  serveResourcesPage,
  serveUsersPage,
  serveNotificationsPage,
  serveStatisticsPage
};
