// BACKEND/routes/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');

// GET /api/users/me - Obtener perfil del usuario logueado
router.get('/me', protect, userController.getMyProfile);

// GET /api/users/me/favorites - Obtener lista de equipos favoritos del usuario logueado
router.get('/me/favorites', protect, userController.getMyFavorites);

// POST /api/users/me/favorites - Añadir un equipo a favoritos
// Espera un cuerpo JSON: { "sport": "Football", "apiTeamId": 66 }
router.post('/me/favorites', protect, userController.addFavoriteTeam);

// DELETE /api/users/me/favorites - Eliminar un equipo de favoritos
// Espera un cuerpo JSON: { "sport": "Football", "apiTeamId": 66 }
router.delete('/me/favorites', protect, userController.removeFavoriteTeam);

module.exports = router;