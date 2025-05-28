const pool = require('../config/dbConfig');
const { parseJsonBody } = require('../util/requestUtils');

async function handleCategories(req, res) {
    const { method, path } = req;
    const pathParts = path.split('/').filter(Boolean);
    const userId = req.userId; 

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

    if (method === 'POST' && path === '/api/categories') {
        try {
            const body = await parseJsonBody(req, res);

            if (!userId) { 
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'User not authenticated.' }));
                return true;
            }

            
            if (!body || !body.name || typeof body.name !== 'string' || body.name.trim() === '') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Category name is required and must be a non-empty string.' }));
                return true;
            }
            const categoryName = body.name.trim();
            
            const existingCategory = await pool.query('SELECT * FROM categories WHERE name = $1 AND user_id = $2', [categoryName, userId]);
            if (existingCategory.rows.length > 0) {
                res.writeHead(409, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Category with this name already exists for this user.' }));
                return true;
            }

            const result = await pool.query('INSERT INTO categories (name, user_id) VALUES ($1, $2) RETURNING *', [categoryName, userId]); 
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.rows[0]));
        } catch (error) {
            if (!res.headersSent) {
                console.error('Error adding category:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Error adding category to database.', error: error.message }));
            }
        }
        return true;
    }

    if (method === 'PUT' && pathParts[0] === 'api' && pathParts[1] === 'categories' && pathParts.length === 3) {
        const id = parseInt(pathParts[2]);
        if (isNaN(id)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Invalid category ID format.' }));
            return true;
        }
        try {
            const body = await parseJsonBody(req, res);

            if (!userId) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'User not authenticated for PUT operation.' }));
                return true;
            }

            if (!body || !body.name || typeof body.name !== 'string' || body.name.trim() === '') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Category name is required and must be a non-empty string.' }));
                return true;
            }
            const categoryName = body.name.trim();

            
            const existingById = await pool.query('SELECT * FROM categories WHERE id = $1 AND user_id = $2', [id, userId]);
            if (existingById.rows.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Category not found or not owned by user.' }));
                return true;
            }

            
            const existingByName = await pool.query('SELECT * FROM categories WHERE name = $1 AND id != $2 AND user_id = $3', [categoryName, id, userId]);
            if (existingByName.rows.length > 0) {
                res.writeHead(409, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Another category with this name already exists for this user.' }));
                return true;
            }

            const result = await pool.query('UPDATE categories SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *', [categoryName, id, userId]);
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

    if (method === 'DELETE' && pathParts[0] === 'api' && pathParts[1] === 'categories' && pathParts.length === 3) {
        const id = parseInt(pathParts[2]);
        if (isNaN(id)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Invalid category ID format.' }));
            return true;
        }
        try {
            if (!userId) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'User not authenticated for DELETE operation.' }));
                return true;
            }

            
            
            const categoryCheck = await pool.query('SELECT user_id FROM categories WHERE id = $1', [id]);
            if (categoryCheck.rows.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Category not found.' }));
                return true;
            }
            if (categoryCheck.rows[0].user_id !== userId) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Forbidden: You do not own this category.' }));
                return true;
            }

            
            
            
            const resourcesUsingCategory = await pool.query('SELECT COUNT(*) FROM resources WHERE category_id = $1 AND user_id = $2', [id, userId]);
            if (parseInt(resourcesUsingCategory.rows[0].count, 10) > 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Cannot delete category: It is currently associated with one or more of your resources. Please reassign or delete those resources first.' }));
                return true;
            }

            const result = await pool.query('DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId]);
            if (result.rowCount === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Category not found or not authorized to delete.' }));
            } else {
                res.writeHead(204, { 'Content-Type': 'application/json' });
                res.end();
            }
        } catch (error) {
            console.error('Error deleting category:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Error deleting category from database.', error: error.message }));
        }
        return true;
    }

    return false;
}

module.exports = { handleCategories };
