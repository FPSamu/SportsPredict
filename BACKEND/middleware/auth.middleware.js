const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
require('dotenv').config();

const protect = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {        
           return res.status(401).json({ message: 'Usuario no encontrado.' });
      }

      next();
    } catch (error) {
      console.error('Error de autenticación de token:', error.message);
      if (error.name === 'JsonWebTokenError') {
           return res.status(401).json({ message: 'Token inválido.' });
      }
      if (error.name === 'TokenExpiredError') {
           return res.status(401).json({ message: 'Token expirado.' });
      }
      return res.status(401).json({ message: 'No autorizado, fallo de token.' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'No autorizado, no hay token.' });
  }
};

module.exports = { protect };