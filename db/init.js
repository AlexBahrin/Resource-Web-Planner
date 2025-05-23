// Database initialization - creates tables if they don't exist

const pool = require('../config/dbConfig');

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE
      );
    `);
    console.log('Categories table checked/created.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS resources (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category_id INTEGER REFERENCES categories(id),
        quantity INTEGER,
        description TEXT,
        added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        low_stock_threshold INTEGER DEFAULT 5
      );
    `);
    console.log('Resources table checked/created.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL, -- Store hashed passwords only!
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Users table checked/created.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        message TEXT NOT NULL,
        resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- Optional: if notification is user-specific
        type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_read BOOLEAN DEFAULT FALSE
      );
    `);
    console.log('Notifications table checked/created.');

  } catch (err) {
    console.error('Error initializing database tables:', err.stack);
  } finally {
    client.release();
  }
}

module.exports = { initializeDatabase };
