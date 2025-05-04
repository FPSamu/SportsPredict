// BACKEND/server.js

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const admin = require('firebase-admin');

dotenv.config();

try {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
  if (!serviceAccountPath) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY_PATH no está definido en .env');
  }
  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin SDK inicializado correctamente.');
} catch (error) {
  console.error('Error inicializando Firebase Admin SDK:', error.message);
  process.exit(1);
}

connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/', (req, res) => {
  res.send('¡API de StatsPredict funcionando!');
});

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/matches', require('./routes/match.routes'));
app.use('/api/users', require('./routes/user.routes'));

// --- Configuración del Puerto y Arranque del Servidor ---

// Obtener el puerto desde las variables de entorno o usar 5000 por defecto
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Servidor Node.js corriendo en el puerto ${PORT}`);
  console.log(`Hora local actual: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`);
});

server.on('error', (error) => {
  console.error(`Error al iniciar el servidor: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (err, promise) => {
  console.error(`Error de Promesa no Manejada: ${err.message}`);
  // Considera cerrar el servidor de forma controlada en errores graves
  // server.close(() => process.exit(1));
});