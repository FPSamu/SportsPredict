const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Ruta para verificar el token de Firebase y obtener/crear usuario local
// POST /api/auth/verify-token
router.post('/verify-token', authController.verifyFirebaseToken);

// Podrías añadir otras rutas de autenticación aquí si fueran necesarias

module.exports = router;