const pool = require('../config/db');

class TransactionRepository {
  async createTransaction(client, idempotencyKey, type) {
    const query = `
      INSERT INTO transactions (idempotency_key, type)
      VALUES ($1, $2)
      ON CONFLICT (idempotency_key)
      DO NOTHING
      RETURNING *;
    `;

    const result = await client.query(query, [idempotencyKey, type]);

    if (result.rows.length > 0) {
      return { transaction: result.rows[0], isNew: true };
    }

    const existing = await this.findByIdempotencyKey(client, idempotencyKey);
    return { transaction: existing, isNew: false };
  }

  async findByIdempotencyKey(client, idempotencyKey) {
    const query = `
      SELECT * FROM transactions
      WHERE idempotency_key = $1;
    `;

    const result = await client.query(query, [idempotencyKey]);
    return result.rows[0];
  }

  async markCompleted(client, transactionId) {
    const query = `
      UPDATE transactions
      SET status = 'COMPLETED'
      WHERE id = $1
      RETURNING *;
    `;
    const result = await client.query(query, [transactionId]);
    return result.rows[0];
  }
  
}

module.exports = new TransactionRepository();