require('dotenv').config();
const mysql = require('mysql2');

// Configurar la conexión a MySQL
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root', // Usuario de MySQL
  password: '', // Si usas XAMPP, la contraseña está vacía por defecto
  database: 'SALOMEDB'
});

// Conectar a la base de datos
connection.connect(err => {
  if (err) {
    console.error("❌ Error conectando a MySQL:", err);
    return;
  }
  console.log("✅ Conectado a MySQL");
});

module.exports = connection;
