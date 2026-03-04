class RiskRepository {
  async getLimits(client, accountId) {
    const query = `
      SELECT * FROM account_limits
      WHERE account_id = $1;
    `;
    const result = await client.query(query, [accountId]);
    return result.rows[0];
  }

  async getTodayDebitTotal(client, accountId) {
    const query = `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM ledger_entries
      WHERE account_id = $1
      AND entry_type = 'DEBIT'
      AND created_at::date = CURRENT_DATE;
    `;

    const result = await client.query(query, [accountId]);
    return parseFloat(result.rows[0].total);
  }
}

module.exports = new RiskRepository();