const express = require('express');
const router = express.Router();
const matchController = require('../controllers/match.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/upcoming', protect, matchController.getUpcomingMatches); // Protegida
router.get('/recent', protect, matchController.getRecentMatches); // Protegida
router.get('/:id', protect, matchController.getMatchById); // Protegida

module.exports = router;