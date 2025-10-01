const TeamDetails = require('../models/TeamDetails.model');

exports.searchTeams = async (req, res) => {
    const { name, sport } = req.query;

    if (!name || name.trim() === '') {
        return res.status(200).json({
            message: "Término de búsqueda vacío.",
            data: []
        });
    }

    try {
        const queryFilter = {
            name: { $regex: name, $options: 'i' }
        };

        if (sport) {
            if (['Football', 'Basketball'].includes(sport)) {
                queryFilter.sport = sport;
            } else {
                return res.status(400).json({ message: 'Valor de sport inválido. Usar Football o Basketball.' });
            }
        }

        const teams = await TeamDetails.find(queryFilter)
            .select('name apiTeamId sport logoUrl')
            .limit(10)
            .lean();

        res.status(200).json({
            message: `Resultados de búsqueda para: "${name}" ${sport ? 'en ' + sport : ''}`,
            data: teams
        });

    } catch (error) {
        console.error("Error en searchTeams:", error);
        res.status(500).json({ message: "Error del servidor al buscar equipos." });
    }
};