const { Pool } = require('pg');

const dbConfig = {
  user: 'postgres',
  host: 'localhost',
  database: 'rew_db', 
  password: 'admin',
  port: 5432,
};

const pool = new Pool(dbConfig);

module.exports = pool;
