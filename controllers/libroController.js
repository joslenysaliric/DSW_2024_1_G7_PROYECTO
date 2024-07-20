const consultarLibros = async (req, res) => {
  const query = 'SELECT * FROM Libro';
  try {
    const [results] = await req.db.query(query);
    return results; // Retornamos los resultados para usarlos en la plantilla
  } catch (err) {
    console.error('Error al consultar los libros:', err);
    res.status(500).send(err.message);
  }
};

module.exports = {
  consultarLibros
};
