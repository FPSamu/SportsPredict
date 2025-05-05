const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.post('/verify-token', authController.verifyFirebaseToken);

module.exports = router;