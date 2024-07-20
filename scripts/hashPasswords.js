const bcryptjs = require('bcryptjs');
const mysql = require('mysql2/promise');

async function hashAndStorePasswords() {
  // Create a connection to the database
  const connection = await mysql.createConnection({
    host: 'localhost', // Update with your database host
    user: 'root', // Update with your database username
    password: 'toor', // Update with your database password
    database: 'bd_biblioteca', // Update with your database name
  });

  // Query to get all users
  const [users] = await connection.execute('SELECT id_usuario, contraseña FROM usuario');

  for (let user of users) {
    const { id_usuario, contraseña } = user;
    // Hash the plaintext password
    const hashedPassword = await bcryptjs.hash(contraseña, 10);

    // Update the user's password in the database
    await connection.execute('UPDATE usuario SET contraseña = ? WHERE id_usuario = ?', [hashedPassword, id_usuario]);

    console.log(`Password for user ID ${id_usuario} updated successfully.`);
  }

  console.log('All passwords updated successfully.');
  await connection.end();
}

hashAndStorePasswords().catch(console.error);
