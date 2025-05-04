const admin = require('firebase-admin');
const User = require('../models/User.model');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const generateToken = (userId) => {
  return jwt.sign(
      { id: userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Controlador para verificar token y gestionar usuario
exports.verifyFirebaseToken = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token no proporcionado o formato inválido.' });
  }
  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email;
    const displayName = decodedToken.name;
    const photoURL = decodedToken.picture;

    let user = await User.findOne({ firebaseUid: firebaseUid });

    if (!user) {
      console.log(`Creando nuevo usuario para firebaseUid: ${firebaseUid}`);
      user = new User({
        firebaseUid: firebaseUid,
        email: email,
        displayName: displayName,
        photoURL: photoURL,
      });
      await user.save();
      logging.info(`Usuario creado con _id: ${user._id}`);
      // console.log(`Usuario creado con _id: ${user._id}`);
    } else {
      logging.info(`Usuario encontrado con _id: ${user._id}`);
      // Opcional: Actualizar displayName o photoURL si cambiaron en Firebase?
      // user.displayName = displayName;
      // user.photoURL = photoURL;
      // await user.save();
    }

    const internalToken = generateToken(user._id);
    
    res.status(200).json({
      message: 'Token verificado y sesión iniciada.',
      token: internalToken, // Devolver nuestro token JWT
      user: { // Devolver info del usuario (sin datos sensibles)
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        favoriteTeams: user.favoriteTeams, // Devolver favoritos aquí es útil
        // No devolver rol si lo quitamos del modelo
      }
    });
  } catch (error) {
    console.error('Error verificando token de Firebase:', error);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ message: 'Token de Firebase expirado.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ message: 'Token de Firebase inválido.', code: 'INVALID_TOKEN' });
  }
};