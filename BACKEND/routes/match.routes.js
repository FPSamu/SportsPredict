const express = require('express');
const router = express.Router();
const matchController = require('../controllers/match.controller'); // Importamos el controlador (lo crearemos ahora)
// Podríamos añadir el middleware de autenticación aquí si algunas rutas lo necesitaran
// const { protect } = require('../middleware/auth.middleware');

// --- Rutas Públicas (Ejemplos) ---

// GET /api/matches/upcoming?sport=Football&limit=10&page=1&days=7&leagueId=2021
// Obtiene los próximos partidos/juegos
router.get('/upcoming', matchController.getUpcomingMatches);

// GET /api/matches/recent?sport=Basketball&limit=10&page=1&days=7&leagueId=12
// Obtiene los partidos/juegos finalizados recientemente
router.get('/recent', matchController.getRecentMatches);

// GET /api/matches/:id
// Obtiene los detalles de un partido/juego específico por su ID de MongoDB
router.get('/:id', matchController.getMatchById);


// --- Rutas Protegidas (Ejemplo si necesitáramos login para algo) ---
// Ejemplo: router.get('/my-tracked-matches', protect, matchController.getMyTrackedMatches);


module.exports = router;