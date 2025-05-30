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

        // Add new columns for category resource field enablement
        try {
            await pool.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS enable_quantity BOOLEAN DEFAULT TRUE;');
            console.log("Column enable_quantity ensured in categories table.");
        } catch (e) {
            console.warn("Could not add/verify enable_quantity column in categories table:", e.message);
        }
        try {
            await pool.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS enable_low_stock_threshold BOOLEAN DEFAULT TRUE;');
            console.log("Column enable_low_stock_threshold ensured in categories table.");
        } catch (e) {
            console.warn("Could not add/verify enable_low_stock_threshold column in categories table:", e.message);
        }
        try {
            await pool.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS enable_expiration_date BOOLEAN DEFAULT TRUE;');
            console.log("Column enable_expiration_date ensured in categories table.");
        } catch (e) {
            console.warn("Could not add/verify enable_expiration_date column in categories table:", e.message);
        }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS resources
            (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
                quantity NUMERIC(10, 2) DEFAULT 0.00,
                description TEXT,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                low_stock_threshold NUMERIC(10, 2) DEFAULT 0.00,
                expiration_date DATE,
                UNIQUE (name, user_id, group_id)
            );
        `);

        // Ensure columns exist and have the correct type, add if not present or alter if type is different.
        // This is a more robust way to handle schema evolution.

        const columnsToEnsure = [
            { name: 'name', type: 'VARCHAR(255)', nullable: false },
            { name: 'category_id', type: 'INTEGER', references: 'categories(id) ON DELETE CASCADE' },
            { name: 'quantity', type: 'NUMERIC(10, 2)', default: '0.00' },
            { name: 'description', type: 'TEXT', nullable: true },
            { name: 'user_id', type: 'INTEGER', references: 'users(id) ON DELETE SET NULL', nullable: true },
            { name: 'group_id', type: 'INTEGER', references: 'groups(id) ON DELETE SET NULL', nullable: true },
            { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'TIMESTAMP WITH TIME ZONE', default: 'CURRENT_TIMESTAMP' },
            { name: 'low_stock_threshold', type: 'NUMERIC(10, 2)', default: '0.00' },
            { name: 'expiration_date', type: 'DATE', nullable: true }
        ];

        for (const col of columnsToEnsure) {
            try {
                // Check if column exists
                const checkColExists = await pool.query(
                    `SELECT column_name, data_type, numeric_precision, numeric_scale FROM information_schema.columns 
                     WHERE table_schema = 'public' AND table_name = 'resources' AND column_name = $1;`,
                    [col.name]
                );

                if (checkColExists.rows.length === 0) {
                    let columnDefinition = `${col.name} ${col.type}`;
                    if (col.default !== undefined) columnDefinition += ` DEFAULT ${col.default}`;
                    if (col.nullable === false) columnDefinition += ' NOT NULL';
                    if (col.references) columnDefinition += ` REFERENCES ${col.references}`;
                    await pool.query(`ALTER TABLE resources ADD COLUMN IF NOT EXISTS ${columnDefinition};`);
                    console.log(`Column ${col.name} added to resources table.`);
                } else {
                    // Column exists, check type for quantity and low_stock_threshold
                    const existingCol = checkColExists.rows[0];
                    if ((col.name === 'quantity' || col.name === 'low_stock_threshold') && 
                        (existingCol.data_type !== 'numeric' || existingCol.numeric_precision !== 10 || existingCol.numeric_scale !== 2)) {
                        
                        // Preserve data by casting, then change type. Add USING clause.
                        // It's safer to handle data migration explicitly if there's a risk of data loss or format issues.
                        // For INTEGER to NUMERIC, direct casting is usually fine.
                        await pool.query(`ALTER TABLE resources ALTER COLUMN ${col.name} TYPE ${col.type} USING ${col.name}::${col.type};`);
                        console.log(`Column ${col.name} in resources table altered to type ${col.type}.`);
                        // Re-apply default if it was dropped or changed during type alteration
                        if (col.default !== undefined) {
                           await pool.query(`ALTER TABLE resources ALTER COLUMN ${col.name} SET DEFAULT ${col.default};`);
                           console.log(`Default for column ${col.name} set to ${col.default}.`);
                        }
                    } else if (existingCol.data_type.toUpperCase() !== col.type.split('(')[0].toUpperCase() && !(col.type.startsWith('VARCHAR') && existingCol.data_type === 'character varying') && !(col.type.startsWith('TIMESTAMP') && existingCol.data_type === 'timestamp with time zone') && !(col.type === 'TEXT' && existingCol.data_type === 'text')) {
                        // This is a simplified check. More complex type changes might need specific USING clauses.
                        // For now, we only explicitly handle numeric types above.
                        console.warn(`Column ${col.name} exists but its type (${existingCol.data_type}) might not match the desired type (${col.type}). Manual review might be needed.`);
                    }
                }
            } catch (e) {
                console.warn(`Could not add/verify/alter column ${col.name} in resources table:`, e.message);
            }
        }
        
        // Ensure UNIQUE constraint exists (name, user_id, group_id)
        // This is a bit more complex to make idempotent if the constraint name is unknown or varies.
        // For simplicity, we'll try to add it; if it exists, it might throw an error that can be caught or ignored if it's about duplication.
        try {
            await pool.query('ALTER TABLE resources ADD CONSTRAINT resources_name_user_id_group_id_key UNIQUE (name, user_id, group_id);');
            console.log("UNIQUE constraint on (name, user_id, group_id) ensured for resources table.");
        } catch (e) {
            if (e.code === '42P07') { // 42P07 is "duplicate_object" for constraints
                console.log("UNIQUE constraint on (name, user_id, group_id) already exists for resources table.");
            } else {
                console.warn("Could not add UNIQUE constraint on (name, user_id, group_id) for resources table. It might exist with a different name or there's another issue:", e.message);
            }
        }


        console.log("Resources table schema ensured.");
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
