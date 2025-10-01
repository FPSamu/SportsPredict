const User = require('../models/User.model');
const mongoose = require('mongoose');
const admin = require('firebase-admin');

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

exports.deleteMyAccount = async (req, res) => {
    const userIdMongo = req.user.id;
    const firebaseUid = req.user.firebaseUid;

    if (!firebaseUid) {
        console.error("deleteMyAccount: firebaseUid no encontrado en req.user. Esto no debería pasar si 'protect' funciona.");
        return res.status(500).json({ message: "Error interno al procesar la solicitud." });
    }

    console.log(`Iniciando eliminación de cuenta para MongoDB ID: ${userIdMongo}, Firebase UID: ${firebaseUid}`);

    try {
        console.log(`Intentando eliminar usuario de Firebase Auth: ${firebaseUid}`);
        await admin.auth().deleteUser(firebaseUid);
        console.log(`Usuario ${firebaseUid} eliminado de Firebase Authentication exitosamente.`);

        console.log(`Intentando eliminar usuario de MongoDB: ${userIdMongo}`);
        const deletedUser = await User.findByIdAndDelete(userIdMongo);

        if (!deletedUser) {
            console.warn(`Usuario MongoDB con ID ${userIdMongo} no encontrado para eliminar, pero Firebase UID ${firebaseUid} fue eliminado.`);
            return res.status(200).json({ message: 'Cuenta eliminada de Firebase. Registro local no encontrado.' });
        }
        console.log(`Usuario ${userIdMongo} eliminado de MongoDB exitosamente.`);

        res.status(200).json({ message: 'Cuenta eliminada exitosamente de Firebase y MongoDB.' });

    } catch (error) {
        console.error("Error durante la eliminación de la cuenta:", error);
        let errorMessage = "Error del servidor al intentar eliminar la cuenta.";
        if (error.code === 'auth/user-not-found') {
            console.warn(`Usuario ${firebaseUid} no encontrado en Firebase. Puede que ya haya sido eliminado.`);
            try {
                await User.findByIdAndDelete(userIdMongo);
                console.log(`Usuario ${userIdMongo} eliminado de MongoDB (después de error Firebase 'user-not-found').`);
            } catch (mongoError) {
                console.error("Error eliminando de MongoDB después de error Firebase 'user-not-found':", mongoError);
            }
            return res.status(200).json({ message: 'Usuario no encontrado en Firebase (posiblemente ya eliminado), registro local eliminado.' });
        }
        res.status(500).json({ message: errorMessage, details: error.message });
    }
};