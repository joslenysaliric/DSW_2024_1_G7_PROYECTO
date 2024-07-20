const bcryptjs = require('bcryptjs');
const { createConnection } = require('../database/database');

const consultarUsuario = async (req, res) => {
  const { codigo_estudiante } = req.query;

  const query = `
    SELECT u.nombre, u.apellido, u.DNI, e.ciclo, e.escuela, e.calidad_usuario 
    FROM Usuario u
    JOIN Estudiante e ON u.id_usuario = e.id_usuario
    WHERE e.codigo_estudiante = ?
  `;

  try {
    const [results] = await req.db.query(query, [codigo_estudiante]);
    if (results.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json(results[0]);
  } catch (err) {
    console.error('Error en la consulta a la base de datos:', err);
    return res.status(500).json({ message: 'Error en el servidor al consultar el usuario' });
  }
};

const verificarEstudiante = async (db, codigoEstudiante) => {
  try {
    const [results] = await db.query('SELECT * FROM estudiante WHERE codigo_estudiante = ?', [codigoEstudiante]);
    console.log('Resultados de la verificación:', results);
    return results.length > 0;
  } catch (error) {
    console.error('Error al verificar el estudiante:', error);
    throw error;
  }
};


async function login(db, correo, password) {
  try {
    const [results] = await db.query('SELECT * FROM Usuario WHERE correo_institucional = ?', [correo]);

    if (results.length === 0) {
      return { success: false, message: 'Usuario no encontrado.' };
    }

    const usuario = results[0];

    // Trim and ensure both password and stored hash are defined
    const trimmedPassword = password.trim();
    const storedHash = usuario['contraseña'].trim();

    if (!trimmedPassword || !storedHash) {
      console.log('Datos incompletos para comparación.');
      return { success: false, message: 'Datos incompletos para comparación.' };
    }

    // Compare the provided password with the stored hash using bcryptjs.compare
    const match = await bcryptjs.compare(trimmedPassword, storedHash);

    console.log('Resultado de la comparación:', match);

    if (match) {
      return { success: true, usuario };
    } else {
      console.log('Contraseña incorrecta.');
      return { success: false, message: 'Contraseña incorrecta.' };
    }
  } catch (error) {
    console.error('Error al verificar las credenciales:', error);
    return { success: false, message: 'Error en el servidor.' };
  }
}

async function verificarPersonal(req, res) {
  const { codigo } = req.query;

  // Verificar que se ha ingresado un código
  if (!codigo) {
    return res.render('pages/cambiar-contrasena-page/cambiar-contrasena', {
      title: 'Cambio de contraseña - Biblioteca de la FISI',
      layout: 'layouts/main-administrador',
      errorMessage: null
    });
  }

  try {
    const dbConnection = await createConnection();
    const [results] = await dbConnection.query(`
      SELECT p.*, u.nombre, u.apellido
      FROM personal_de_apoyo p
      JOIN usuario u ON p.id_usuario = u.id_usuario
      WHERE p.id_personal_de_apoyo = ?
    `, [codigo]);

    if (results.length === 0) {
      return res.render('pages/cambiar-contrasena-page/cambiar-contrasena', {
        title: 'Cambio de contraseña - Biblioteca de la FISI',
        layout: 'layouts/main-administrador',
        errorMessage: 'Código del personal de apoyo no válido. Por favor, intente de nuevo.'
      });
    }

    const personal = results[0];
    res.render('pages/cambiar-contrasena-page/cambiar-contrasena', {
      title: 'Cambio de contraseña - Biblioteca de la FISI',
      layout: 'layouts/main-administrador',
      personal,
      errorMessage: null
    });
  } catch (error) {
    console.error('Error al buscar el personal de apoyo:', error);
    res.render('pages/cambiar-contrasena-page/cambiar-contrasena', {
      title: 'Cambio de contraseña - Biblioteca de la FISI',
      layout: 'layouts/main-administrador',
      errorMessage: 'Error en el servidor. Por favor, intente de nuevo.'
    });
  }
}

const validarProfesor = async (db, codigoProfesor) => {
  try {
    const [results] = await db.query('SELECT * FROM Profesor WHERE codigo_profesor = ?', [codigoProfesor]);
    return results.length > 0;
  } catch (error) {
    console.error('Error al verificar el profesor:', error);
    throw error;
  }
};

async function actualizarContrasena(req, res) {
  const { codigo, nuevaContrasena, confirmarContrasena } = req.body;

  if (nuevaContrasena !== confirmarContrasena) {
    return res.render('pages/cambiar-contrasena-page/cambiar-contrasena', {
      title: 'Cambio de contraseña - Biblioteca de la FISI',
      layout: 'layouts/main-administrador',
      errorMessage: 'Las contraseñas no coinciden.',
      personal: { id_personal_de_apoyo: codigo } // Mantener el código visible
    });
  }

  try {
    const dbConnection = await createConnection();
    const [results] = await dbConnection.query(`
      SELECT p.*, u.id_usuario
      FROM personal_de_apoyo p
      JOIN usuario u ON p.id_usuario = u.id_usuario
      WHERE p.id_personal_de_apoyo = ?
    `, [codigo]);

    if (results.length === 0) {
      return res.render('pages/cambiar-contrasena-page/cambiar-contrasena', {
        title: 'Cambio de contraseña - Biblioteca de la FISI',
        layout: 'layouts/main-administrador',
        errorMessage: 'Personal de apoyo no encontrado.'
      });
    }

    const personal = results[0];
    const idUsuario = personal.id_usuario;
    const saltRounds = 10;
    const hashedPassword = bcryptjs.hashSync(nuevaContrasena, saltRounds);

    await dbConnection.query(`
      UPDATE usuario
      SET contraseña = ?
      WHERE id_usuario = ?
    `, [hashedPassword, idUsuario]);

    res.render('pages/cambiar-contrasena-page/cambiar-contrasena', {
      title: 'Cambio de contraseña - Biblioteca de la FISI',
      layout: 'layouts/main-administrador',
      successMessage: 'Cambio de contraseña exitoso.',
      personal: null
    });
  } catch (error) {
    console.error('Error al actualizar la contraseña:', error);
    res.render('pages/cambiar-contrasena-page/cambiar-contrasena', {
      title: 'Cambio de contraseña - Biblioteca de la FISI',
      layout: 'layouts/main-administrador',
      errorMessage: 'Error en el servidor.'
    });
  }
}

async function obtenerIdUsuarioPorCodigo(dbConnection, codigoSolicitante) {
  const [result] = await dbConnection.query('SELECT id_usuario FROM Estudiante WHERE codigo_estudiante = ? UNION SELECT id_usuario FROM Profesor WHERE codigo_profesor = ?', [codigoSolicitante, codigoSolicitante]);
  return result.length > 0 ? result[0].id_usuario : null;
}

module.exports = {
  consultarUsuario,
  verificarPersonal,
  actualizarContrasena,
  login,
  verificarEstudiante,
  validarProfesor,
  obtenerIdUsuarioPorCodigo
};
