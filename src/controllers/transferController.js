const transferService = require('../services/transferService');
const AppError = require('../errors/AppError');

class TransferController {
  async execute(req, res, next) {
    try {
      const { fromAccountId, toAccountId, amount, idempotencyKey } = req.body;
      if (!fromAccountId || !toAccountId || !amount || !idempotencyKey) {
        throw new AppError('Missing required fields', 400);
      }

      if (isNaN(amount) || parseFloat(amount) <= 0) {
        throw new AppError('Invalid transfer amount', 400);
  }

      const result = await transferService.transfer(
        fromAccountId,
        toAccountId,
        parseFloat(amount),
        idempotencyKey
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TransferController();