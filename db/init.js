const pool = require('../config/dbConfig');

async function initializeDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS groups
            (
                id
                SERIAL
                PRIMARY
                KEY,
                name
                VARCHAR
            (
                255
            ) UNIQUE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                                         );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS users
            (
                id
                SERIAL
                PRIMARY
                KEY,
                username
                VARCHAR
            (
                255
            ) UNIQUE NOT NULL,
                email VARCHAR
            (
                255
            ) UNIQUE NOT NULL,
                password_hash VARCHAR
            (
                255
            ) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                                         role VARCHAR (50) DEFAULT 'user',
                group_id INTEGER REFERENCES groups
            (
                id
            )
                                     ON DELETE SET NULL DEFAULT NULL
                );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS categories
            (
                id
                SERIAL
                PRIMARY
                KEY,
                name
                VARCHAR
            (
                255
            ) UNIQUE NOT NULL,
                user_id INTEGER REFERENCES users
            (
                id
            ) ON DELETE SET NULL DEFAULT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP
              WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                  );
        `);

        try {
            await pool.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL DEFAULT NULL;');
            console.log("Column user_id ensured in categories table.");
        } catch (e) {
            console.warn("Could not add/verify user_id column in categories table:", e.message);
        }
        try {
            await pool.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;');
            console.log("Column created_at ensured in categories table.");
        } catch (e) {
            console.warn("Could not add/verify created_at column in categories table:", e.message);
        }
        try {
            await pool.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;');
            console.log("Column updated_at ensured in categories table.");
        } catch (e) {
            console.warn("Could not add/verify updated_at column in categories table:", e.message);
        }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS resources
            (
                id
                SERIAL
                PRIMARY
                KEY,
                name
                VARCHAR
            (
                255
            ) NOT NULL,
                description TEXT,
                quantity INTEGER NOT NULL,
                low_stock_threshold INTEGER DEFAULT 0,
                category_id INTEGER REFERENCES categories
            (
                id
            ) ON DELETE SET NULL,
                user_id INTEGER REFERENCES users
            (
                id
            )
              ON DELETE CASCADE,
                expiration_date DATE DEFAULT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP
              WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                  );
        `);

        try {
            await pool.query('ALTER TABLE resources ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;');
            console.log("Column user_id ensured in resources table.");
        } catch (e) {
            console.warn("Could not add/verify user_id column in resources table:", e.message);
        }

        try {
            await pool.query('ALTER TABLE resources ADD COLUMN IF NOT EXISTS expiration_date DATE DEFAULT NULL;');
            console.log("Column expiration_date ensured in resources table.");
        } catch (e) {
            console.warn("Could not add/verify expiration_date column in resources table:", e.message);
        }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications
            (
                id
                SERIAL
                PRIMARY
                KEY,
                user_id
                INTEGER
                REFERENCES
                users
            (
                id
            ) ON DELETE CASCADE,
                resource_id INTEGER REFERENCES resources
            (
                id
            )
              ON DELETE SET NULL DEFAULT NULL,
                type VARCHAR
            (
                50
            ) DEFAULT 'general',
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP
              WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                  );
        `);

        try {
            await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL DEFAULT NULL;');
            console.log("Column group_id ensured in users table.");
        } catch (e) {
            console.warn("Could not add/verify group_id column, it might exist with different constraints or another issue occurred:", e.message);
        }

        try {
            await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';");
            console.log("Column role ensured in users table.");
        } catch (e) {
            console.warn("Could not add/verify role column in users table:", e.message);
        }

        try {
            await pool.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS resource_id INTEGER REFERENCES resources(id) ON DELETE SET NULL DEFAULT NULL;');
            console.log("Column resource_id ensured in notifications table.");
        } catch (e) {
            console.warn("Could not add/verify resource_id column in notifications table:", e.message);
        }

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

module.exports = {initializeDatabase};
