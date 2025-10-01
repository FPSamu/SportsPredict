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

exports.verifyFirebaseToken = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
  console.error('verifyFirebaseToken: Token no proporcionado o formato inválido.');
  return res.status(401).json({ message: 'Token no proporcionado o formato inválido.' });
  }
  const idToken = authHeader.split('Bearer ')[1];

  try {
  console.log('verifyFirebaseToken: Verificando ID Token de Firebase...');
  const decodedToken = await admin.auth().verifyIdToken(idToken);
  const firebaseUid = decodedToken.uid;
  const email = decodedToken.email;
  const displayName = decodedToken.name;
  const photoURL = decodedToken.picture;
  console.log(`verifyFirebaseToken: Token verificado para UID: ${firebaseUid}`);

  let user = await User.findOne({ firebaseUid: firebaseUid });

  if (!user) {
    console.log(`verifyFirebaseToken: Creando nuevo usuario para firebaseUid: ${firebaseUid}`);
    user = new User({
    firebaseUid: firebaseUid,
    email: email,
    displayName: displayName,
    photoURL: photoURL,
    });
    await user.save();
    console.log(`verifyFirebaseToken: Usuario creado con _id: ${user._id}`);
  } else {
    console.log(`verifyFirebaseToken: Usuario encontrado con _id: ${user._id}`);
    let updated = false;
    if (displayName && user.displayName !== displayName) {
      user.displayName = displayName;
      updated = true;
    }
     if (photoURL && user.photoURL !== photoURL) {
      user.photoURL = photoURL;
      updated = true;
    }
    if (updated) {
      await user.save();
      console.log(`verifyFirebaseToken: Datos del usuario ${user._id} actualizados.`);
    }
  }

  console.log('verifyFirebaseToken: Generando token JWT interno...');
  const internalToken = generateToken(user._id);

  res.status(200).json({
    message: 'Token verificado y sesión iniciada.',
    token: internalToken,
    user: {
    id: user._id,
    firebaseUid: user.firebaseUid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    favoriteTeams: user.favoriteTeams,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
    }
  });

  } catch (error) {
  console.error('Error en verifyFirebaseToken:', error);
  console.error('Código de Error específico:', error.code);

  if (error.code === 'auth/id-token-expired') {
    return res.status(401).json({ message: 'Token de Firebase expirado.', code: 'TOKEN_EXPIRED' });
  }
  if (error instanceof ReferenceError) {
     return res.status(500).json({ message: 'Error interno del servidor (Referencia).', code: 'INTERNAL_SERVER_ERROR'});
  }

  const message = `Token de Firebase inválido.${error.code ? ' (' + error.code + ')' : ''}`;
  return res.status(401).json({ message: message, code: error.code || 'INVALID_TOKEN' });
  }
};
