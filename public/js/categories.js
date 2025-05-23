// Client-side JavaScript for categories page
document.addEventListener('DOMContentLoaded', function() {
  // Fetch categories data
  fetch('/categories')
    .then(response => response.json())
    .then(categories => {
      const categoriesList = document.getElementById('categories-list');
      
      if (categories.length === 0) {
        categoriesList.innerHTML = '<li>No categories found.</li>';
        return;
      }
      
      let html = '';
      categories.forEach(category => {
        html += `<li>${category.name}</li>`;
      });
      
      categoriesList.innerHTML = html;
    })
    .catch(error => {
      console.error('Error fetching categories:', error);
      document.getElementById('categories-list').innerHTML = '<li>Error loading categories.</li>';
    });
});

function showForm() {
  document.getElementById('addForm').style.display = 'block';
  document.getElementById('showAddBtn').style.display = 'none';
}
