const pool = require('../config/db');

class AccountRepository {
  async createAccount(name) {
    const query = `
      INSERT INTO accounts (name)
      VALUES ($1)
      RETURNING *;
    `;
    const values = [name];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async findById(id) {
    const query = `
      SELECT * FROM accounts
      WHERE id = $1;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  async lockAccountById(client, id) {
    const query = `
      SELECT * FROM accounts
      WHERE id = $1
      FOR UPDATE;
    `;
    
    const result = await client.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = new AccountRepository();
