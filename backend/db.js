const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');

let db = null;

// Inicializar la base de datos
const initDb = async () => {
  const SQL = await initSqlJs();

  // Cargar DB existente o crear nueva
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Crear tabla de usuarios
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      circle_member_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Guardar cambios
  saveDb();

  console.log('Database initialized successfully');
  return db;
};

// Guardar DB a archivo
const saveDb = () => {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
};

// Obtener instancia de DB (inicializa si es necesario)
const getDb = async () => {
  if (!db) {
    await initDb();
  }
  return db;
};

// Funciones de usuario
const createUser = async ({ email, password_hash, name, circle_member_id }) => {
  const database = await getDb();

  database.run(
    `INSERT INTO users (email, password_hash, name, circle_member_id) VALUES (?, ?, ?, ?)`,
    [email, password_hash, name, circle_member_id]
  );

  // Obtener el ID del usuario insertado
  const result = database.exec('SELECT last_insert_rowid() as id');
  const id = result[0].values[0][0];

  saveDb();

  return { id, email, name, circle_member_id };
};

const findUserByEmail = async (email) => {
  const database = await getDb();

  const result = database.exec(
    `SELECT * FROM users WHERE email = ?`,
    [email]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }

  const columns = result[0].columns;
  const values = result[0].values[0];

  // Convertir a objeto
  const user = {};
  columns.forEach((col, i) => {
    user[col] = values[i];
  });

  return user;
};

const findUserById = async (id) => {
  const database = await getDb();

  const result = database.exec(
    `SELECT * FROM users WHERE id = ?`,
    [id]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }

  const columns = result[0].columns;
  const values = result[0].values[0];

  // Convertir a objeto
  const user = {};
  columns.forEach((col, i) => {
    user[col] = values[i];
  });

  return user;
};

const updateCircleMemberId = async (id, circle_member_id) => {
  const database = await getDb();

  database.run(
    `UPDATE users SET circle_member_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [circle_member_id, id]
  );

  saveDb();
};

// Inicializar si se ejecuta directamente
if (require.main === module) {
  initDb().then(() => {
    console.log('Database setup complete');
    process.exit(0);
  });
}

module.exports = {
  initDb,
  getDb,
  createUser,
  findUserByEmail,
  findUserById,
  updateCircleMemberId
};
