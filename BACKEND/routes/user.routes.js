const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/me', protect, userController.getMyProfile);


router.get('/me/favorites', protect, userController.getMyFavorites);
router.post('/me/favorites', protect, userController.addFavoriteTeam);
router.delete('/me/favorites', protect, userController.removeFavoriteTeam);

module.exports = router;