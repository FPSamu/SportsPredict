const mongoose = require('mongoose');

const teamDetailsSchema = new mongoose.Schema({
    apiTeamId: {
        type: Number,
        required: true,
        index: true
    },
    sport: {
        type: String,
        required: true,
        enum: ['Football', 'Basketball'],
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    logoUrl: {
        type: String,
        required: false
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

teamDetailsSchema.index({ apiTeamId: 1, sport: 1 }, { unique: true });

const TeamDetails = mongoose.model('team_details', teamDetailsSchema);

module.exports = TeamDetails;
