const consultarCubiculos = async (req, res, returnDataOnly = false) => {
  // Llamar a la función de actualización automática antes de consultar
  await actualizarEstadoCubiculosAutomaticamente(req);

  const query = `
    SELECT 
      c.cubiculo_id, 
      c.estado AS cubiculo_estado,
      r.hora_inicio,
      r.hora_fin,
      r.estado AS reserva_estado,
      r.fecha AS reserva_fecha
    FROM 
      cubiculo c
    LEFT JOIN (
      SELECT 
        cubiculo_id,
        MAX(hora_inicio) AS max_hora_inicio
      FROM 
        reserva_cubiculo
      WHERE fecha = CURDATE() -- Solo considerar reservas del día actual
      GROUP BY 
        cubiculo_id
    ) AS subquery
    ON 
      c.cubiculo_id = subquery.cubiculo_id
    LEFT JOIN 
      reserva_cubiculo r 
    ON 
      c.cubiculo_id = r.cubiculo_id
      AND subquery.max_hora_inicio = r.hora_inicio;
  `;

  try {
    const [results] = await req.db.execute(query);
    console.log('Resultados de la consulta:', results.length); // Log para ver la cantidad de resultados obtenidos

    const ahora = new Date();

    const cubiculosConImagenes = results.map(cubiculo => {
      let estado = cubiculo.cubiculo_estado;
      if (cubiculo.hora_inicio && cubiculo.hora_fin) {
        const horaInicio = new Date(`1970-01-01T${cubiculo.hora_inicio}Z`);
        const horaFin = new Date(`1970-01-01T${cubiculo.hora_fin}Z`);

        if (ahora >= horaInicio && ahora < horaFin && cubiculo.reserva_fecha === new Date().toISOString().split('T')[0]) {
          estado = cubiculo.reserva_estado;
        }
      }
      return {
        cubiculo_id: cubiculo.cubiculo_id,
        estado,
        imagenUrl: estado.toLowerCase() === 'disponible' ? '/images/cubiculo-disponible.png' : '/images/cubiculo-ocupado.png'
      };
    });

    console.log('Cubículos procesados:', cubiculosConImagenes.length); // Log para ver la cantidad de cubículos procesados

    if (returnDataOnly) {
      return cubiculosConImagenes;
    }
    res.json(cubiculosConImagenes);
  } catch (err) {
    res.status(500).send(err);
  }
};

const consultarCubiculosPorHora = async (req, res) => {
  const { hora } = req.query;

  if (!hora) {
    const horasDisponibles = [];
    for (let i = 8; i <= 17; i++) {
      const horaStr1 = i.toString().padStart(2, '0') + ":00";
      const horaStr2 = i.toString().padStart(2, '0') + ":30";
      horasDisponibles.push(horaStr1, horaStr2);
    }

    return res.render("pages/consultar-cubiculo-page/consultar-cubiculo", {
      title: "Consultar Cubículo - Biblioteca de la FISI",
      layout: "layouts/main",
      horasDisponibles
    });
  }

  const query = `
    SELECT 
        c.cubiculo_id, 
        c.estado AS cubiculo_estado,
        r.hora_inicio,
        r.hora_fin,
        r.estado AS reserva_estado
    FROM 
        cubiculo c
    LEFT JOIN (
      SELECT 
        cubiculo_id,
        MAX(hora_inicio) AS max_hora_inicio
      FROM 
        reserva_cubiculo
      WHERE CURDATE() = fecha AND (
        (TIME(hora_inicio) <= TIME(?) AND TIME(hora_fin) > TIME(?)) OR
        (TIME(hora_inicio) < ADDTIME(TIME(?), '00:30:00') AND TIME(hora_fin) >= TIME(?))
      )
      GROUP BY 
        cubiculo_id
    ) AS subquery
    ON 
      c.cubiculo_id = subquery.cubiculo_id
    LEFT JOIN 
      reserva_cubiculo r 
    ON 
      c.cubiculo_id = r.cubiculo_id
      AND subquery.max_hora_inicio = r.hora_inicio
  `;

  try {
    const [results] = await req.db.execute(query, [hora, hora, hora, hora]);
    
    const cubiculosConEstado = results.map(cubiculo => {
      let estado = 'Disponible';
      if (cubiculo.hora_inicio && cubiculo.hora_fin) {
        estado = 'Ocupado';
      }
      return {
        cubiculo_id: cubiculo.cubiculo_id,
        estado,
        imagenUrl: estado.toLowerCase() === 'disponible' ? '/images/cubiculo-disponible.png' : '/images/cubiculo-ocupado.png',
        hora_fin: cubiculo.hora_fin
      };
    });

    const disponibles = cubiculosConEstado.filter(c => c.estado === 'Disponible');
    const ocupados = cubiculosConEstado.filter(c => c.estado === 'Ocupado');

    let cubiculoProximo = 'N/A';
    let horaProximoDesocupar = 'N/A';
    if (ocupados.length > 0) {
      // Encontrar el cubículo cuya hora de fin está más cerca de la hora de consulta
      const cubiculoCercano = ocupados.reduce((prev, curr) => {
        return (new Date(`1970-01-01T${curr.hora_fin}Z`) < new Date(`1970-01-01T${prev.hora_fin}Z`)) ? curr : prev;
      });
      cubiculoProximo = cubiculoCercano.cubiculo_id;
      horaProximoDesocupar = cubiculoCercano.hora_fin;
    }

    const response = {
      cantidadDisponibles: disponibles.length,
      cubiculoProximo,
      horaProximoDesocupar,
      cubiculos: cubiculosConEstado
    };

    res.json(response);
  } catch (err) {
    res.status(500).send({ message: 'Error al consultar cubículos por hora', error: err.message });
  }
};

