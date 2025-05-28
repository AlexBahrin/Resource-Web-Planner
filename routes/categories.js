const pool = require('../config/dbConfig');
const { parseJsonBody } = require('../util/requestUtils');

async function handleCategories(req, res) {
    const { method, path } = req;
    const pathParts = path.split('/').filter(Boolean); // e.g., ['api', 'categories', '1']

    // GET /api/categories - Fetch all categories
    if (method === 'GET' && path === '/api/categories') {
        try {
            const result = await pool.query('SELECT * FROM categories ORDER BY name ASC');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.rows));
        } catch (error) {
            console.error('Error fetching categories:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Error fetching categories from database.', error: error.message }));
        }
        return true;
    }

    // POST /api/categories - Add a new category
    if (method === 'POST' && path === '/api/categories') {
        try {
            const body = await parseJsonBody(req, res); // parseJsonBody now directly returns the parsed body or handles errors
            if (!body || !body.name || typeof body.name !== 'string' || body.name.trim() === '') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Category name is required and must be a non-empty string.' }));
                return true;
            }
            const categoryName = body.name.trim();
            // Check for duplicates
            const existingCategory = await pool.query('SELECT * FROM categories WHERE name = $1', [categoryName]);
            if (existingCategory.rows.length > 0) {
                res.writeHead(409, { 'Content-Type': 'application/json' }); // 409 Conflict
                res.end(JSON.stringify({ message: 'Category with this name already exists.' }));
                return true;
            }

            const result = await pool.query('INSERT INTO categories (name) VALUES ($1) RETURNING *', [categoryName]);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.rows[0]));
        } catch (error) {
            // Differentiate between parsing errors (handled by parseJsonBody) and DB errors
            if (!res.headersSent) { // If parseJsonBody handled the response, headers would be sent
                console.error('Error adding category:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Error adding category to database.', error: error.message }));
            }
        }
        return true;
    }

    // PUT /api/categories/:id - Update a category
    if (method === 'PUT' && pathParts[0] === 'api' && pathParts[1] === 'categories' && pathParts.length === 3) {
        const id = parseInt(pathParts[2]);
        if (isNaN(id)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Invalid category ID format.' }));
            return true;
        }
        try {
            const body = await parseJsonBody(req, res);
            if (!body || !body.name || typeof body.name !== 'string' || body.name.trim() === '') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Category name is required and must be a non-empty string.' }));
                return true;
            }
            const categoryName = body.name.trim();

            // Check if category with this ID exists
            const existingById = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
            if (existingById.rows.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Category not found.' }));
                return true;
            }

            // Check for name conflict (optional: allow renaming to current name, but prevent conflict with *other* categories)
            const existingByName = await pool.query('SELECT * FROM categories WHERE name = $1 AND id != $2', [categoryName, id]);
            if (existingByName.rows.length > 0) {
                res.writeHead(409, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Another category with this name already exists.' }));
                return true;
            }

            const result = await pool.query('UPDATE categories SET name = $1 WHERE id = $2 RETURNING *', [categoryName, id]);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.rows[0]));
        } catch (error) {
            if (!res.headersSent) {
                console.error('Error updating category:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Error updating category in database.', error: error.message }));
            }
        }
        return true;
    }

    // DELETE /api/categories/:id - Delete a category
    if (method === 'DELETE' && pathParts[0] === 'api' && pathParts[1] === 'categories' && pathParts.length === 3) {
        const id = parseInt(pathParts[2]);
        if (isNaN(id)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Invalid category ID format.' }));
            return true;
        }
        try {
            // Before deleting, check if any resources are using this category
            const resourcesUsingCategory = await pool.query('SELECT COUNT(*) FROM resources WHERE category_id = $1', [id]);
            if (parseInt(resourcesUsingCategory.rows[0].count, 10) > 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' }); // Or 409 Conflict
                res.end(JSON.stringify({ message: 'Cannot delete category: It is currently associated with one or more resources. Please reassign or delete those resources first.' }));
                return true;
            }

            const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
            if (result.rowCount === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Category not found.' }));
            } else {
                res.writeHead(204, { 'Content-Type': 'application/json' }); // No Content
                res.end();
            }
        } catch (error) {
            console.error('Error deleting category:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Error deleting category from database.', error: error.message }));
        }
        return true;
    }
    
    // Note: HTML serving for /categories (GET) is handled in index.js directly for now.
    // If more complex server-side rendering for categories page is needed later,
    // that logic could be expanded here or in routes/pages.js

    return false; // Route not handled by this handler
}

module.exports = { handleCategories };
