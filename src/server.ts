import cors from 'cors';
import express from 'express';
import fs from 'fs';
// В ESM (NodeNext) обязательно указывать расширение .js при импорте локальных файлов
import db, { initDb } from './database.js';
// import { PriceCalculator } from './pricing.js'; // Убрал, так как пока не используем

const app = express();
app.use(cors());
app.use(express.json());

// Инициализация БД
initDb();

// SEED (Загрузка данных)
app.post('/api/seed', (req, res) => {
  try {
    // Читаем файл синхронно (для скрипта инициализации это ок)
    const rawData = JSON.parse(
      fs.readFileSync('products_initial.json', 'utf-8')
    );

    const insert = db.prepare(`
      INSERT OR REPLACE INTO products (sku, name, stock, costPrice, currentPrice, salesQty, abcMargin, marginTotal, sourceStatus)
      VALUES (@sku, @name, @stock, @costPrice, @currentPrice, @salesQty, @abcMargin, @marginTotal, @sourceStatus)
    `);

    const insertMany = db.transaction((products: any[]) => {
      for (const p of products) {
        if (p.stock <= 0 || p.sourceStatus === 'ABC_Only') continue;
        insert.run(p);
      }
    });

    insertMany(rawData);
    res.json({ success: true, message: 'Database seeded' });
  } catch (err) {
    console.error(err);
    // Приводим тип ошибки к any или Error для доступа к message
    res
      .status(500)
      .json({ error: 'Seed failed', details: (err as Error).message });
  }
});

// GET PRODUCTS
app.get('/api/products', (req, res) => {
  const { page = 1, limit = 50, status = 'pending', q = '' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let sql = `
    SELECT *, 
    (currentPrice * 0.05 * (salesQty / 365.0)) as daily_loss 
    FROM products 
    WHERE 1=1
  `;

  const params: any[] = [];

  if (status !== 'all') {
    sql += ` AND status = ?`;
    params.push(status);
  }

  if (q) {
    sql += ` AND (sku LIKE ? OR name LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
  }

  sql += `
    ORDER BY 
      CASE abcMargin 
        WHEN 'A' THEN 1 
        WHEN 'B' THEN 2 
        WHEN 'C' THEN 3 
        ELSE 4 
      END ASC,
      daily_loss DESC
    LIMIT ? OFFSET ?
  `;
  params.push(Number(limit), offset);

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// PATCH PRODUCT
app.patch('/api/products/:sku', (req, res) => {
  const { sku } = req.params;
  const { new_price, status, manual_flag } = req.body;

  const updates: string[] = [];
  const params: any[] = [];

  if (new_price !== undefined) {
    updates.push('new_price = ?');
    params.push(new_price);
  }
  if (status !== undefined) {
    updates.push('status = ?');
    params.push(status);
  }
  if (manual_flag !== undefined) {
    updates.push('manual_flag = ?');
    params.push(manual_flag ? 1 : 0);
  }

  params.push(sku);

  const sql = `UPDATE products SET ${updates.join(', ')} WHERE sku = ?`;
  db.prepare(sql).run(...params);

  res.json({ success: true });
});

app.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
});