const registrarReservaCubiculo = async (req, res) => {
  const { cubiculoId, codigoEstudiante } = req.body;

  // Obtener la hora actual en la zona horaria local
  const ahora = new Date();
  const formatoHora = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Lima' // Cambia esto a tu zona horaria si es necesario
  });

  const horaInicio = formatoHora.format(ahora); // Hora actual en formato HH:MM:SS
  const horaFinDate = new Date(ahora.getTime() + 60 * 60 * 1000); // Añadir 1 hora
  const horaFin = formatoHora.format(horaFinDate);

  // Verificar si el cubículo está disponible
  const queryVerificar = `
    SELECT 
      r.hora_inicio, r.hora_fin
    FROM 
      reserva_cubiculo r 
    WHERE 
      r.cubiculo_id = ? AND
      CURDATE() = r.fecha AND
      ((TIME(r.hora_inicio) <= TIME(?) AND TIME(r.hora_fin) > TIME(?)) OR
      (TIME(r.hora_inicio) < TIME(?) AND TIME(r.hora_fin) >= TIME(?)))
  `;

  try {
    const [reservasExistentes] = await req.db.execute(queryVerificar, [cubiculoId, horaInicio, horaInicio, horaFin, horaFin]);
    if (reservasExistentes.length > 0) {
      const cubiculos = await consultarCubiculos(req, res, true);
      return res.render("pages/reservar-cubiculo-page/reservar-cubiculo", {
        error: "El cubículo seleccionado está Ocupado en este horario.",
        layout : "layouts/main",
        cubiculos,
        tipoUsuario: req.body.tipoUsuario,
      });
    }

    // Registrar la reserva en la tabla reserva_cubiculo
    const queryReserva = `
      INSERT INTO reserva_cubiculo (cubiculo_id, codigo_estudiante, fecha, hora_inicio, hora_fin, estado)
      VALUES (?, ?, CURDATE(), ?, ?, 'Ocupado')
    `;
    await req.db.execute(queryReserva, [cubiculoId, codigoEstudiante, horaInicio, horaFin]);

    // Actualizar el estado del cubículo en la tabla cubiculo
    const queryCubiculo = `
      UPDATE cubiculo
      SET estado = 'Ocupado'
      WHERE cubiculo_id = ?
    `;
    await req.db.execute(queryCubiculo, [cubiculoId]);

    res.redirect(`/reserva-exitosa?cubiculo=${cubiculoId}&codigoEstudiante=${codigoEstudiante}&horaInicio=${horaInicio}&horaFin=${horaFin}&tipoUsuario=${req.body.tipoUsuario}`);
  } catch (err) {
    console.error('Error al registrar la reserva:', err);
    res.status(500).send({ message: 'Error al registrar la reserva', error: err.message });
  }
};

