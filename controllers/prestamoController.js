const { verificarEstudiante, validarProfesor, obtenerIdUsuarioPorCodigo, obtenerIdPersonalApoyoPorCodigo } = require('./usuarioController');
const libroController = require('./libroController');
const { createConnection } = require('../database/database');

async function solicitarPrestamo(req, res) {
  const { codigoSolicitante, tituloLibro, fechaPrestamo, tipoUsuario } = req.body;
  const horaLimite = "5:00 pm"; // Hora límite fija

  try {
    const dbConnection = await createConnection();
    console.log('Conexión a la base de datos establecida en solicitarPrestamo.');

    // Verificar si el solicitante es un estudiante o un profesor
    const esEstudiante = await verificarEstudiante(dbConnection, codigoSolicitante);
    const esProfesor = await validarProfesor(dbConnection, codigoSolicitante);
    console.log(`Es estudiante: ${esEstudiante}, es profesor: ${esProfesor}`);

    let idUsuario = null;
    let idPersonalApoyo = null;

    if (esEstudiante || esProfesor) {
      idUsuario = await obtenerIdUsuarioPorCodigo(dbConnection, codigoSolicitante);
    } else {
      idPersonalApoyo = await obtenerIdPersonalApoyoPorCodigo(dbConnection, codigoSolicitante);
      if (!idPersonalApoyo) {
        const libros = await libroController.consultarLibros(req, res);
        return res.render("pages/solicitar-prestamo-page/solicitar-prestamo", {
          title: "Solicitar Préstamo - Biblioteca de la FISI",
          layout: "layouts/main",
          errorMessage: 'Código del solicitante no válido.',
          libros,
          tipoUsuario
        });
      }
    }

    // Verificar si el libro existe
    const [libroResults] = await dbConnection.query('SELECT * FROM Libro WHERE nombre = ?', [tituloLibro]);
    console.log(`Resultados del libro: ${libroResults.length}`);

    if (libroResults.length === 0) {
      const libros = await libroController.consultarLibros(req, res);
      return res.render("pages/solicitar-prestamo-page/solicitar-prestamo", {
        title: "Solicitar Préstamo - Biblioteca de la FISI",
        layout: "layouts/main",
        errorMessage: 'El libro no se encuentra en la base de datos.',
        libros,
        tipoUsuario
      });
    }

    const libro = libroResults[0];

    const fechaPrestamoDate = new Date(fechaPrestamo);

    // Registrar la solicitud de préstamo
    await dbConnection.query(`
      INSERT INTO Historial_Prestamos (id_usuario, codigo_libro, fecha_prestamo, estado, codigo_solicitante)
      VALUES (?, ?, ?, 'Pendiente', ?)
    `, [idUsuario, libro.codigo_libro, fechaPrestamo, codigoSolicitante]);
    console.log('Solicitud de préstamo registrada.');

    // Actualizar la cantidad y el estado del libro
    let nuevaCantidad = libro.cantidad - 1;
    let nuevoEstado = libro.estado;

    if (nuevaCantidad <= 0) {
      nuevaCantidad = 0;
      nuevoEstado = 'Agotado';
    }

    await dbConnection.query(`
      UPDATE Libro
      SET cantidad = ?, estado = ?
      WHERE codigo_libro = ?
    `, [nuevaCantidad, nuevoEstado, libro.codigo_libro]);
    console.log('Cantidad de libro actualizada.');

    return res.redirect(`/solicitud-realizada?codigo=${codigoSolicitante}&libro=${tituloLibro}&fecha=${fechaPrestamo}&horaLimite=${horaLimite}&tipoUsuario=${tipoUsuario}`);
  } catch (error) {
    console.error('Error al solicitar el préstamo:', error.message);
    const libros = await libroController.consultarLibros(req, res);
    return res.render("pages/solicitar-prestamo-page/solicitar-prestamo", {
      title: "Solicitar Préstamo - Biblioteca de la FISI",
      layout: "layouts/main",
      errorMessage: `Error en el servidor: ${error.message}`,
      libros,
      tipoUsuario
    });
  }
}

