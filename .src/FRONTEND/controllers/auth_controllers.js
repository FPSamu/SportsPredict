const generateToken = (userId) => {
    const userIdString = userId.toString();
    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

    if (!secret) {
        throw new Error("Configuración de JWT incompleta en el servidor.");
    }

    try {
        const token = jwt.sign(
            { id: userIdString },
            secret,
            { expiresIn: expiresIn }
        );
        return token;
    } catch (error) {
        throw error;
    }
};

exports.verifyFirebaseToken = async (req, res) => {
    try {
        const internalToken = generateToken(user._id);

        res.status(200).json({
            message: 'Token verificado y sesión iniciada.',
            token: internalToken,
            user: { /* ... datos del usuario ... */ }
        });

    } catch (error) {
        if (error.message.includes("Configuración de JWT incompleta")) {
            return res.status(500).json({ message: "Error de configuración del servidor [JWT Secret]." });
        }
        return res.status(500).json({ message: "Error interno del servidor al finalizar autenticación." });
    }
};
