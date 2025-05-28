// Client-side JavaScript for resources page
document.addEventListener('DOMContentLoaded', function() {
  const resourcesList = document.getElementById('resources-list');
  const addResourceForm = document.getElementById('add-resource-form');
  const resourceNameInput = document.getElementById('resource-name');
  const resourceCategorySelect = document.getElementById('resource-category');
  const resourceQuantityInput = document.getElementById('resource-quantity');
  const resourceDescriptionInput = document.getElementById('resource-description');
  const lowStockThresholdInput = document.getElementById('low-stock-threshold');

  // Refactor initial resource fetch to a function to be reusable
  function fetchResources() {
    fetch('/api/resources')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(resources => {
        const resourcesList = document.getElementById('resources-list');
        if (!resources || resources.length === 0) {
          resourcesList.innerHTML = '<p>No resources found.</p>';
          return;
        }
        let html = '<table class="data-table">';
        html += '<thead><tr><th>Name</th><th>Category</th><th>Quantity</th><th>Description</th><th>Low Stock Threshold</th></tr></thead>';
        html += '<tbody>';
        resources.forEach(resource => {
          const categoryDisplay = resource.category_id 
            ? `${resource.category_name || 'Unknown Category'} (ID: ${resource.category_id})` 
            : 'N/A';
          html += `<tr>
            <td>${resource.name}</td>
            <td>${categoryDisplay}</td>
            <td>${resource.quantity === null || resource.quantity === undefined ? 0 : resource.quantity}</td>
            <td>${resource.description || ''}</td>
            <td>${resource.low_stock_threshold === null || resource.low_stock_threshold === undefined ? 'N/A' : resource.low_stock_threshold}</td>
          </tr>`;
        });
        html += '</tbody></table>';
        resourcesList.innerHTML = html;
      })
      .catch(error => {
        console.error('Error fetching resources:', error);
        document.getElementById('resources-list').innerHTML = '<p>Error loading resources. '+error.message+'</p>';
      });
  }

  // Fetch categories for the dropdown
  async function fetchCategoriesForDropdown() {
    try {
      const response = await fetch('/api/categories');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const categories = await response.json();
      resourceCategorySelect.innerHTML = '<option value="">Select a category</option>'; // Placeholder
      categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        resourceCategorySelect.appendChild(option);
      });
    } catch (error) {
      console.error('Error fetching categories for dropdown:', error);
      resourceCategorySelect.innerHTML = '<option value="">Error loading categories</option>';
    }
  }

  // Function to handle adding a new resource
  async function addResource(event) {
    event.preventDefault();
    const resourceName = resourceNameInput.value.trim();
    const categoryId = resourceCategorySelect.value;
    const quantity = parseInt(resourceQuantityInput.value, 10);
    const description = resourceDescriptionInput.value.trim();
    const lowStockThreshold = parseInt(lowStockThresholdInput.value, 10);

    if (!resourceName || !categoryId) {
      alert('Resource name and category are required.');
      return;
    }

    if (isNaN(quantity) || quantity < 0) {
        alert('Please enter a valid quantity.');
        return;
    }

    if (isNaN(lowStockThreshold) || lowStockThreshold < 0) {
        alert('Please enter a valid low stock threshold.');
        return;
    }

    try {
      const response = await fetch('/api/resources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: resourceName,
          category_id: parseInt(categoryId, 10),
          quantity: quantity,
          description: description,
          low_stock_threshold: lowStockThreshold
        }),
      });

      if (!response.ok) {
        let errorData = { message: `Request failed with status: ${response.status} ${response.statusText}` };
        try {
          // Attempt to parse detailed error message from server
          const serverError = await response.json();
          errorData.message = serverError.error || serverError.message || errorData.message;
        } catch (e) {
          // If server didn't send JSON or it's malformed, stick with the status text or generic message
          console.warn('Could not parse error response as JSON:', e);
        }
        throw new Error(errorData.message);
      }

      const newResource = await response.json(); // Ensure we parse the successful JSON response
      console.log('Resource added:', newResource); // Log the newly added resource

      // Clear the form
      addResourceForm.reset();
      resourceCategorySelect.value = ''; // Reset select to placeholder
      // Refresh the resources list
      fetchResources(); 
      alert('Resource added successfully!');
    } catch (error) {
      console.error('Error adding resource:', error.message, error.stack);
      alert(`Error adding resource: ${error.message}`);
    }
  }

  // Add event listener for the form submission
  if (addResourceForm) {
    addResourceForm.addEventListener('submit', addResource);
  }

  // Initial fetch of categories for the dropdown
  fetchCategoriesForDropdown();

  // Initial fetch of resources
  fetchResources();
});
