const Match = require('../models/Match.model');
const TeamDetails = require('../models/TeamDetails.model');
const mongoose = require('mongoose');
const { spawn } = require('child_process');
const path = require('path');

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
// En backend/controllers/match.controller.js

// ... (tus otros requires como Match, TeamDetails, etc.)

exports.getTrendingMatches = async (req, res) => {
  try {
      const { sport } = req.query; // El frontend podría enviar un filtro de deporte

      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999); // Fin del día de mañana

      const queryFilter = {
          $or: [
              { status: { $in: ['LIVE', 'IN_PLAY', '1H', 'HT', '2H', 'ET', 'PEN_LIVE'] } }, // Partidos en vivo
              { matchDate: { $gte: now, $lte: tomorrow } } // O partidos programados para hoy y mañana
          ],
          // Podrías añadir más lógica aquí para "equipos top" si tienes sus IDs en el backend
      };

      if (sport) {
          if (['Football', 'Basketball'].includes(sport)) {
              queryFilter.sport = sport;
          } else {
              // Considera no devolver error y simplemente no filtrar por deporte si es inválido
          }
      }

      console.log("getTrendingMatches - queryFilter:", JSON.stringify(queryFilter));

      let matches = await Match.find(queryFilter)
          .sort({ matchDate: 1 }) // En vivo primero (si el status los pone antes), luego por fecha
          .limit(30) // Limitar resultados para no sobrecargar
          .lean();

      matches = await populateLogos(matches); // Reutiliza tu función para añadir logos

      res.status(200).json({
          message: "Partidos trending obtenidos.",
          data: matches,
          // Podrías añadir paginación si esperas muchos resultados
      });

  } catch (error) {
      console.error("Error en getTrendingMatches:", error);
      res.status(500).json({ message: "Error del servidor al obtener partidos trending." });
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

exports.getMatchPredictions = async (req, res) => {
  try {
      const matchId = req.params.matchId;

      if (!mongoose.Types.ObjectId.isValid(matchId)) {
          return res.status(400).json({ message: 'ID de partido inválido.' });
      }

      const match = await Match.findById(matchId).lean();

      if (!match) {
          return res.status(404).json({ message: 'Partido no encontrado para generar predicciones.' });
      }

      if (!match.teams || !match.teams.home || !match.teams.away ||
          !match.teams.home.apiTeamId || !match.teams.away.apiTeamId || !match.sport) {
          console.error("Error: Datos de equipos o deporte faltantes en el documento del partido:", match);
          return res.status(500).json({ message: 'Datos incompletos del partido para generar predicciones.' });
      }

      const sport = match.sport;
      const homeTeamApiId = match.teams.home.apiTeamId.toString(); // Convertir a string para argumentos
      const awayTeamApiId = match.teams.away.apiTeamId.toString();

      // --- Configuración para llamar al script Python ---
      // Ajusta 'python' si necesitas 'python3' o una ruta específica al ejecutable de Python
      // de tu entorno virtual de 'prediction-service'
      const pythonExecutable = 'python'; // O 'python3'

      // Construir la ruta al script predict.py
      // Asume que 'BACKEND' y 'prediction-service' están al mismo nivel en la raíz del proyecto
      const scriptPath = path.join(__dirname, '..', '..', 'prediction-service', 'predict.py');
      const scriptWorkingDirectory = path.join(__dirname, '..', '..', 'prediction-service');

      console.log(`Ejecutando script Python: ${pythonExecutable} ${scriptPath} en ${scriptWorkingDirectory}`);
      console.log(`Argumentos: ${sport}, ${homeTeamApiId}, ${awayTeamApiId}`);

      // Llamar al script de Python como un proceso hijo
      const pythonProcess = spawn(pythonExecutable, [
          scriptPath,
          sport,
          homeTeamApiId,
          awayTeamApiId
      ], {
          cwd: scriptWorkingDirectory // Establecer el directorio de trabajo para el script Python
      });

      let predictionData = '';
      let errorData = '';

      // Capturar salida estándar del script Python
      pythonProcess.stdout.on('data', (data) => {
          predictionData += data.toString();
      });

      // Capturar salida de error del script Python
      pythonProcess.stderr.on('data', (data) => {
          errorData += data.toString();
          console.error(`Error desde script Python (stderr): ${data.toString()}`);
      });

      // Manejar el cierre del proceso Python
      pythonProcess.on('close', (code) => {
          console.log(`Proceso Python finalizado con código ${code}`);
          if (errorData && code !== 0) { // Si hubo errores en stderr Y el código de salida no es 0
              return res.status(500).json({
                  message: 'Error al ejecutar el script de predicción.',
                  errorDetails: errorData
              });
          }

          try {
              const predictions = JSON.parse(predictionData);
              // Verificar si el JSON parseado contiene un campo de error (definido en predict.py)
              if (predictions && predictions.error) {
                   console.error("Error devuelto por el script de predicción Python:", predictions);
                   return res.status(500).json({
                       message: 'El script de predicción devolvió un error.',
                       errorDetails: predictions.error,
                       details: predictions.details || null
                   });
              }

              // Devolver las predicciones
              // También actualizamos el documento del partido con estas predicciones
              Match.findByIdAndUpdate(matchId, {
                  $set: {
                      predictions: {
                          generatedAt: new Date(),
                          // Asumimos que 'predictions' devuelto por Python tiene la estructura correcta
                          ...predictions.predictions // Tomamos el objeto anidado 'predictions'
                      }
                  }
              }, { new: true }) // new: true no es tan relevante aquí, solo actualizamos
              .then(updatedMatch => {
                  if (updatedMatch) console.log(`Predicciones actualizadas en BD para matchId: ${matchId}`);
                  else console.log(`No se pudo actualizar matchId: ${matchId} con predicciones.`);
              })
              .catch(dbError => {
                  console.error(`Error guardando predicciones en BD para matchId ${matchId}:`, dbError);
                  // No hacemos fallar la respuesta al cliente por esto, pero es un problema a revisar
              });


              res.status(200).json({
                  message: 'Predicciones obtenidas exitosamente.',
                  matchId: matchId,
                  data: predictions // El JSON completo devuelto por el script Python
              });

          } catch (parseError) {
              console.error('Error parseando JSON de la salida del script Python:', parseError);
              console.error('Salida cruda del script Python (stdout):', predictionData);
              console.error('Salida cruda de error del script Python (stderr):', errorData);
              return res.status(500).json({
                  message: 'Error procesando la respuesta del servicio de predicción.',
                  rawOutput: predictionData,
                  rawError: errorData
              });
          }
      });

      pythonProcess.on('error', (err) => {
          console.error('Error al iniciar el proceso Python:', err);
          return res.status(500).json({ message: 'No se pudo iniciar el servicio de predicción.' });
      });

  } catch (error) {
      console.error("Error en getMatchPredictions:", error);
      res.status(500).json({ message: "Error del servidor al obtener predicciones." });
  }
};