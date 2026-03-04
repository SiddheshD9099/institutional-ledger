const riskRepository = require('../repositories/riskRepository');
const AppError = require('../errors/AppError');

class RiskService {
  async validateTransfer(client, accountId, amount) {

    const limits = await riskRepository.getLimits(client, accountId);

    if (!limits) return; // No limits defined

    if (amount > parseFloat(limits.per_tx_limit)) {
      throw new AppError('Per transaction limit exceeded', 400);
    }

    const todayTotal =
      await riskRepository.getTodayDebitTotal(client, accountId);

    if (todayTotal + amount > parseFloat(limits.daily_limit)) {
      throw new AppError('Daily transfer limit exceeded', 400);
    }
  }
}

module.exports = new RiskService();