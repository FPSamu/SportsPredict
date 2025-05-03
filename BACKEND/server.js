// BACKEND/server.js

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db'); // Importar nuestra función de conexión a BD

// Cargar variables de entorno desde el archivo .env de esta carpeta
dotenv.config();

// Conectar a la base de datos MongoDB
connectDB(); // Llamamos a la función que exportamos de config/db.js

// Inicializar la aplicación Express
const app = express();

// --- Middlewares Esenciales ---

// Habilitar CORS (Cross-Origin Resource Sharing)
// Esto permite que tu frontend (en otro dominio/puerto) haga peticiones a este backend.
// Puedes configurarlo de forma más restrictiva en producción.
app.use(cors());

// Habilitar el parseo de JSON en el cuerpo de las peticiones
// Permite leer datos enviados como req.body en formato JSON
app.use(express.json());

// Habilitar el parseo de datos URL-encoded (formularios básicos)
app.use(express.urlencoded({ extended: false }));

// --- Rutas API ---

// Ruta de prueba simple para verificar que el servidor funciona
app.get('/', (req, res) => {
  res.send('¡API de StatsPredict funcionando!');
});

// // Aquí es donde montaremos nuestras rutas principales más adelante
// app.use('/api/auth', require('./routes/auth.routes'));
// app.use('/api/matches', require('./routes/match.routes'));
// app.use('/api/users', require('./routes/user.routes'));
// // ... etc ...


// --- Configuración del Puerto y Arranque del Servidor ---

// Obtener el puerto desde las variables de entorno o usar 5000 por defecto
const PORT = process.env.PORT || 5000;

// Iniciar el servidor y escuchar en el puerto especificado
const server = app.listen(PORT, () => {
  console.log(`Servidor Node.js corriendo en el puerto ${PORT}`);
  // (Usando la hora local de México Central para el log)
  console.log(`Hora local actual: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`);
});

// Manejo de errores de servidor (opcional pero bueno)
server.on('error', (error) => {
  console.error(`Error al iniciar el servidor: ${error.message}`);
  process.exit(1); // Salir si el puerto ya está en uso u otro error crítico
});

// Manejo de promesas no capturadas (opcional pero bueno)
process.on('unhandledRejection', (err, promise) => {
  console.error(`Error de Promesa no Manejada: ${err.message}`);
  // Considera cerrar el servidor de forma controlada en errores graves
  // server.close(() => process.exit(1));
});