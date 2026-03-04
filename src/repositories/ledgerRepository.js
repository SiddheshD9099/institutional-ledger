const { parse } = require("dotenv");

class LedgerRepository {
  async createEntry(client, transactionId, accountId, entryType, amount) {
    const query = `
      INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

    const values = [transactionId, accountId, entryType, amount];
    const result = await client.query(query, values);
    return result.rows[0];
  }
  async getAccountBalance(client, accountId) {
    const query = `
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN entry_type = 'CREDIT' THEN amount
              WHEN entry_type = 'DEBIT' THEN -amount
            END
          ), 0
        ) AS balance
      FROM ledger_entries
      WHERE account_id = $1;
    `;
    const result = await client.query(query, [accountId]);
    return parseFloat(result.rows[0].balance);
  }
}

module.exports = new LedgerRepository();