const consultarHistorialPrestamos = async (req, res) => {
  const { codigo_estudiante, titulo_libro } = req.query;

  const query = `
    SELECT hp.*, l.nombre AS nombre_libro, u.nombre AS nombre_usuario, u.apellido AS apellido_usuario
    FROM Historial_Prestamos hp
    JOIN Libro l ON hp.codigo_libro = l.codigo_libro
    JOIN Usuario u ON hp.id_usuario = u.id_usuario
    WHERE hp.codigo_solicitante = ? AND l.nombre LIKE ?
  `;

  try {
    const [results] = await req.db.query(query, [codigo_estudiante, `%${titulo_libro}%`]);

    // Formatear la fecha antes de enviar los datos
    results.forEach(result => {
      if (result.fecha_prestamo) {
        result.fecha_prestamo = result.fecha_prestamo.toISOString().split('T')[0];
      }
    });

    res.json(results);
  } catch (err) {
    console.error('Error al consultar el historial de préstamos:', err);
    res.status(500).send(err.message);
  }
};


const consultarPrestamosPorEstadoOCodigo = async (req, res) => {
  const { estado, codigo_estudiante } = req.query;

  let query = `
    SELECT hp.*, l.nombre AS nombre_libro, u.nombre AS nombre_usuario, u.apellido AS apellido_usuario
    FROM Historial_Prestamos hp
    JOIN Libro l ON hp.codigo_libro = l.codigo_libro
    JOIN Usuario u ON hp.id_usuario = u.id_usuario
    WHERE 1=1
  `;
  
  const queryParams = [];

  if (estado) {
    query += ' AND hp.estado LIKE ?';
    queryParams.push(`%${estado}%`);
  }
  
  if (codigo_estudiante) {
    query += ' AND hp.codigo_solicitante = ?';
    queryParams.push(codigo_estudiante);
  }

  try {
    const dbConnection = await createConnection();
    const [results] = await dbConnection.query(query, queryParams);

    // Formatear las fechas antes de enviar los datos
    results.forEach(result => {
      if (result.fecha_prestamo) {
        const date = new Date(result.fecha_prestamo);
        result.fecha_prestamo = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
      }
    });

    res.json(results);
  } catch (err) {
    console.error('Error al consultar los préstamos:', err);
    res.status(500).send(err.message);
  }
};

const actualizarEstadoPrestamo = async (req, res) => {
  const updates = req.body;

  const queryActualizarPrestamos = `
    UPDATE Historial_Prestamos 
    SET estado = ? 
    WHERE id_HistorialPrestamos = ?
  `;

  const queryObtenerEstadoAnterior = `
    SELECT estado, codigo_libro
    FROM Historial_Prestamos 
    WHERE id_HistorialPrestamos = ?
  `;

  const queryActualizarCantidadLibro = `
    UPDATE Libro
    SET cantidad = cantidad + ?
    WHERE codigo_libro = ?
  `;

  try {
    const dbConnection = await createConnection();
    for (const update of updates) {
      // Obtener el estado anterior del préstamo
      const [rows] = await dbConnection.query(queryObtenerEstadoAnterior, [update.id_HistorialPrestamos]);
      if (rows.length === 0) {
        continue; // Si no se encuentra el préstamo, continuar con el siguiente
      }

      const estadoAnterior = rows[0].estado;
      const codigoLibro = rows[0].codigo_libro;

      // Actualizar el estado del préstamo
      await dbConnection.query(queryActualizarPrestamos, [update.estado, update.id_HistorialPrestamos]);

      // Actualizar la cantidad de libros si el estado cambia a "Entregado" o "Devuelto"
      if (estadoAnterior !== update.estado) {
        if (update.estado === 'Entregado') {
          await dbConnection.query(queryActualizarCantidadLibro, [-1, codigoLibro]);
        } else if (estadoAnterior === 'Entregado' && update.estado === 'Devuelto') {
          await dbConnection.query(queryActualizarCantidadLibro, [1, codigoLibro]);
        }
      }
    }
    res.redirect('/actualizacion-prestamo-exitosa');
  } catch (err) {
    console.error('Error al actualizar el estado del préstamo:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  solicitarPrestamo,
  consultarPrestamosPorEstadoOCodigo,
  consultarHistorialPrestamos,
  actualizarEstadoPrestamo
};
