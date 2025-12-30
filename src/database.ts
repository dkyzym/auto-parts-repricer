import Database from 'better-sqlite3';

// В ESM __dirname недоступен по умолчанию, используем относительный путь или process.cwd()
// process.cwd() обычно указывает на корень проекта, где лежит package.json
const db = new Database('database.sqlite', { verbose: console.log });

export const initDb = () => {
  const schema = `
    CREATE TABLE IF NOT EXISTS products (
      sku TEXT PRIMARY KEY,
      name TEXT,
      stock INTEGER,
      costPrice REAL,
      currentPrice REAL,
      salesQty INTEGER,
      abcMargin TEXT,
      marginTotal REAL,
      sourceStatus TEXT,
      new_price REAL DEFAULT NULL,
      status TEXT DEFAULT 'pending',
      batch_id INTEGER DEFAULT NULL,
      manual_flag INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      item_count INTEGER
    );
  `;
  db.exec(schema);
};

export default db;
