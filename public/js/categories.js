document.addEventListener('DOMContentLoaded', () => {
    const categoriesList = document.getElementById('categories-list');
    const addCategoryForm = document.getElementById('add-category-form');
    const categoryNameInput = document.getElementById('category-name');

    // Function to fetch and display categories
    async function fetchCategories() {
        try {
            const response = await fetch('/api/categories');
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to load categories. Server returned an error.' }));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            const categories = await response.json();
            renderCategories(categories);
        } catch (error) {
            console.error('Error fetching categories:', error);
            categoriesList.innerHTML = `<li>Error loading categories: ${error.message}</li>`;
        }
    }

    // Function to render categories in the list
    function renderCategories(categories) {
        if (!categories || categories.length === 0) {
            categoriesList.innerHTML = '<li>No categories found.</li>';
            return;
        }
        categoriesList.innerHTML = categories.map(category => 
            `<li>${category.name} (ID: ${category.id})</li>`
        ).join('');
    }

    // Function to handle adding a new category
    async function addCategory(event) {
        event.preventDefault();
        const categoryName = categoryNameInput.value.trim();
        if (!categoryName) {
            alert('Category name cannot be empty.');
            return;
        }

        try {
            const response = await fetch('/api/categories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: categoryName }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to add category. Server returned an error.' }));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            // const newCategory = await response.json(); // Assuming the server returns the new category
            categoryNameInput.value = ''; // Clear the input
            fetchCategories(); // Refresh the list
            alert('Category added successfully!');
        } catch (error) {
            console.error('Error adding category:', error);
            alert(`Error adding category: ${error.message}`);
        }
    }

    // Add event listener for the form submission
    if (addCategoryForm) {
        addCategoryForm.addEventListener('submit', addCategory);
    }

    // Initial fetch of categories
    fetchCategories();
});
