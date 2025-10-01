const express = require('express');
const router = express.Router();
const teamController = require('../controllers/team.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/search', teamController.searchTeams);

module.exports = router;