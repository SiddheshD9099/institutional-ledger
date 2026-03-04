const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');

router.post('/', (req, res, next) =>
  accountController.create(req, res, next)
);

router.get('/:id', (req, res, next) =>
  accountController.getById(req, res, next)
);

module.exports = router;
