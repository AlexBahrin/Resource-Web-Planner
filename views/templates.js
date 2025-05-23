// HTML templates for various pages
const fs = require('fs');
const path = require('path');

// Function to read HTML file and return its content
function readHtmlFile(filename) {
  return fs.readFileSync(path.join(__dirname, 'html', filename), 'utf8');
}

// Load HTML templates
const loginPage = readHtmlFile('login.html');
const registerPage = readHtmlFile('register.html');
const dashboardHtml = readHtmlFile('dashboard.html');
const categoriesHtml = readHtmlFile('categories.html');
const resourcesHtml = readHtmlFile('resources.html');
const usersHtml = readHtmlFile('users.html');
const notificationsHtml = readHtmlFile('notifications.html');

// Function to render the dashboard with a username
const dashboardPage = (username = '') => {
  if (!username) return dashboardHtml;
  return dashboardHtml.replace('<h2 id="welcome-message">Dashboard</h2>', 
                               `<h2 id="welcome-message">Welcome, ${username}!</h2>`);
};

// Function to render the categories page with category list
const categoriesPage = (categories) => {
  const categoriesList = categories
    .map(cat => `<li>${cat.name}</li>`)
    .join('');
  
  return categoriesHtml.replace('<!-- Category items will be inserted here dynamically -->', 
                               categoriesList);
};

// Export additional templates
module.exports = {
  loginPage,
  registerPage,
  dashboardPage,
  categoriesPage,
  resourcesHtml,
  usersHtml,
  notificationsHtml
};