const actualizarEstadoCubiculo = async (req, res) => {
  const { cubiculoId, estado } = req.body;

  // Obtener la hora actual en la zona horaria local
  const ahora = new Date();
  const formatoHora = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Lima' // Cambia esto a tu zona horaria si es necesario
  });

  const horaFin = formatoHora.format(ahora); // Hora actual en formato HH:MM:SS

  try {
    // Verificar el estado actual del cubículo en la tabla `cubiculo`
    const queryEstadoCubiculo = `
      SELECT estado
      FROM cubiculo
      WHERE cubiculo_id = ?
    `;
    const [cubiculoResult] = await req.db.execute(queryEstadoCubiculo, [cubiculoId]);

    if (cubiculoResult.length === 0) {
      throw new Error('Cubículo no encontrado');
    }

    const estadoActualCubiculo = cubiculoResult[0].estado;

    // Verificar el estado actual de la reserva en la tabla `reserva_cubiculo`
    const queryEstadoReserva = `
      SELECT estado, hora_inicio
      FROM reserva_cubiculo
      WHERE cubiculo_id = ? AND hora_inicio = (
        SELECT MAX(hora_inicio)
        FROM reserva_cubiculo
        WHERE cubiculo_id = ?
      )
    `;
    const [reservaResult] = await req.db.execute(queryEstadoReserva, [cubiculoId, cubiculoId]);

    if (reservaResult.length === 0) {
      throw new Error('Reserva no encontrada');
    }

    const estadoActualReserva = reservaResult[0].estado;
    const horaInicio = reservaResult[0].hora_inicio;

    // Si el nuevo estado es "Ocupado"
    if (estado === 'Ocupado') {
      // Actualizar la hora_fin de la reserva a la hora actual
      const actualizarReservaQuery = `
        UPDATE reserva_cubiculo
        SET estado = 'Ocupado', hora_fin = ?
        WHERE cubiculo_id = ? AND hora_inicio = ?
      `;
      await req.db.execute(actualizarReservaQuery, [horaFin, cubiculoId, horaInicio]);

      // Actualizar el estado del cubículo a "Ocupado"
      const queryCubiculo = `
        UPDATE cubiculo
        SET estado = ?
        WHERE cubiculo_id = ?
      `;
      await req.db.execute(queryCubiculo, [estado, cubiculoId]);
    } else if (estado === 'Disponible') {
      // Actualizar el estado de la reserva a "Disponible" y la hora_fin a la hora actual
      const actualizarReservaQuery = `
        UPDATE reserva_cubiculo
        SET estado = 'Disponible', hora_fin = ?
        WHERE cubiculo_id = ? AND estado = 'Ocupado'
      `;
      await req.db.execute(actualizarReservaQuery, [horaFin, cubiculoId]);

      // Actualizar el estado del cubículo a "Disponible"
      const queryCubiculo = `
        UPDATE cubiculo
        SET estado = 'Disponible'
        WHERE cubiculo_id = ?
      `;
      await req.db.execute(queryCubiculo, [cubiculoId]);
    }

    res.redirect(`/actualizacion-exitosa?cubiculo=${cubiculoId}&estado=${estado}&horaFin=${horaFin}`);
  } catch (err) {
    console.error('Error al actualizar el estado del cubículo:', err);
    res.status(500).send({ message: 'Error al actualizar el estado del cubículo', error: err.message });
  }
};

const actualizarEstadoCubiculosAutomaticamente = async (req) => {
  // Obtener la hora actual en la zona horaria local
  const ahora = new Date();
  const formatoHora = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Lima' // Cambia esto a tu zona horaria si es necesario
  });

  const horaActual = formatoHora.format(ahora); // Hora actual en formato HH:MM:SS

  try {
    // Verificar y actualizar los cubículos que han pasado su hora de fin
    const queryActualizarCubiculos = `
      UPDATE cubiculo c
      JOIN reserva_cubiculo r ON c.cubiculo_id = r.cubiculo_id
      SET c.estado = 'Disponible', r.estado = 'Finalizado'
      WHERE r.hora_fin <= ? AND r.estado = 'Ocupado' AND r.fecha = CURDATE();
    `;
    await req.db.execute(queryActualizarCubiculos, [horaActual]);

    console.log('Actualización automática de estados completada');
  } catch (err) {
    console.error('Error al actualizar estados automáticamente:', err);
  }
};

module.exports = {
  consultarCubiculos,
  consultarCubiculosPorHora,
  registrarReservaCubiculo,
  actualizarEstadoCubiculo,
  actualizarEstadoCubiculosAutomaticamente, // Exportar la nueva función
};
