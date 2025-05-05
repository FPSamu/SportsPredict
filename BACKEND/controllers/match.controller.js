const Match = require('../models/Match.model');
const mongoose = require('mongoose');

exports.getUpcomingMatches = async (req, res) => {
  try {
    const { sport, leagueId, days = 7, page = 1, limit = 20 } = req.query;

    const queryFilter = {
      status: { $in: ['scheduled', 'timed'] },
      matchDate: { $gte: new Date() }
    };

    if (sport) {
      if (['Football', 'Basketball'].includes(sport)) {
        queryFilter.sport = sport;
      } else {
        return res.status(400).json({ message: 'Valor de sport inválido. Usar Football o Basketball.' });
      }
    }
    if (leagueId) {
        const leagueIdNum = parseInt(leagueId);
        if (!isNaN(leagueIdNum)) {
             queryFilter['league.apiLeagueId'] = leagueIdNum;
        } else {
             return res.status(400).json({ message: 'leagueId debe ser un número.' });
        }
    }

    if (days) {
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() + parseInt(days));
        queryFilter.matchDate.$lte = limitDate;
    }

    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const skip = (pageNum - 1) * limitNum;

    const matches = await Match.find(queryFilter)
      .sort({ matchDate: 1 })
      .skip(skip)
      .limit(limitNum);

    const totalMatches = await Match.countDocuments(queryFilter);

    res.status(200).json({
      message: "Próximos partidos obtenidos.",
      data: matches,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalMatches / limitNum),
        totalMatches: totalMatches,
        limit: limitNum
      }
    });

  } catch (error) {
    console.error("Error en getUpcomingMatches:", error);
    res.status(500).json({ message: "Error del servidor al obtener próximos partidos." });
  }
};

exports.getRecentMatches = async (req, res) => {
  try {
    const { sport, leagueId, days = 7, page = 1, limit = 20 } = req.query;

    const queryFilter = {
      status: 'finished',
      matchDate: { $lte: new Date() }
    };

    if (sport) {
      if (['Football', 'Basketball'].includes(sport)) {
        queryFilter.sport = sport;
      } else {
        return res.status(400).json({ message: 'Valor de sport inválido. Usar Football o Basketball.' });
      }
    }
     if (leagueId) {
        const leagueIdNum = parseInt(leagueId);
        if (!isNaN(leagueIdNum)) {
             queryFilter['league.apiLeagueId'] = leagueIdNum;
        } else {
             return res.status(400).json({ message: 'leagueId debe ser un número.' });
        }
    }

    if (days) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));
        queryFilter.matchDate.$gte = startDate;
    }

    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const skip = (pageNum - 1) * limitNum;

    const matches = await Match.find(queryFilter)
      .sort({ matchDate: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalMatches = await Match.countDocuments(queryFilter);

    res.status(200).json({
      message: "Partidos recientes obtenidos.",
      data: matches,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalMatches / limitNum),
        totalMatches: totalMatches,
        limit: limitNum
      }
    });

  } catch (error) {
    console.error("Error en getRecentMatches:", error);
    res.status(500).json({ message: "Error del servidor al obtener partidos recientes." });
  }
};

exports.getMatchById = async (req, res) => {
  try {
    const matchId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(matchId)) {
        return res.status(400).json({ message: 'ID de partido inválido.' });
    }

    const match = await Match.findById(matchId);

    if (!match) {
      return res.status(404).json({ message: 'Partido no encontrado.' });
    }

    res.status(200).json({
      message: "Detalles del partido obtenidos.",
      data: match
    });

  } catch (error) {
    console.error("Error en getMatchById:", error);
    res.status(500).json({ message: "Error del servidor al obtener el partido." });
  }
};
