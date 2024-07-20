const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const path = require('path');
const hbs = require('hbs');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { createConnection } = require('./database/database');
const routes = require('./routes/routes');

const app = express();
const PORT = process.env.PORT || 3000;

let dbConnection;

// Función para conectar a la base de datos
async function conectarDB() {
  try {
    dbConnection = await createConnection();
    console.log('Conexión a la base de datos establecida.');
  } catch (error) {
    console.error('Error al conectar a la base de datos:', error);
  }
}

// Middleware para inyectar la conexión a la base de datos en `req`
app.use((req, res, next) => {
  if (!dbConnection) {
    return res.status(500).send('No hay conexión a la base de datos.');
  }
  req.db = dbConnection;
  next();
});

// Conectar a la base de datos al iniciar la aplicación
conectarDB();

// Configuración del puerto
app.set('port', PORT);

// Middleware
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Configurar el motor de plantillas HBS y los parciales
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
hbs.registerPartials(path.join(__dirname, "views/partials"));

// Middleware para servir contenido estático
app.use(express.static(path.join(__dirname, "public")));

// Ruta raíz para redirigir a la selección de usuario
app.get("/", (req, res) => {
  res.redirect("/seleccion-usuario");
});

// Ruta para selección de usuario
app.get("/seleccion-usuario", (req, res) => {
  res.render("pages/seleccion-usuario-page/seleccion-usuario", {
    title: "Seleccionar Tipo de Usuario",
    layout: "layouts/auth",
  });
});

// Rutas para login de docente
app.get("/login/docente", (req, res) => {
  res.render("pages/login-docente-page/login-docente", {
    title: `Login para docentes`,
    layout: "layouts/auth",
  });
});

// Ruta para login de estudiante
app.get("/login/estudiante", (req, res) => {
  res.render("pages/login-estudiante-page/login-estudiante", {
    title: "Login para Estudiantes",
    layout: "layouts/auth",
  });
});

// Ruta para login de personal de apoyo
app.get("/login/personal", (req, res) => {
  res.render("pages/login-personal-page/login-personal", {
    title: "Login para Personal de Apoyo",
    layout: "layouts/auth",
  });
});

// Ruta para login de administrador
app.get("/login/administrador", (req, res) => {
  res.render("pages/login-administrador-page/login-administrador", {
    title: "Login para Administradores",
    layout: "layouts/auth",
  });
});

// Ruta para logout
app.get("/logout", (req, res) => {
  res.redirect("/seleccion-usuario");
});

// Importar y usar las rutas adicionales
app.use("/", routes);

// Ruta para manejar errores 404
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "404.html"));
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});

module.exports = dbConnection;
