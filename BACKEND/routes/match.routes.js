const express = require('express');
const router = express.Router();
const matchController = require('../controllers/match.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/upcoming', protect, matchController.getUpcomingMatches);

router.get('/recent', protect, matchController.getRecentMatches);

router.get('/trending', protect, matchController.getTrendingMatches);

router.get('/:id', protect, matchController.getMatchById);

router.get('/:matchId/predictions', protect, matchController.getMatchPredictions); // <<< NUEVA RUTA

module.exports = router;