const express = require("express");
const cron = require('node-cron');
const router = express.Router();

const cubiculoController = require("../controllers/cubiculoController");
const libroController = require("../controllers/libroController");
const prestamoController = require("../controllers/prestamoController");
const usuarioController = require("../controllers/usuarioController");

// Tarea que se ejecuta cada minuto
cron.schedule('* * * * *', () => {
  const req = {}; // Construir el objeto req según sea necesario
  actualizarEstadoCubiculosAutomaticamente(req);
});

// Formularios de login
router.get("/login/:usuario", (req, res) => {
  const usuario = req.params.usuario;
  if (usuario === "docente") {
    res.render("pages/login-docente-page/login-docente", {
      usuario,
      layout: "layouts/auth",
    });
  } else if (usuario === "estudiante") {
    res.render("pages/login-estudiante-page/login-estudiante", {
      usuario,
      layout: "layouts/auth",
    });
  } else if (usuario === "personal") {
    res.render("pages/login-personal-page/login-personal", {
      layout: "layouts/auth",
    });
  } else if (usuario === "administrador") {
    res.render("pages/login-administrador-page/login-administrador", { // Asegúrate de que la ruta y el nombre del archivo sean correctos
      layout: "layouts/auth",
    });
  } else {
    res.redirect("/seleccion-usuario");
  }
});

// Manejar POST de login
router.post("/login/:usuario", async (req, res) => {
  const usuario = req.params.usuario;
  const { correo, password } = req.body;

  try {
    const result = await usuarioController.login(req.db, correo, password);

    if (result.success) {
      // Login exitoso, redirigir al inicio correspondiente
      if (usuario === "docente") {
        res.redirect("/inicio-docente");
      } else if (usuario === "estudiante") {
        res.redirect("/inicio-estudiante");
      } else if (usuario === "personal") {
        res.redirect("/inicio-personal");
      } else if (usuario === "administrador") {
        res.redirect("/inicio-administrador");
      }
    } else {
      res.render(`pages/login-${usuario}-page/login-${usuario}`, {
        usuario,
        layout: "layouts/auth",
        error: result.message,
      });
    }
  } catch (error) {
    console.error('Error al manejar el login:', error);
    res.status(500).send('Error en el servidor.');
  }
});

// Rutas existentes
router.get("/inicio-estudiante", (req, res) => {
  res.render("pages/inicio-estudiante-page/inicio-estudiante", {
    title: "Inicio Estudiantes - Biblioteca de la FISI",
    layout: "layouts/main-estudiante",
  });
});

router.get("/inicio-docente", (req, res) => {
  res.render("pages/inicio-docente-page/inicio-docente", {
    title: "Inicio Docentes - Biblioteca de la FISI",
    layout: "layouts/main-docente",
  });
});

router.get("/inicio-personal", (req, res) => {
  res.render("pages/inicio-personal-page/inicio-personal", {
    title: "Inicio Personal - Biblioteca de la FISI",
    layout: "layouts/main",
  });
});

router.get("/inicio-administrador", (req, res) => {
  res.render("pages/inicio-administrador-page/inicio-administrador", {
    title: "Inicio Administrador - Biblioteca de la FISI",
    layout: "layouts/main-administrador",
  });
});

router.get("/consultar-datos", (req, res) => {
  if (req.query.codigo_estudiante) {
    usuarioController.consultarUsuario(req, res);
  } else {
    res.render("pages/consultar-datos-page/consultar-datos", {
      title: "Consultar Datos - Biblioteca de la FISI",
      layout: "layouts/main",
    });
  }
});


// Ruta para mostrar la página de consultar libro y obtener los datos del libro seleccionado
router.get('/consultar-libro/:tipoUsuario', async (req, res) => {
  const { tipoUsuario } = req.params;
  const { titulo_libro } = req.query;
  let layout = 'layouts/main'; // Default layout

  switch (tipoUsuario) {
      case 'estudiante':
          layout = 'layouts/main-estudiante';
          break;
      case 'docente':
          layout = 'layouts/main-docente';
          break;
      case 'personal':
          layout = 'layouts/main';
          break;
      default:
          return res.redirect('/seleccion-usuario');
  }

  if (titulo_libro) {
      // Si hay un título de libro en los parámetros de consulta, obtener los datos del libro
      try {
          const [libros] = await req.db.query('SELECT * FROM libro WHERE nombre = ?', [titulo_libro]);
          if (libros.length > 0) {
              return res.json(libros);
          } else {
              return res.status(404).json({ message: 'Libro no encontrado' });
          }
      } catch (err) {
          console.error('Error al obtener el libro:', err);
          return res.status(500).json({ message: 'Error al obtener el libro' });
      }
  } else {
      // Si no hay título de libro en los parámetros de consulta, renderizar la página
      try {
          const [libros] = await req.db.query('SELECT nombre FROM libro');
          res.render('pages/consultar-libro-page/consultar-libro', {
              title: 'Consultar Libro - Biblioteca de la FISI',
              layout: layout,
              tipoUsuario,
              libros
          });
      } catch (err) {
          console.error('Error al obtener los libros:', err);
          return res.status(500).send(err.message);
      }
  }
});

