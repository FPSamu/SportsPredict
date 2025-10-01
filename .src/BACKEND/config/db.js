const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      console.error('Error: MONGO_URI no definida en el archivo .env del backend.');
      process.exit(1);
    }

    const options = {
      serverSelectionTimeoutMS: 45000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000
    };

    await mongoose.connect(mongoURI, options);

    console.log('MongoDB conectado exitosamente (Backend)...');

  } catch (err) {
    console.error('Error al conectar con MongoDB (Backend):', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;