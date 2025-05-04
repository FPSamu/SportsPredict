// BACKEND/routes/match.routes.js
const express = require('express');
const router = express.Router();
const matchController = require('../controllers/match.controller');
// <<< Importar el middleware >>>
const { protect } = require('../middleware/auth.middleware');

// --- Aplicar 'protect' a las rutas ---

// GET /api/matches/upcoming?sport=...&limit=...&page=...&days=...&leagueId=...
router.get('/upcoming', protect, matchController.getUpcomingMatches); // Protegida

// GET /api/matches/recent?sport=...&limit=...&page=...&days=...&leagueId=...
router.get('/recent', protect, matchController.getRecentMatches); // Protegida

// GET /api/matches/:id
router.get('/:id', protect, matchController.getMatchById); // Protegida

// GET /api/matches/trending (La añadiremos después, también irá protegida)
// router.get('/trending', protect, matchController.getTrendingMatches);

module.exports = router;