// BACKEND/models/User.model.js
const mongoose = require('mongoose');

// Sub-esquema para equipos favoritos
const favoriteTeamSchema = new mongoose.Schema({
    sport: {
        type: String,
        required: [true, 'El deporte es obligatorio para el equipo favorito.'],
        enum: ['Football', 'Basketball']
    },
    apiTeamId: {
        type: Number,
        required: [true, 'El ID del equipo de la API es obligatorio.']
    }
}, { _id: false });

const userSchema = new mongoose.Schema({
    firebaseUid: {
        type: String,
        required: [true, 'Firebase UID es obligatorio.'],
        unique: true,
        index: true,
    },
    email: {
        type: String,
        required: [true, 'Email es obligatorio.'],
        unique: true,
        lowercase: true,
        trim: true,
    },
    displayName: {
       type: String,
       trim: true,
    },
    photoURL: {
        type: String,
    },
    favoriteTeams: {
        type: [favoriteTeamSchema],
        default: []
    }
    // Rol eliminado
}, {
    timestamps: true
});

const User = mongoose.model('User', userSchema);
module.exports = User;