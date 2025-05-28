const pool = require('../config/dbConfig');

async function handleStatistics(req, res) {
  const path = req.path;
  const method = req.method;
  const userId = req.userId;
  
  // Endpoint for getting summary statistics
  if (path === '/api/statistics/summary' && method === 'GET') {
    if (!userId) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'User not authenticated.' }));
      return true;
    }
    
    try {
      // Query 1: Get total count of resources by category
      const categoryQuery = `
        SELECT c.id, c.name, COUNT(r.id) as resource_count
        FROM categories c
        LEFT JOIN resources r ON c.id = r.category_id AND r.user_id = $1
        WHERE c.user_id = $1 OR c.user_id IS NULL
        GROUP BY c.id, c.name
        ORDER BY c.name
      `;
      const categoryResult = await pool.query(categoryQuery, [userId]);
      
      // Query 2: Get stock status statistics
      const stockQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE quantity <= low_stock_threshold) as low_stock_count,
          COUNT(*) FILTER (WHERE quantity > low_stock_threshold) as normal_stock_count
        FROM resources
        WHERE user_id = $1
      `;
      const stockResult = await pool.query(stockQuery, [userId]);
      
      // Query 3: Get quantity distribution
      const quantityQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE quantity = 0) as zero_count,
          COUNT(*) FILTER (WHERE quantity BETWEEN 1 AND 10) as one_to_ten_count,
          COUNT(*) FILTER (WHERE quantity BETWEEN 11 AND 50) as eleven_to_fifty_count,
          COUNT(*) FILTER (WHERE quantity BETWEEN 51 AND 100) as fifty_one_to_hundred_count,
          COUNT(*) FILTER (WHERE quantity BETWEEN 101 AND 500) as hundred_one_to_five_hundred_count,
          COUNT(*) FILTER (WHERE quantity > 500) as over_five_hundred_count
        FROM resources
        WHERE user_id = $1
      `;
      const quantityResult = await pool.query(quantityQuery, [userId]);
      
      // Return combined statistics
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        categoriesData: categoryResult.rows,
        stockData: stockResult.rows[0],
        quantityData: quantityResult.rows[0]
      }));
      
    } catch (error) {
      console.error('Database error fetching statistics:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Error generating statistics', details: error.message }));
    }
    
    return true;
  }
  
  // If no matching endpoint is found, return false to allow other handlers to process the request
  return false;
}

module.exports = { handleStatistics };
