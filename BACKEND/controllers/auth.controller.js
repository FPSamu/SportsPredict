const admin = require('firebase-admin');
const User = require('../models/User.model'); // Importar el modelo User

// Controlador para verificar token y gestionar usuario
exports.verifyFirebaseToken = async (req, res) => {
  // 1. Obtener el ID Token de Firebase del encabezado Authorization
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token no proporcionado o formato inválido.' });
  }
  const idToken = authHeader.split('Bearer ')[1];

  try {
    // 2. Verificar el ID Token usando Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email;
    const displayName = decodedToken.name;
    const photoURL = decodedToken.picture;

    // 3. Buscar usuario en nuestra BD por firebaseUid
    let user = await User.findOne({ firebaseUid: firebaseUid });

    // 4. Si no existe, crearlo en nuestra BD
    if (!user) {
      console.log(`Creando nuevo usuario para firebaseUid: ${firebaseUid}`);
      user = new User({
        firebaseUid: firebaseUid,
        email: email,
        displayName: displayName,
        photoURL: photoURL,
        // El rol por defecto es 'user' según el schema
        // favoriteTeams se inicializa vacío por defecto
      });
      await user.save();
      console.log(`Usuario creado con _id: ${user._id}`);
    } else {
      console.log(`Usuario encontrado con _id: ${user._id}`);
      // Opcional: Actualizar displayName o photoURL si cambiaron en Firebase?
      // user.displayName = displayName;
      // user.photoURL = photoURL;
      // await user.save();
    }

    // 5. Respuesta Exitosa
    // Por ahora, devolvemos la información del usuario de nuestra BD.
    // Más adelante, podríamos generar y devolver un JWT propio aquí.
    res.status(200).json({
      message: 'Token verificado exitosamente.',
      user: { // Devolver solo la info necesaria/segura
        id: user._id, // Nuestro ID interno
        firebaseUid: user.firebaseUid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        favoriteTeams: user.favoriteTeams,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
      // jwtToken: 'aqui_iria_nuestro_token_propio' // Si generamos uno propio
    });

  } catch (error) {
    // Manejar errores de verificación de token (expirado, inválido, etc.)
    console.error('Error verificando token de Firebase:', error);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ message: 'Token de Firebase expirado.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ message: 'Token de Firebase inválido.', code: 'INVALID_TOKEN' });
  }
};