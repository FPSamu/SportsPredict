const Match = require('../models/Match.model');
const TeamDetails = require('../models/TeamDetails.model');
const mongoose = require('mongoose');

const populateLogos = async (matches) => {
  const matchesArray = Array.isArray(matches) ? matches : [matches];
  if (!matchesArray || matchesArray.length === 0) return matches;

  const teamKeys = new Set();
  matchesArray.forEach(match => {
    if (match?.sport && match?.teams?.home?.apiTeamId) teamKeys.add(`${match.sport}-${match.teams.home.apiTeamId}`);
    if (match?.sport && match?.teams?.away?.apiTeamId) teamKeys.add(`${match.sport}-${match.teams.away.apiTeamId}`);
  });

  if (teamKeys.size === 0) return matches;

  const orConditions = Array.from(teamKeys).map(key => {
    const parts = key.split('-');
    if (parts.length !== 2) return null;
    const sport = parts[0];
    const apiTeamId = parseInt(parts[1]);
    return !isNaN(apiTeamId) ? { sport: sport, apiTeamId: apiTeamId } : null;
  }).filter(condition => condition !== null);

  if (orConditions.length === 0) return matches;

  try {
    const teamDetailsList = await TeamDetails.find(
      { $or: orConditions },
      { apiTeamId: 1, sport: 1, logoUrl: 1, _id: 0 }
    ).lean();

    const logoMap = teamDetailsList.reduce((map, detail) => {
      if (detail.logoUrl && detail.sport && detail.apiTeamId) {
        map[`${detail.sport}-${detail.apiTeamId}`] = detail.logoUrl;
      }
      return map;
    }, {});

    matchesArray.forEach((match) => {
      if (match?.teams?.home?.apiTeamId && match.sport) {
        const homeKey = `${match.sport}-${match.teams.home.apiTeamId}`;
        match.teams.home.logo = logoMap[homeKey] || null;
      } else if (match?.teams?.home) {
        match.teams.home.logo = null;
      }

      if (match?.teams?.away?.apiTeamId && match.sport) {
        const awayKey = `${match.sport}-${match.teams.away.apiTeamId}`;
        match.teams.away.logo = logoMap[awayKey] || null;
      } else if (match?.teams?.away) {
        match.teams.away.logo = null;
      }
    });

    return Array.isArray(matches) ? matchesArray : matchesArray[0];

  } catch (error) {
    console.error("Error poblando logos:", error);
    return matches;
  }
};

exports.getUpcomingMatches = async (req, res) => {
  try {
    const { sport, leagueId, days = 7, page = 1, limit = 200 } = req.query;

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
    if (days && !isNaN(parseInt(days))) {
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() + parseInt(days));
      queryFilter.matchDate.$lte = limitDate;
    }

    const limitNum = Math.max(1, parseInt(limit) || 20);
    const pageNum = Math.max(1, parseInt(page) || 1);
    const skip = (pageNum - 1) * limitNum;

    let matches = await Match.find(queryFilter)
      .sort({ matchDate: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalMatches = await Match.countDocuments(queryFilter);

    matches = await populateLogos(matches);

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
    const { sport, leagueId, days = 7, page = 1, limit = 200 } = req.query;

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
    if (days && !isNaN(parseInt(days))) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));
      queryFilter.matchDate.$gte = startDate;
    }

    const limitNum = Math.max(1, parseInt(limit) || 20);
    const pageNum = Math.max(1, parseInt(page) || 1);
    const skip = (pageNum - 1) * limitNum;

    let matches = await Match.find(queryFilter)
      .sort({ matchDate: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalMatches = await Match.countDocuments(queryFilter);

    matches = await populateLogos(matches);

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

    let match = await Match.findById(matchId).lean();

    if (!match) {
      return res.status(404).json({ message: 'Partido no encontrado.' });
    }

    match = await populateLogos(match);

    res.status(200).json({
      message: "Detalles del partido obtenidos.",
      data: match
    });

  } catch (error) {
    console.error("Error en getMatchById:", error);
    res.status(500).json({ message: "Error del servidor al obtener el partido." });
  }
};
