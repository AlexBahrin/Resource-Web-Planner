document.addEventListener('DOMContentLoaded', function() {
  const resourcesList = document.getElementById('resources-list');
  const addResourceForm = document.getElementById('add-resource-form');
  const resourceNameInput = document.getElementById('resource-name');
  const resourceCategorySelect = document.getElementById('resource-category');
  const resourceQuantityInput = document.getElementById('resource-quantity');
  const resourceDescriptionInput = document.getElementById('resource-description');
  const lowStockThresholdInput = document.getElementById('low-stock-threshold');
  const resourceExpirationDateInput = document.getElementById('resource-expiration-date');
  const editResourceIdInput = document.getElementById('edit-resource-id');
  const formSubmitButton = addResourceForm.querySelector('button[type="submit"]');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');

  let originalResources = [];
  let currentSortState = { column: null, direction: 'none' };

  function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '5px';
    toast.style.color = 'white';
    toast.style.zIndex = '1000';
    toast.style.transition = 'opacity 0.5s ease-in-out';
    toast.style.opacity = '0';

    if (type === 'error') {
      toast.style.backgroundColor = 'red';
    } else if (type === 'success') {
      toast.style.backgroundColor = 'green';
    } else if (type === 'warning') {
      toast.style.backgroundColor = 'orange';
    } else {
      toast.style.backgroundColor = '#333';
    }

    document.body.appendChild(toast);


    setTimeout(() => {
      toast.style.opacity = '1';
    }, 100);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        toast.remove();
      }, 500);
    }, duration);
  }

  function fetchResources() {
    fetch('/api/resources')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(resources => {
        originalResources = resources.map(r => ({ ...r }));
        renderTable(originalResources);
      })
      .catch(error => {
        console.error('Error fetching resources:', error);
        const resourcesList = document.getElementById('resources-list');
        if (resourcesList) {
            resourcesList.innerHTML = 
            `<p class="error-message">Error loading resources: ${error.message}</p>`;
        }
      });
  }

  function getSortIndicator(columnKey) {
    if (currentSortState.column === columnKey) {
      if (currentSortState.direction === 'asc') return ' \u25B2';
      if (currentSortState.direction === 'desc') return ' \u25BC';
    }
    return '';
  }

  function renderTable(resourcesToDisplay) {
    const resourcesList = document.getElementById('resources-list');
    resourcesList.innerHTML = '';

    if (originalResources.length === 0) {
      resourcesList.innerHTML = '<p>No resources found.</p>';
      return;
    }

    let html = '<table class="data-table">';
    const headers = [
      { key: 'name', title: 'Name', sortable: true },
      { key: 'category_name', title: 'Category', sortable: true },
      { key: 'quantity', title: 'Quantity', sortable: true },
      { key: 'description', title: 'Description', sortable: true },
      { key: 'low_stock_threshold', title: 'Low Stock Threshold', sortable: true },
      { key: 'expiration_date', title: 'Expiration Date', sortable: true },
      { key: 'actions', title: 'Actions', sortable: false }
    ];

    html += '<thead><tr>';
    headers.forEach(header => {
      if (header.sortable) {
        html += `<th data-column-key="${header.key}" style="cursor: pointer;">${header.title}${getSortIndicator(header.key)}</th>`;
      } else {
        html += `<th>${header.title}</th>`;
      }
    });
    html += '</tr></thead>';

    html += '<tbody>';
    resourcesToDisplay.forEach(resource => {
      const categoryDisplay = resource.category_name || 'N/A';
      const expirationDateDisplay = resource.expiration_date
        ? new Date(resource.expiration_date).toLocaleDateString()
        : 'N/A';
      html += `<tr>
            <td>${resource.name || ''}</td>
            <td>${categoryDisplay}</td>
            <td>${resource.quantity === null || resource.quantity === undefined ? 0 : resource.quantity}</td>
            <td>${resource.description || ''}</td>
            <td>${resource.low_stock_threshold === null || resource.low_stock_threshold === undefined ? 'N/A' : resource.low_stock_threshold}</td>
            <td>${expirationDateDisplay}</td>
            <td>
              <button class="edit-btn" data-id="${resource.id}">Modify</button>
              <button class="delete-btn" data-id="${resource.id}" data-name="${resource.name}">Delete</button>
            </td>
          </tr>`;
    });
    html += '</tbody></table>';
    resourcesList.innerHTML = html;

    document.querySelectorAll('#resources-list th[data-column-key]').forEach(th => {
      th.addEventListener('click', () => {
        sortTable(th.dataset.columnKey);
      });
    });

    document.querySelectorAll('.edit-btn').forEach(button => {
      button.addEventListener('click', (event) => {
        const resourceId = event.target.dataset.id;
        const resourceToEdit = originalResources.find(r => r.id.toString() === resourceId);
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
  }

  function sortTable(columnKey) {
    if (currentSortState.column === columnKey) {
      if (currentSortState.direction === 'asc') {
        currentSortState.direction = 'desc';
      } else if (currentSortState.direction === 'desc') {
        currentSortState.direction = 'none';
      } else {
        currentSortState.direction = 'asc';
      }
    } else {
      currentSortState.column = columnKey;
      currentSortState.direction = 'asc';
    }

    let resourcesToRender;
    if (currentSortState.direction === 'none') {
      resourcesToRender = [...originalResources];
    } else {
      let sortedResources = [...originalResources];
      sortedResources.sort((a, b) => {
        let valA = a.hasOwnProperty(columnKey) ? a[columnKey] : null;
        let valB = b.hasOwnProperty(columnKey) ? b[columnKey] : null;

        const isValANull = valA === null || valA === undefined || (typeof valA === 'string' && valA.trim() === '');
        const isValBNull = valB === null || valB === undefined || (typeof valB === 'string' && valB.trim() === '');

        if (isValANull && isValBNull) return 0;
        if (isValANull) return 1;
        if (isValBNull) return -1;

        if (columnKey === 'expiration_date') {
          valA = new Date(valA).getTime();
          valB = new Date(valB).getTime();
        } else if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
          const comparison = valA.localeCompare(valB);
          return currentSortState.direction === 'asc' ? comparison : -comparison;
        }
        let comparisonResult = 0;
        if (valA < valB) comparisonResult = -1;
        if (valA > valB) comparisonResult = 1;
        
        return currentSortState.direction === 'asc' ? comparisonResult : -comparisonResult;
      });
      resourcesToRender = sortedResources;
    }
    renderTable(resourcesToRender);
  }

  async function fetchCategoriesForDropdown() {
    try {
      const response = await fetch('/api/categories');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const categories = await response.json();
      resourceCategorySelect.innerHTML = '<option value="">Select a category</option>';
      categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        resourceCategorySelect.appendChild(option);
      });
    } catch (error) {
      console.error('Error fetching categories for dropdown:', error);
      resourceCategorySelect.innerHTML = '<option value="">Error loading categories</option>';
      showToast('Error loading categories. Try refreshing the page.', 'error');
    }
  }

  async function addOrUpdateResource(event) {
    event.preventDefault();
    const resourceName = resourceNameInput.value.trim();
    const categoryId = resourceCategorySelect.value;
    const quantity = parseInt(resourceQuantityInput.value, 10);
    const description = resourceDescriptionInput.value.trim();
    const lowStockThreshold = parseInt(lowStockThresholdInput.value, 10);
    const expirationDate = resourceExpirationDateInput.value.trim();
    const resourceId = editResourceIdInput.value;

    if (!resourceName || !categoryId) {
      showToast('Resource name and category are required.', 'error');
      return;
    }

    const existingResourceByName = originalResources.find(
      r => r.name.toLowerCase() === resourceName.toLowerCase()
    );

    if (resourceId) { 
      if (existingResourceByName && existingResourceByName.id.toString() !== resourceId) {
        showToast('Another resource with this name already exists.', 'error');
        return;
      }
    } else { 
      if (existingResourceByName) {
        showToast('A resource with this name already exists. Please use a different name.', 'error');
        return;
      }
    }

    if (isNaN(quantity) || quantity < 0) {
      showToast('Please enter a valid quantity.', 'error');
      return;
    }

    if (isNaN(lowStockThreshold) || lowStockThreshold < 0) {
      showToast('Please enter a valid low stock threshold.', 'error');
      return;
    }

    const method = resourceId ? 'PUT' : 'POST';
    const endpoint = resourceId ? `/api/resources/${resourceId}` : '/api/resources';

    let body = {
      name: resourceName,
      category_id: parseInt(categoryId, 10),
      quantity: quantity,
      description: description,
      low_stock_threshold: lowStockThreshold
    };

    if (expirationDate) {
      body.expiration_date = expirationDate;
    } else {
      body.expiration_date = null;
    }

    try {
      const response = await fetch(endpoint, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let errorData = { message: `Request failed with status: ${response.status} ${response.statusText}` };
        try {
          const serverError = await response.json();
          errorData.message = serverError.error || serverError.message || errorData.message;
        } catch (e) {
          console.warn('Could not parse error response as JSON:', e);
        }
        throw new Error(errorData.message);
      }

      const newResource = await response.json();
      console.log('Resource added/updated:', newResource);

      resetForm();
      fetchResources(); 
      showToast(`Resource ${resourceId ? 'updated' : 'added'} successfully!`, 'success');
    } catch (error) {
      console.error(`Error ${resourceId ? 'updating' : 'adding'} resource:`, error.message, error.stack);
      showToast(`Error ${resourceId ? 'updating' : 'adding'} resource: ${error.message}`, 'error');
    }
  }

  function populateFormForEdit(resource) {
    editResourceIdInput.value = resource.id;
    resourceNameInput.value = resource.name;
    resourceCategorySelect.value = resource.category_id;
    resourceQuantityInput.value = resource.quantity;
    resourceDescriptionInput.value = resource.description || '';
    lowStockThresholdInput.value = resource.low_stock_threshold === null || resource.low_stock_threshold === undefined ? '' : resource.low_stock_threshold;
    resourceExpirationDateInput.value = resource.expiration_date ? new Date(resource.expiration_date).toISOString().split('T')[0] : '';
    formSubmitButton.textContent = 'Update Resource';
    cancelEditBtn.style.display = 'inline-block';
    window.scrollTo({ top: addResourceForm.offsetTop - 20, behavior: 'smooth' });
  }

  function resetForm() {
    addResourceForm.reset();
    editResourceIdInput.value = '';
    resourceCategorySelect.value = '';
    resourceExpirationDateInput.value = '';
    formSubmitButton.textContent = 'Add Resource';
    cancelEditBtn.style.display = 'none';
  }

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
        if (response.status !== 204) {
            try {
                const serverError = await response.json();
                errorData.message = serverError.error || serverError.message || errorData.message;
            } catch (e) {
                console.warn('Could not parse error response as JSON for DELETE:', e);
            }
        }
        throw new Error(errorData.message);
      }
      showToast('Resource deleted successfully!', 'success');
      fetchResources();
    } catch (error) {
      console.error('Error deleting resource:', error.message, error.stack);
      showToast(`Error deleting resource: ${error.message}`, 'error');
    }
  }

  function setupImportExportButtons() {
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const exportXmlBtn = document.getElementById('exportXmlBtn');
    
    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', () => exportResources('json'));
    }
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => exportResources('csv'));
    }
    if (exportXmlBtn) {
        exportXmlBtn.addEventListener('click', () => exportResources('xml'));
    }
    
    const importBtn = document.getElementById('importBtn');
    const fileInput = document.getElementById('importFile');
    
    if (importBtn && fileInput) {
        importBtn.addEventListener('click', () => {
            if (fileInput.files.length === 0) {
                showToast('Please select a file to import', 'error');
                return;
            }
            importResources();
        });
        
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                const fileName = fileInput.files[0].name;
                const fileExtension = fileName.split('.').pop().toLowerCase();
                
                if (!['json', 'csv', 'xml'].includes(fileExtension)) {
                    showToast(`Unsupported file type: .${fileExtension}. Please use JSON, CSV, or XML files.`, 'error');
                    fileInput.value = '';
                    return;
                }
                
                showToast(`File selected: ${fileName}`, 'info');
            }
        });
    }
}

  async function exportResources(format) {
    try {
        showToast(`Exporting resources as ${format.toUpperCase()}...`, 'info');
        
        const response = await fetch(`/api/resources/export?format=${format}`);
        
        if (!response.ok) {
            let errorMessage = '';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || response.statusText;
            } catch (e) {
                errorMessage = `Export failed with status: ${response.status} ${response.statusText}`;
            }
            
            showToast(`Export error: ${errorMessage}`, 'error');
            return;
        }
        
        const blob = await response.blob();
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `resources_${timestamp}.${format}`;
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
        
        showToast(`Resources exported as ${format.toUpperCase()} successfully`, 'success');
    } catch (error) {
        console.error('Export error:', error);
        showToast(`Export failed: ${error.message}`, 'error');
    }
}

  async function importResources() {
    const fileInput = document.getElementById('importFile');
    
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showToast('Please select a file to import', 'error');
        return;
    }
    
    const file = fileInput.files[0];
    const filename = file.name;
    const fileExtension = filename.split('.').pop().toLowerCase();
    
    if (!['json', 'csv', 'xml'].includes(fileExtension)) {
        showToast(`Unsupported file type: .${fileExtension}. Please use JSON, CSV, or XML files.`, 'error');
        return;
    }
    
    console.log('Import file selected:', {
        name: filename,
        size: file.size,
        type: file.type
    });
    
    try {
        showToast(`Importing resources from ${filename}...`, 'info');
        
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`/api/resources/import?filename=${encodeURIComponent(filename)}`, {
            method: 'POST',
            body: file
        });
        
        const result = await response.json();
        
        if (response.ok) {
            let message = result.message || 'Resources imported successfully';
            
            if (result.results) {
                const { Succeeded, Failed } = result.results;
                message += ` (${Succeeded} imported, ${Failed} failed)`;
                
                if (Failed > 0 && result.results.Errors && result.results.Errors.length > 0) {
                    const errorMessage = result.results.Errors.map(err => 
                        `• ${err.resource}: ${err.error}`
                    ).join('\n');
                    
                    console.warn('Import warnings:', result.results.Errors);
                    showToast(`Import warnings:\n${errorMessage}`, 'warning', 8000);
                }
            }
            
            showToast(message, 'success');
            fetchResources();
            
            fileInput.value = '';
        } else {
            const errorMessage = result.error || result.message || 'Import failed';
            showToast(`Import error: ${errorMessage}`, 'error');
            
            if (result.details) {
                console.error('Import error details:', result.details);
            }
        }
    } catch (error) {
        console.error('Import error:', error);
        showToast(`Import failed: ${error.message}`, 'error');
    }
}

  if (addResourceForm) {
    addResourceForm.addEventListener('submit', addOrUpdateResource);
  }

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', function() {
      resetForm();
    });
  }

  fetchCategoriesForDropdown();
  fetchResources();
  setupImportExportButtons();
});