router.get("/solicitar-prestamo/:tipoUsuario", async (req, res) => {
  const { tipoUsuario } = req.params;
  const libros = await libroController.consultarLibros(req, res);

  let layout = 'layouts/main'; // Layout por defecto

  switch (tipoUsuario) {
    case 'estudiante':
      layout = 'layouts/main-estudiante';
      break;
    case 'docente':
      layout = 'layouts/main-docente';
      break;
    case 'personal':
      layout = 'layouts/main';
      break;
    default:
      return res.redirect('/seleccion-usuario');
  }

  res.render("pages/solicitar-prestamo-page/solicitar-prestamo", {
    title: "Solicitar Préstamo - Biblioteca de la FISI",
    layout: layout,
    libros,
    tipoUsuario
  });
});

// Ruta para manejar la solicitud de préstamo
router.get("/solicitar-prestamo/:tipoUsuario", async (req, res) => {
  const { tipoUsuario } = req.params;
  const libros = await libroController.consultarLibros(req, res);

  let layout = 'layouts/main'; // Layout por defecto

  switch (tipoUsuario) {
    case 'estudiante':
      layout = 'layouts/main-estudiante';
      break;
    case 'docente':
      layout = 'layouts/main-docente';
      break;
    case 'personal':
      layout = 'layouts/main';
      break;
    default:
      return res.redirect('/seleccion-usuario');
  }

  res.render("pages/solicitar-prestamo-page/solicitar-prestamo", {
    title: "Solicitar Préstamo - Biblioteca de la FISI",
    layout: layout,
    libros,
    tipoUsuario
  });
});

// Ruta para manejar la solicitud de préstamo
router.post("/solicitar-prestamo", prestamoController.solicitarPrestamo);

// Ruta para mostrar la página de solicitud realizada
router.get("/solicitud-realizada", (req, res) => {
  const { codigo, libro, fecha, horaLimite, tipoUsuario } = req.query;
  let layout = 'layouts/main'; // Layout por defecto

  switch (tipoUsuario) {
    case 'estudiante':
      layout = 'layouts/main-estudiante';
      break;
    case 'docente':
      layout = 'layouts/main-docente';
      break;
    case 'personal':
      layout = 'layouts/main';
      break;
    default:
      return res.redirect('/seleccion-usuario');
  }

  res.render("pages/solicitar-prestamo-page/solicitud-realizada", {
    title: "Solicitud Realizada - Biblioteca de la FISI",
    layout: layout,
    codigo,
    libro,
    fecha,
    horaLimite,
    tipoUsuario,
  });
});

// Ruta para mostrar la página de actualizar estado de préstamo
router.get("/actualizar-estado-de-prestamo", (req, res) => {
  res.render(
    "pages/actualizar-estado-de-prestamo-page/actualizar-estado-de-prestamo",
    {
      title: "Actualizar Estado de Préstamo - Biblioteca de la FISI",
      layout: "layouts/main",
    }
  );
});

router.get('/consultar-prestamos-por-estado-o-codigo', prestamoController.consultarPrestamosPorEstadoOCodigo);

router.post('/actualizar-estado-prestamo', prestamoController.actualizarEstadoPrestamo);

router.get("/actualizacion-prestamo-exitosa", (req, res) => {
  res.render(
    "pages/actualizar-estado-de-prestamo-page/actualizacion-prestamo-exitosa",
    {
      title:
        "Actualizacion de Estado de Prestamo Exitosa - Biblioteca de la FISI",
      layout: "layouts/main",
    }
  );
});

router.get("/consultar-historial-de-prestamos", async (req, res) => {
  try {
    const [libros] = await req.db.query('SELECT nombre FROM Libro');
    res.render("pages/consultar-historial-de-prestamos-page/consultar-historial-de-prestamos", {
      title: "Consultar Historial de Préstamos - Biblioteca de la FISI",
      layout: "layouts/main",
      libros: libros
    });
  } catch (err) {
    console.error('Error al obtener los libros:', err);
    res.status(500).send(err.message);
  }
});

