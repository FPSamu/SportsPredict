const express = require('express');
const router = express.Router();
const matchController = require('../controllers/match.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/upcoming', protect, matchController.getUpcomingMatches);

router.get('/recent', protect, matchController.getRecentMatches);

router.get('/:id', protect, matchController.getMatchById);

module.exports = router;