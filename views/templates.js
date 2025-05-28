const fs = require('fs');
const path = require('path');

function readHtmlFile(filename) {
  return fs.readFileSync(path.join(__dirname, 'html', filename), 'utf8');
}

const loginPage = readHtmlFile('login.html');
const registerPage = readHtmlFile('register.html');
const dashboardHtml = readHtmlFile('dashboard.html');
const categoriesHtml = readHtmlFile('categories.html');
const resourcesHtml = readHtmlFile('resources.html');
const usersHtml = readHtmlFile('users.html');
const notificationsHtml = readHtmlFile('notifications.html');

const dashboardPage = (username = '') => {
  if (!username) return dashboardHtml;
  return dashboardHtml.replace('<h2 id="welcome-message">Dashboard</h2>', 
                               `<h2 id="welcome-message">Welcome, ${username}!</h2>`);
};

const categoriesPage = () => {
  return categoriesHtml;
};

module.exports = {
  loginPage,
  registerPage,
  dashboardPage,
  categoriesPage,
  resourcesHtml,
  usersHtml,
  notificationsHtml
};
