document.addEventListener('DOMContentLoaded', () => {
    const categoriesListContainer = document.getElementById('categories-list-container');
    const addCategoryForm = document.getElementById('add-category-form');
    const categoryNameInput = document.getElementById('category-name');
    const editCategoryIdInput = document.getElementById('edit-category-id');
    const formSubmitButton = addCategoryForm.querySelector('button[type="submit"]');
    const cancelEditBtn = document.getElementById('cancel-edit-category-btn');

    // Function to fetch and display categories
    async function fetchCategories() {
        try {
            const response = await fetch('/api/categories');
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to load categories. Server returned an error.' }));
                throw new Error(errorData.message || `HTTP error! ${response.status}`);
            }
            const categories = await response.json();
            renderCategories(categories);
        } catch (error) {
            console.error('Error fetching categories:', error);
            categoriesListContainer.innerHTML = `<p>Error loading categories: ${error.message}</p>`;
        }
    }

    // Function to render categories in a table
    function renderCategories(categories) {
        if (!categories || categories.length === 0) {
            categoriesListContainer.innerHTML = '<p>No categories found.</p>';
            return;
        }
        let html = '<table class="data-table">';
        html += '<thead><tr><th>Name</th><th>ID</th><th>Actions</th></tr></thead>';
        html += '<tbody>';
        categories.forEach(category => {
            html += `<tr>
                <td>${category.name}</td>
                <td>${category.id}</td>
                <td>
                    <button class="edit-btn" data-id="${category.id}" data-name="${category.name}">Modify</button>
                    <button class="delete-btn" data-id="${category.id}" data-name="${category.name}">Delete</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        categoriesListContainer.innerHTML = html;

        // Add event listeners for new edit and delete buttons
        document.querySelectorAll('#categories-list-container .edit-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const categoryId = event.target.dataset.id;
                const categoryName = event.target.dataset.name;
                populateFormForEdit({ id: categoryId, name: categoryName });
            });
        });

        document.querySelectorAll('#categories-list-container .delete-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const categoryId = event.target.dataset.id;
                const categoryName = event.target.dataset.name;
                handleDeleteCategory(categoryId, categoryName);
            });
        });
    }

    // Function to populate form for editing
    function populateFormForEdit(category) {
        editCategoryIdInput.value = category.id;
        categoryNameInput.value = category.name;
        formSubmitButton.textContent = 'Update Category';
        cancelEditBtn.style.display = 'inline-block';
        window.scrollTo({ top: addCategoryForm.offsetTop - 20, behavior: 'smooth' });
    }

    // Function to reset the form
    function resetForm() {
        addCategoryForm.reset();
        editCategoryIdInput.value = '';
        formSubmitButton.textContent = 'Add Category';
        cancelEditBtn.style.display = 'none';
    }

    // Function to handle adding or updating a category
    async function addOrUpdateCategory(event) {
        event.preventDefault();
        const categoryName = categoryNameInput.value.trim();
        const categoryId = editCategoryIdInput.value;

        if (!categoryName) {
            alert('Category name cannot be empty.');
            return;
        }

        const method = categoryId ? 'PUT' : 'POST';
        const endpoint = categoryId ? `/api/categories/${categoryId}` : '/api/categories';

        try {
            const response = await fetch(endpoint, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: categoryName }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: `Failed to ${categoryId ? 'update' : 'add'} category. Server returned an error.` }));
                throw new Error(errorData.message || `HTTP error! ${response.status}`);
            }
            
            resetForm();
            fetchCategories(); // Refresh the list
            alert(`Category ${categoryId ? 'updated' : 'added'} successfully!`);
        } catch (error) {
            console.error(`Error ${categoryId ? 'updating' : 'adding'} category:`, error);
            alert(`Error ${categoryId ? 'updating' : 'adding'} category: ${error.message}`);
        }
    }

    // Function to handle deleting a category
    async function handleDeleteCategory(categoryId, categoryName) {
        if (!confirm(`Are you sure you want to delete the category "${categoryName}" (ID: ${categoryId})? This might affect resources associated with this category.`)) {
            return;
        }
        try {
            const response = await fetch(`/api/categories/${categoryId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                let errorData = { message: `Request failed with status: ${response.status} ${response.statusText}` };
                 if (response.status !== 204) { // 204 No Content might not have a JSON body
                    try {
                        const serverError = await response.json();
                        errorData.message = serverError.error || serverError.message || errorData.message;
                    } catch (e) {
                        console.warn('Could not parse error response as JSON for DELETE category:', e);
                    }
                }
                throw new Error(errorData.message);
            }
            alert('Category deleted successfully!');
            fetchCategories(); // Refresh the list
        } catch (error) {
            console.error('Error deleting category:', error.message, error.stack);
            alert(`Error deleting category: ${error.message}`);
        }
    }

    // Add event listener for the form submission
    if (addCategoryForm) {
        addCategoryForm.addEventListener('submit', addOrUpdateCategory);
    }

    // Add event listener for the cancel button
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', resetForm);
    }

    // Initial fetch of categories
    fetchCategories();
});
