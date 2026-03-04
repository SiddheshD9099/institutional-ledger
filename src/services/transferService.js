const withTransaction = require('../utils/dbTransaction');
const accountRepository = require('../repositories/accountRepository');
const transactionRepository = require('../repositories/transactionRepository');
const ledgerRepository = require('../repositories/ledgerRepository');
const riskService = require('./riskService');
const AppError = require('../errors/AppError');
const { v4: uuidv4 } = require('uuid');

class TransferService {
  async transfer(fromAccountId, toAccountId, amount, idempotencyKey) {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    return await withTransaction(async (client) => {

      // Lock accounts
      const sortedIds = [fromAccountId, toAccountId].sort();

      const firstLock = await accountRepository.lockAccountById(client, sortedIds[0]);
      const secondLock = await accountRepository.lockAccountById(client, sortedIds[1]);

      // Map back correctly
      const fromAccount = sortedIds[0] === fromAccountId ? firstLock : secondLock;
      const toAccount = sortedIds[1] === toAccountId ? secondLock : firstLock;
      

      if (!fromAccount || !toAccount) {
        throw new AppError('Account not found', 404);
      }

      // Get balance
      const balance = await ledgerRepository.getAccountBalance(client, fromAccountId);

      if (balance < amount) {
        throw new AppError('Insufficient funds', 400);
      }

      // Add Risk Validation HERE
      await riskService.validateTransfer(client, fromAccountId, amount);

      // Create business transaction
      const { transaction, isNew } =
        await transactionRepository.createTransaction(
          client,
          idempotencyKey,
          'TRANSFER'
        );

      if (!isNew) {
        return transaction; // Already processed, do not insert ledger again
      }

      // Insert DEBIT
      await ledgerRepository.createEntry(
        client,
        transaction.id,
        fromAccountId,
        'DEBIT',
        amount
      );

      // Insert CREDIT
      await ledgerRepository.createEntry(
        client,
        transaction.id,
        toAccountId,
        'CREDIT',
        amount
      );

      const updatedTx =
      await transactionRepository.markCompleted(client, transaction.id);

      return updatedTx;

      await transactionRepository.markCompleted(client, transaction.id);

      return transaction;
    });
  }
}

module.exports = new TransferService();