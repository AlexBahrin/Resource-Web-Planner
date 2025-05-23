// Client-side JavaScript for resources page
document.addEventListener('DOMContentLoaded', function() {
  // Fetch resources data
  fetch('/resources')
    .then(response => response.json())
    .then(resources => {
      const resourcesList = document.getElementById('resources-list');
      
      if (resources.length === 0) {
        resourcesList.innerHTML = '<p>No resources found.</p>';
        return;
      }
      
      let html = '<table class="data-table">';
      html += '<thead><tr><th>Name</th><th>Category</th><th>Quantity</th><th>Description</th></tr></thead>';
      html += '<tbody>';
      
      resources.forEach(resource => {
        html += `<tr>
          <td>${resource.name}</td>
          <td>${resource.category_id || 'N/A'}</td>
          <td>${resource.quantity || 0}</td>
          <td>${resource.description || ''}</td>
        </tr>`;
      });
      
      html += '</tbody></table>';
      resourcesList.innerHTML = html;
    })
    .catch(error => {
      console.error('Error fetching resources:', error);
      document.getElementById('resources-list').innerHTML = '<p>Error loading resources.</p>';
    });
});
