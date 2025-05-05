const User = require('../models/User.model');
const mongoose = require('mongoose');

exports.getMyProfile = async (req, res) => {
    try {
        const userProfile = {
             id: req.user._id,
             firebaseUid: req.user.firebaseUid,
             email: req.user.email,
             displayName: req.user.displayName,
             photoURL: req.user.photoURL,
             favoriteTeams: req.user.favoriteTeams,
             createdAt: req.user.createdAt
        };
        res.status(200).json(userProfile);
    } catch (error) {
        console.error("Error en getMyProfile:", error);
        res.status(500).json({ message: "Error del servidor al obtener el perfil." });
    }
};

exports.getMyFavorites = async (req, res) => {
    try {
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

exports.addFavoriteTeam = async (req, res) => {
    const { sport, apiTeamId } = req.body;
    const userId = req.user.id;

    if (!sport || !apiTeamId || !['Football', 'Basketball'].includes(sport) || typeof apiTeamId !== 'number') {
        return res.status(400).json({ message: 'Datos inválidos. Se requiere sport ("Football" o "Basketball") y apiTeamId (numérico).' });
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $addToSet: { favoriteTeams: { sport: sport, apiTeamId: apiTeamId } }
            },
            { new: true, runValidators: true }
        ).select('favoriteTeams');

        if (!updatedUser) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        res.status(200).json({ message: 'Equipo añadido a favoritos.', favorites: updatedUser.favoriteTeams });

    } catch (error) {
        console.error("Error en addFavoriteTeam:", error);
        res.status(500).json({ message: "Error del servidor al añadir favorito." });
    }
};

exports.removeFavoriteTeam = async (req, res) => {
    const { sport, apiTeamId } = req.body;
    const userId = req.user.id;

    if (!sport || !apiTeamId || !['Football', 'Basketball'].includes(sport) || typeof apiTeamId !== 'number') {
        return res.status(400).json({ message: 'Datos inválidos. Se requiere sport y apiTeamId para eliminar.' });
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $pull: { favoriteTeams: { sport: sport, apiTeamId: apiTeamId } }
            },
            { new: true }
        ).select('favoriteTeams');

        if (!updatedUser) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        res.status(200).json({ message: 'Equipo eliminado de favoritos.', favorites: updatedUser.favoriteTeams });

    } catch (error) {
        console.error("Error en removeFavoriteTeam:", error);
        res.status(500).json({ message: "Error del servidor al eliminar favorito." });
    }
};