router.get("/consultar-historial-de-prestamos/datos", prestamoController.consultarHistorialPrestamos);

// Ruta para verificar el personal
router.get('/cambiar-contrasena', usuarioController.verificarPersonal);

// Ruta para actualizar la contraseña
router.post('/usuarios/actualizarContrasena', usuarioController.actualizarContrasena);

router.get("/reservar-cubiculo/:tipoUsuario", async (req, res) => {
  const { tipoUsuario } = req.params;
  let layout = "layouts/main";

  switch (tipoUsuario) {
    case "estudiante":
      layout = "layouts/main-estudiante";
      break;
    case "personal":
      layout = "layouts/main";
      break;
    default:
      return res.redirect("/seleccion-usuario");
  }

  try {
    const cubiculos = await cubiculoController.consultarCubiculos(req, res, true);
    if (!res.headersSent) {
      res.render("pages/reservar-cubiculo-page/reservar-cubiculo", {
        title: "Reservar Cubículo - Biblioteca de la FISI",
        layout: layout,
        cubiculos,
        tipoUsuario,
      });
    }
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).send(err);
    }
  }
});

router.post("/reservar-cubiculo/:tipoUsuario", async (req, res) => {
  const { tipoUsuario } = req.params;
  const { codigoEstudiante, cubiculoId } = req.body;

  console.log(`Código del estudiante recibido: ${codigoEstudiante}`);
  console.log(`Tipo de usuario: ${tipoUsuario}`);
  console.log(`Cubículo seleccionado: ${cubiculoId}`);

  try {
    let estudianteValido = true;

    if (tipoUsuario === "estudiante" || tipoUsuario === "personal") {
      estudianteValido = await usuarioController.verificarEstudiante(req.db, codigoEstudiante);
      console.log(`Estudiante válido: ${estudianteValido}`);
    }

    if (estudianteValido) {
      await cubiculoController.registrarReservaCubiculo(req, res);
    } else {
      const cubiculos = await cubiculoController.consultarCubiculos(req, res, true);
      return res.render("pages/reservar-cubiculo-page/reservar-cubiculo", {
        error: "Estudiante no encontrado",
        layout: "layouts/main",
        cubiculos,
        tipoUsuario,
      });
    }
  } catch (error) {
    console.error('Error al verificar el estudiante:', error);
    if (!res.headersSent) {
      return res.status(500).send('Error en el servidor al verificar el estudiante.');
    }
  }
});

router.get("/reserva-exitosa", (req, res) => {
  const { cubiculo, codigoEstudiante, tipoUsuario } = req.query;
  const horaInicio = new Date().toLocaleTimeString();

  let layout = "layouts/main";

  switch (tipoUsuario) {
    case "personal":
      layout = "layouts/main";
      break;
    case "estudiante":
      layout = "layouts/main-estudiante";
      break;
    default:
      return res.redirect("/seleccion-usuario");
  }

  res.render("pages/reservar-cubiculo-page/reserva-exitosa", {
    title: "Reserva Exitosa - Biblioteca de la FISI",
    layout: layout,
    cubiculo,
    codigoEstudiante,
    horaInicio,
    tipoUsuario,
  });
});

router.get("/consultar-cubiculo", cubiculoController.consultarCubiculosPorHora);

router.get("/actualizar-estado-de-cubiculo", async (req, res) => {
  try {
    const cubiculos = await cubiculoController.consultarCubiculos(req, res, true);
    res.render("pages/actualizar-estado-de-cubiculo-page/actualizar-estado-de-cubiculo", {
      title: "Actualizar Estado de Cubículo - Biblioteca de la FISI",
      layout: "layouts/main",
      cubiculos
    });
  } catch (err) {
    res.status(500).send(err);
  }
});

router.post("/actualizar-estado-de-cubiculo", (req, res, next) => {
  console.log(req.body);
  next();
}, cubiculoController.actualizarEstadoCubiculo);

router.get("/actualizacion-exitosa", (req, res) => {
  const { cubiculo, estado, horaReserva } = req.query;

  res.render("pages/actualizar-estado-de-cubiculo-page/actualizacion-exitosa", {
    title: "Actualización Exitosa - Biblioteca de la FISI",
    layout: "layouts/main",
    cubiculo,
    estado,
    horaReserva,
  });
});

//Ruta para cambiar de contraseña
router.get("/cambiar-contrasena", (req, res) => {
  res.render("pages/cambiar-contrasena-page/cambiar-contrasena", {
    title: "Cambiar contraseña - Biblioteca de la FISI",
    layout: "layouts/main-administrador",
  });
});

module.exports = router;
