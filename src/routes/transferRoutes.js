console.log("transferRoutes loaded");
const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');

router.post('/', (req, res, next) =>
  transferController.execute(req, res, next)
);

module.exports = router;