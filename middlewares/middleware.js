const { jwtVerify } = require('jose');
const { createConnection } = require('../database/database');

const verifyToken = async (req, res, next) => {
  const token = req.cookies.jwt;
  if (!token) {
    res.send('<script>alert("Debes iniciar sesión para continuar"); window.location="/login";</script>');
    return;
  }
  const encoder = new TextEncoder();
  try {
    const { payload } = await jwtVerify(token, encoder.encode(process.env.JWT_PRIVATE_KEY));
    req.user = payload;

    // Conectar a la base de datos y obtener el rol del usuario
    const db = await createConnection();
    const [rows] = await db.execute('SELECT rol FROM Usuario WHERE id_usuario = ?', [req.user.sub]);
    if (rows.length > 0) {
      req.user.rol = rows[0].rol;
      next();
    } else {
      res.send('<script>alert("Usuario no encontrado."); window.location="/login";</script>');
    }
  } catch (error) {
    res.send('<script>alert("Token inválido. Por favor, inicia sesión nuevamente."); window.location="/login";</script>');
    return;
  }
};

const permitRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      res.send('<script>alert("Acceso restringido."); window.location="/login";</script>');
      return;
    }
    next();
  };
};

module.exports = { verifyToken, permitRole };
