const pool = require('../config/db');

async function withTransaction(operation, retries = 3) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');

    const result = await operation(client);

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');

    // PostgreSQL serialization failure code
    if (error.code === '40001' && retries > 0) {
      return await withTransaction(operation, retries - 1);
    }

    throw error;
  } finally {
    client.release();
  }
}

module.exports = withTransaction;