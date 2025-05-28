// Client-side JavaScript for resources page
document.addEventListener('DOMContentLoaded', function() {
  const resourcesList = document.getElementById('resources-list');
  const addResourceForm = document.getElementById('add-resource-form');
  const resourceNameInput = document.getElementById('resource-name');
  const resourceCategorySelect = document.getElementById('resource-category');
  const resourceQuantityInput = document.getElementById('resource-quantity');
  const resourceDescriptionInput = document.getElementById('resource-description');
  const lowStockThresholdInput = document.getElementById('low-stock-threshold');
  const editResourceIdInput = document.getElementById('edit-resource-id'); // Get the hidden input
  const formSubmitButton = addResourceForm.querySelector('button[type="submit"]'); // Get the submit button
  const cancelEditBtn = document.getElementById('cancel-edit-btn'); // Get the cancel button

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
        html += '<thead><tr><th>Name</th><th>Category</th><th>Quantity</th><th>Description</th><th>Low Stock Threshold</th><th>Actions</th></tr></thead>'; // Added Actions header
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
            <td>
              <button class="edit-btn" data-id="${resource.id}">Modify</button>
              <button class="delete-btn" data-id="${resource.id}" data-name="${resource.name}">Delete</button>
            </td>
          </tr>`;
        });
        html += '</tbody></table>';
        resourcesList.innerHTML = html;

        // Add event listeners for new edit and delete buttons
        document.querySelectorAll('.edit-btn').forEach(button => {
          button.addEventListener('click', (event) => {
            const resourceId = event.target.dataset.id;
            // Find the resource data from the fetched resources array
            const resourceToEdit = resources.find(r => r.id.toString() === resourceId);
            if (resourceToEdit) {
              populateFormForEdit(resourceToEdit);
            }
          });
        });

        document.querySelectorAll('.delete-btn').forEach(button => {
          button.addEventListener('click', (event) => {
            const resourceId = event.target.dataset.id;
            const resourceName = event.target.dataset.name;
            handleDeleteResource(resourceId, resourceName);
          });
        });

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

  // Function to handle adding or updating a new resource
  async function addOrUpdateResource(event) { // Renamed from addResource
    event.preventDefault();
    const resourceName = resourceNameInput.value.trim();
    const categoryId = resourceCategorySelect.value;
    const quantity = parseInt(resourceQuantityInput.value, 10);
    const description = resourceDescriptionInput.value.trim();
    const lowStockThreshold = parseInt(lowStockThresholdInput.value, 10);
    const resourceId = editResourceIdInput.value; // Get the ID for editing

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

    const method = resourceId ? 'PUT' : 'POST';
    const endpoint = resourceId ? `/api/resources/${resourceId}` : '/api/resources';

    try {
      const response = await fetch(endpoint, {
        method: method,
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
      console.log('Resource added/updated:', newResource); // Log the newly added/updated resource

      resetForm(); // Reset form and button text
      fetchResources(); 
      alert(`Resource ${resourceId ? 'updated' : 'added'} successfully!`);
    } catch (error) {
      console.error(`Error ${resourceId ? 'updating' : 'adding'} resource:`, error.message, error.stack);
      alert(`Error ${resourceId ? 'updating' : 'adding'} resource: ${error.message}`);
    }
  }

  // Function to populate form for editing
  function populateFormForEdit(resource) {
    editResourceIdInput.value = resource.id;
    resourceNameInput.value = resource.name;
    resourceCategorySelect.value = resource.category_id;
    resourceQuantityInput.value = resource.quantity;
    resourceDescriptionInput.value = resource.description || '';
    lowStockThresholdInput.value = resource.low_stock_threshold === null || resource.low_stock_threshold === undefined ? '' : resource.low_stock_threshold;
    formSubmitButton.textContent = 'Update Resource';
    cancelEditBtn.style.display = 'inline-block'; // Show cancel button
    window.scrollTo({ top: addResourceForm.offsetTop - 20, behavior: 'smooth' }); // Scroll to form
  }

  // Function to reset the form
  function resetForm() {
    addResourceForm.reset();
    editResourceIdInput.value = ''; // Clear the hidden ID field
    resourceCategorySelect.value = ''; // Reset select to placeholder
    formSubmitButton.textContent = 'Add Resource'; // Reset button text
    cancelEditBtn.style.display = 'none'; // Hide cancel button
  }

  // Function to handle deleting a resource
  async function handleDeleteResource(resourceId, resourceName) {
    if (!confirm(`Are you sure you want to delete the resource "${resourceName}" (ID: ${resourceId})?`)) {
      return;
    }
    try {
      const response = await fetch(`/api/resources/${resourceId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        let errorData = { message: `Request failed with status: ${response.status} ${response.statusText}` };
        if (response.status !== 204) { // 204 No Content might not have a JSON body
            try {
                const serverError = await response.json();
                errorData.message = serverError.error || serverError.message || errorData.message;
            } catch (e) {
                console.warn('Could not parse error response as JSON for DELETE:', e);
            }
        }
        throw new Error(errorData.message);
      }
      alert('Resource deleted successfully!');
      fetchResources(); // Refresh the list
    } catch (error) {
      console.error('Error deleting resource:', error.message, error.stack);
      alert(`Error deleting resource: ${error.message}`);
    }
  }

  // Add event listener for the form submission
  if (addResourceForm) {
    addResourceForm.addEventListener('submit', addOrUpdateResource); // Changed to addOrUpdateResource
  }

  // Add event listener for the cancel button
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', function() {
      resetForm();
    });
  }

  // Initial fetch of categories for the dropdown
  fetchCategoriesForDropdown();

  // Initial fetch of resources
  fetchResources();
});
