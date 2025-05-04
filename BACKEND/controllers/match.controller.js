const Match = require('../models/Match.model');
const mongoose = require('mongoose');

// --- Controlador para Obtener Próximos Partidos ---
exports.getUpcomingMatches = async (req, res) => {
  try {
    const { sport, leagueId, days = 7, page = 1, limit = 20 } = req.query; // Obtener query params

    const queryFilter = {
      status: { $in: ['scheduled', 'timed'] }, // Estados para partidos futuros
      matchDate: { $gte: new Date() } // Fecha mayor o igual a ahora
    };

    if (sport) {
      // Filtrar por deporte (asegurarse de que coincida con 'Football' o 'Basketball')
      if (['Football', 'Basketball'].includes(sport)) {
        queryFilter.sport = sport;
      } else {
        return res.status(400).json({ message: 'Valor de sport inválido. Usar Football o Basketball.' });
      }
    }
    if (leagueId) {
        // Filtrar por ID de liga (de la API correspondiente)
        // Asegurarse que leagueId sea un número
        const leagueIdNum = parseInt(leagueId);
        if (!isNaN(leagueIdNum)) {
             queryFilter['league.apiLeagueId'] = leagueIdNum;
        } else {
             return res.status(400).json({ message: 'leagueId debe ser un número.' });
        }
    }

    // Calcular fecha límite si se especifica 'days'
    if (days) {
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() + parseInt(days));
        queryFilter.matchDate.$lte = limitDate; // Menor o igual a la fecha límite
    }

    // Calcular paginación
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const skip = (pageNum - 1) * limitNum;

    // Ejecutar consulta y contar total
    const matches = await Match.find(queryFilter)
      .sort({ matchDate: 1 }) // Ordenar por fecha ascendente
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

// --- Controlador para Obtener Partidos Recientes ---
exports.getRecentMatches = async (req, res) => {
  try {
    const { sport, leagueId, days = 7, page = 1, limit = 20 } = req.query;

    const queryFilter = {
      status: 'finished', // Solo partidos finalizados
      matchDate: { $lte: new Date() } // Fecha menor o igual a ahora
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

    // Calcular fecha de inicio si se especifica 'days'
    if (days) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));
        queryFilter.matchDate.$gte = startDate; // Mayor o igual a la fecha de inicio
    }

    // Calcular paginación
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const skip = (pageNum - 1) * limitNum;

    // Ejecutar consulta y contar total
    const matches = await Match.find(queryFilter)
      .sort({ matchDate: -1 }) // Ordenar por fecha descendente (más recientes primero)
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

// --- Controlador para Obtener un Partido por ID ---
exports.getMatchById = async (req, res) => {
  try {
    const matchId = req.params.id;

    // Validar si es un ObjectId válido de MongoDB
    if (!mongoose.Types.ObjectId.isValid(matchId)) {
        return res.status(400).json({ message: 'ID de partido inválido.' });
    }

    const match = await Match.findById(matchId);

    if (!match) {
      return res.status(404).json({ message: 'Partido no encontrado.' });
    }

    // Opcional (V2?): Aquí podríamos buscar el logo en 'team_details' si fuera necesario
    // const homeTeamDetails = await TeamDetail.findOne({ apiTeamId: match.teams.home.apiTeamId, sport: match.sport });
    // const awayTeamDetails = await TeamDetail.findOne({ apiTeamId: match.teams.away.apiTeamId, sport: match.sport });
    // match.teams.home.logo = homeTeamDetails?.logoUrl; // Añadir logo si se encuentra

    res.status(200).json({
      message: "Detalles del partido obtenidos.",
      data: match
    });

  } catch (error) {
    console.error("Error en getMatchById:", error);
    res.status(500).json({ message: "Error del servidor al obtener el partido." });
  }
};