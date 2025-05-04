const User = require('../models/User.model');
const mongoose = require('mongoose');

exports.getMyProfile = async (req, res) => {
    // El middleware 'protect' ya ha verificado el token y añadido req.user
    try {
        const userProfile = {
             id: req.user._id,
             firebaseUid: req.user.firebaseUid,
             email: req.user.email,
             displayName: req.user.displayName,
             photoURL: req.user.photoURL,
             favoriteTeams: req.user.favoriteTeams,
             createdAt: req.user.createdAt
             // Añade otros campos si es necesario
        };
        res.status(200).json(userProfile);
    } catch (error) {
        console.error("Error en getMyProfile:", error);
        res.status(500).json({ message: "Error del servidor al obtener el perfil." });
    }
};

// Obtener solo los equipos favoritos
exports.getMyFavorites = async (req, res) => {
    try {
        // req.user ya está disponible gracias al middleware protect
        // Podemos devolver directamente el array o buscarlo de nuevo para más seguridad/frescura
         const user = await User.findById(req.user.id).select('favoriteTeams');
         if (!user) {
             return res.status(404).json({ message: 'Usuario no encontrado.' });
         }
        res.status(200).json(user.favoriteTeams);
    } catch (error) {
        console.error("Error en getMyFavorites:", error);
        res.status(500).json({ message: "Error del servidor al obtener favoritos." });
    }
};

// Añadir un equipo favorito
exports.addFavoriteTeam = async (req, res) => {
    const { sport, apiTeamId } = req.body;
    const userId = req.user.id; // Obtenido del middleware protect

    // Validación básica de entrada
    if (!sport || !apiTeamId || !['Football', 'Basketball'].includes(sport) || typeof apiTeamId !== 'number') {
        return res.status(400).json({ message: 'Datos inválidos. Se requiere sport ("Football" o "Basketball") y apiTeamId (numérico).' });
    }

    try {
        // Usar $addToSet para añadir solo si no existe ya y evitar duplicados
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $addToSet: { favoriteTeams: { sport: sport, apiTeamId: apiTeamId } }
            },
            { new: true, runValidators: true } // new: true devuelve el documento actualizado
        ).select('favoriteTeams'); // Devolver solo la lista actualizada

        if (!updatedUser) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        res.status(200).json({ message: 'Equipo añadido a favoritos.', favorites: updatedUser.favoriteTeams });

    } catch (error) {
        console.error("Error en addFavoriteTeam:", error);
        res.status(500).json({ message: "Error del servidor al añadir favorito." });
    }
};

// Eliminar un equipo favorito
exports.removeFavoriteTeam = async (req, res) => {
    // Recibimos los datos del equipo a eliminar en el cuerpo (body)
    const { sport, apiTeamId } = req.body;
    const userId = req.user.id;

    // Validación básica
     if (!sport || !apiTeamId || !['Football', 'Basketball'].includes(sport) || typeof apiTeamId !== 'number') {
        return res.status(400).json({ message: 'Datos inválidos. Se requiere sport y apiTeamId para eliminar.' });
    }

    try {
        // Usar $pull para eliminar el objeto que coincida exactamente
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $pull: { favoriteTeams: { sport: sport, apiTeamId: apiTeamId } }
            },
            { new: true } // Devuelve el documento actualizado
        ).select('favoriteTeams'); // Devolver solo la lista actualizada

        if (!updatedUser) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        res.status(200).json({ message: 'Equipo eliminado de favoritos.', favorites: updatedUser.favoriteTeams });

    } catch (error) {
        console.error("Error en removeFavoriteTeam:", error);
        res.status(500).json({ message: "Error del servidor al eliminar favorito." });
    }
};