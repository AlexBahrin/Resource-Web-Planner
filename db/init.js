const pool = require('../config/dbConfig');

async function initializeDatabase() {
  try {
    // Create groups table first due to foreign key constraint in users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Groups table checked/created successfully.");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        role VARCHAR(50) DEFAULT 'user', -- Added role column
        group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL DEFAULT NULL
      );
    `);
    console.log("Users table checked/created successfully.");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL
      );
    `);
    console.log("Categories table checked/created successfully.");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS resources (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        quantity INTEGER NOT NULL,
        low_stock_threshold INTEGER DEFAULT 0,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Resources table checked/created successfully.");

    // Migration: Ensure 'low_stock_threshold' column exists, renaming 'threshold' if necessary
    try {
      const oldColumnInfo = await pool.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='resources' AND table_schema='public' AND column_name='threshold'
      `);
      const newColumnInfo = await pool.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='resources' AND table_schema='public' AND column_name='low_stock_threshold'
      `);

      if (oldColumnInfo.rowCount > 0 && newColumnInfo.rowCount === 0) {
        await pool.query('ALTER TABLE public.resources RENAME COLUMN threshold TO low_stock_threshold;');
        console.log("Column 'threshold' successfully renamed to 'low_stock_threshold' in 'resources' table.");
      } else if (oldColumnInfo.rowCount > 0 && newColumnInfo.rowCount > 0) {
        // Both columns exist. This is an unusual state.
        // Assuming 'low_stock_threshold' is the correct one and 'threshold' is a remnant.
        // You might consider dropping the old 'threshold' column if you are certain it's redundant.
        // For now, we'll log a warning.
        // Example: await pool.query('ALTER TABLE public.resources DROP COLUMN threshold;');
        console.warn("Warning: Both 'threshold' and 'low_stock_threshold' columns exist in 'resources' table. 'threshold' may be redundant.");
      } else if (oldColumnInfo.rowCount === 0 && newColumnInfo.rowCount === 0) {
        // Neither column exists. The CREATE TABLE statement should have created 'low_stock_threshold'.
        // This indicates a potential issue with the CREATE TABLE logic or a prior manual modification.
        // As a fallback, attempt to add the 'low_stock_threshold' column.
        await pool.query('ALTER TABLE public.resources ADD COLUMN low_stock_threshold INTEGER DEFAULT 0;');
        console.log("Column 'low_stock_threshold' added to 'resources' table as it was missing.");
      }
      // If oldColumnInfo.rowCount === 0 && newColumnInfo.rowCount > 0, the column is correctly named, so no action is needed.
    } catch (e) {
      // Log error but allow initialization to continue if possible, as other tables might be fine.
      console.error("Error during 'resources' table migration for 'low_stock_threshold':", e.message);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        resource_id INTEGER REFERENCES resources(id) ON DELETE SET NULL DEFAULT NULL, -- Added resource_id
        type VARCHAR(50) DEFAULT 'general', -- Added type column
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Notifications table checked/created successfully.");

    // Update users table to add group_id if it doesn't exist (idempotent)
    // This is more robust than dropping and adding if other columns depend on it.
    try {
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL DEFAULT NULL;');
      console.log("Column group_id ensured in users table.");
    } catch (e) {
      // Catch error if column exists but with a different constraint, etc.
      // For a simple ADD COLUMN IF NOT EXISTS, this might not be strictly necessary
      // but good for more complex ALTER statements.
      console.warn("Could not add/verify group_id column, it might exist with different constraints or another issue occurred:", e.message);
    }
    
    // Add role column to users table if it doesn't exist
    try {
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';");
      console.log("Column role ensured in users table.");
    } catch (e) {
      console.warn("Could not add/verify role column in users table:", e.message);
    }

    // Add resource_id column to notifications table if it doesn't exist
    try {
      await pool.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS resource_id INTEGER REFERENCES resources(id) ON DELETE SET NULL DEFAULT NULL;');
      console.log("Column resource_id ensured in notifications table.");
    } catch (e) {
      console.warn("Could not add/verify resource_id column in notifications table:", e.message);
    }

    // Add type column to notifications table if it doesn't exist
    try {
      await pool.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'general';");
      console.log("Column type ensured in notifications table.");
    } catch (e) {
      console.warn("Could not add/verify type column in notifications table:", e.message);
    }

    console.log("Database initialization complete.");
  } catch (err) {
    console.error('Error initializing database tables:', err.stack);
  } 
}

module.exports = { initializeDatabase };
