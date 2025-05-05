const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    apiTeamId: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    logo: { type: String }
}, { _id: false });

const leagueSchema = new mongoose.Schema({
    apiLeagueId: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    season: { type: String, required: true }
}, { _id: false });

const scoreSchema = new mongoose.Schema({
    home: { type: Number },
    away: { type: Number }
}, { _id: false });

const predictionSchema = new mongoose.Schema({
    generatedAt: { type: Date },
    ft_winner_prob: { home: Number, draw: Number, away: Number },
    ft_ou_goals_prob: { line: Number, over: Number, under: Number },
    ft_btts_prob: { yes: Number, no: Number },
    bk_winner_prob: { home: Number, away: Number },
    bk_total_pts_prob: { line: Number, over: Number, under: Number },
}, { _id: false });

const matchSchema = new mongoose.Schema({
    sport: {
        type: String,
        required: true,
        enum: ['Football', 'Basketball'],
        index: true
    },
    matchDate: {
        type: Date,
        required: true,
        index: true
    },
    status: {
        type: String,
        required: true,
        index: true
    },
    apiFootballDataOrgMatchId: { type: Number, sparse: true, unique: true, required: false },
    apiBasketballGameId: { type: Number, sparse: true, unique: true, required: false },
    league: leagueSchema,
    teams: {
        home: teamSchema,
        away: teamSchema
    },
    scores: scoreSchema,
    predictions: predictionSchema,
    isTrending: { type: Boolean, default: false, index: true }
}, {
    timestamps: true
});

matchSchema.index({ sport: 1, matchDate: -1 });
matchSchema.index({ status: 1, matchDate: 1 });
matchSchema.index({ "teams.home.apiTeamId": 1, matchDate: -1 });
matchSchema.index({ "teams.away.apiTeamId": 1, matchDate: -1 });

const Match = mongoose.model('Match', matchSchema);
module.exports = Match;
