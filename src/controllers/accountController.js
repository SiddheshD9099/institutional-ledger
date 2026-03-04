const accountService = require('../services/accountService');

class AccountController {
  async create(req, res, next) {
    try {
      const { name } = req.body;
      const account = await accountService.createAccount(name);

      res.status(201).json(account);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const account = await accountService.getAccountById(id);

      res.status(200).json(account);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AccountController();
