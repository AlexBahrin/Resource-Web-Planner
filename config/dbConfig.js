const { Pool } = require('pg');

const dbConfig = {
  user: 'postgre',
  host: 'dpg-d0s8bsruibrs73b7i7pg-a',
  database: 'rew_db', 
  password: 'xpp08ThAsLT16QbGJVeV3Rjqls98lZNl',
  port: 5432,
};

const pool = new Pool(dbConfig);

module.exports = pool;
