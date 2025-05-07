// BACKEND/models/Match.model.js
const mongoose = require('mongoose');

// ... (teamSchema, leagueSchema, scoreSchema se mantienen igual que antes) ...
const teamSchema = new mongoose.Schema({
    apiTeamId: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    logo: { type: String }
}, { _id: false });

const leagueSchema = new mongoose.Schema({
    apiLeagueId: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    season: { type: String, required: true },
    logo: { type: String }
}, { _id: false });

const scoreSchema = new mongoose.Schema({
    home: { type: Number },
    away: { type: Number }
}, { _id: false });


// --- NUEVO: Sub-esquema para cada línea de Over/Under ---
const overUnderLineSchema = new mongoose.Schema({
    line: { type: Number, required: true },
    over: { type: Number, required: true },
    under: { type: Number, required: true },
    source: { type: String } // Opcional: 'historical_frequency', 'default_no_data', etc.
}, { _id: false });

// --- Esquema de Predicciones MODIFICADO ---
const predictionSchema = new mongoose.Schema({
    generatedAt: { type: Date },
    // Fútbol
    ft_winner_prob: { home: Number, draw: Number, away: Number },
    // <<< CAMBIO: Ahora es un array que usa overUnderLineSchema >>>
    ft_ou_goals_prob: [overUnderLineSchema],
    ft_btts_prob: { yes: Number, no: Number },
    // Básquetbol
    bk_winner_prob: { home: Number, away: Number },
    // <<< CAMBIO: Ahora es un array que usa overUnderLineSchema >>>
    bk_total_pts_prob: [overUnderLineSchema],
}, { _id: false });


// --- Esquema Principal del Partido/Juego (el resto sigue igual) ---
const matchSchema = new mongoose.Schema({
    sport: { /* ... */ },
    matchDate: { /* ... */ },
    status: { /* ... */ },
    apiFootballDataOrgMatchId: { type: Number, sparse: true, unique: true, required: false },
    apiBasketballGameId: { type: Number, sparse: true, unique: true, required: false },
    league: leagueSchema,
    teams: {
        home: teamSchema,
        away: teamSchema
    },
    scores: scoreSchema,
    predictions: predictionSchema, // Ahora usa el predictionSchema modificado
    isTrending: { type: Boolean, default: false, index: true }
}, {
    timestamps: true
});

// Índices (sin cambios)
matchSchema.index({ sport: 1, matchDate: -1 });
matchSchema.index({ status: 1, matchDate: 1 });
matchSchema.index({ "teams.home.apiTeamId": 1, matchDate: -1 });
matchSchema.index({ "teams.away.apiTeamId": 1, matchDate: -1 });

const Match = mongoose.model('Match', matchSchema);
module.exports = Match;