const accountRepository = require('../repositories/accountRepository');

class AccountService {
  async createAccount(name) {
    if (!name || name.trim() === '') {
      throw new Error('Account name is required');
    }

    return await accountRepository.createAccount(name);
  }

  async getAccountById(id) {
    const account = await accountRepository.findById(id);

    if (!account) {
      throw new Error('Account not found');
    }

    return account;
  }
}

module.exports = new AccountService();
