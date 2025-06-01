const pool = require('../config/dbConfig');

async function handleStatistics(req, res) {
  const path = req.path;
  const method = req.method;
  const userId = req.userId;
  
  if (path === '/api/statistics/summary' && method === 'GET') {
    if (!userId) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'User not authenticated.' }));
      return true;
    }
    
    try {
      const userGroupRes = await pool.query('SELECT group_id FROM users WHERE id = $1', [userId]);
      const groupId = userGroupRes.rows.length > 0 ? userGroupRes.rows[0].group_id : null;

      let targetUserIds = [userId];
      if (groupId) {
        const groupMembersRes = await pool.query('SELECT id FROM users WHERE group_id = $1', [groupId]);
        targetUserIds = groupMembersRes.rows.map(row => row.id);
      }

      const categoryQuery = `
        SELECT c.id, c.name, COUNT(r.id) as resource_count
        FROM categories c
        LEFT JOIN resources r ON c.id = r.category_id AND r.user_id = ANY($1::int[])
        WHERE c.user_id = ANY($1::int[]) OR c.user_id IS NULL
        GROUP BY c.id, c.name
        ORDER BY c.name
      `;
      const categoryResult = await pool.query(categoryQuery, [targetUserIds]);
      
      const stockQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE r.quantity <= r.low_stock_threshold AND c.enable_low_stock_threshold = true) as low_stock_count,
          COUNT(*) FILTER (WHERE r.quantity > r.low_stock_threshold OR c.enable_low_stock_threshold = false) as normal_stock_count
        FROM resources r
        JOIN categories c ON r.category_id = c.id
        WHERE r.user_id = ANY($1::int[])
      `;
      const stockResult = await pool.query(stockQuery, [targetUserIds]);
      
      const quantityQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE quantity = 0) as zero_count,
          COUNT(*) FILTER (WHERE quantity BETWEEN 1 AND 10) as one_to_ten_count,
          COUNT(*) FILTER (WHERE quantity BETWEEN 11 AND 50) as eleven_to_fifty_count,
          COUNT(*) FILTER (WHERE quantity BETWEEN 51 AND 100) as fifty_one_to_hundred_count,
          COUNT(*) FILTER (WHERE quantity BETWEEN 101 AND 500) as hundred_one_to_five_hundred_count,
          COUNT(*) FILTER (WHERE quantity > 500) as over_five_hundred_count
        FROM resources
        WHERE user_id = ANY($1::int[])
      `;
      const quantityResult = await pool.query(quantityQuery, [targetUserIds]);
      
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
  
  return false;
}

module.exports = { handleStatistics };
