import cors from 'cors';
import ExcelJS from 'exceljs';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// В ESM (NodeNext) обязательно указывать расширение .js при импорте локальных файлов
import db, { initDb } from './database.js';

const app = express();
app.use(cors());
app.use(express.json());

// Настройка для ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Раздача статики (например, для скачивания файлов)
app.use('/exports', express.static(path.join(__dirname, '../public/exports')));

// Инициализация БД
initDb();

// --- API ROUTES ---

// 1. SEED (Загрузка данных)
app.post('/api/seed', (req, res) => {
  try {
    const rawData = JSON.parse(
      fs.readFileSync('products_initial.json', 'utf-8')
    );

    const insert = db.prepare(`
      INSERT OR REPLACE INTO products (sku, name, stock, costPrice, currentPrice, salesQty, abcMargin, marginTotal, sourceStatus)
      VALUES (@sku, @name, @stock, @costPrice, @currentPrice, @salesQty, @abcMargin, @marginTotal, @sourceStatus)
    `);

    const insertMany = db.transaction((products: any[]) => {
      // Очищаем таблицу перед загрузкой (опционально, но полезно для seed)
      db.prepare('DELETE FROM products').run();

      for (const p of products) {
        if (p.stock <= 0 || p.sourceStatus === 'ABC_Only') continue;
        insert.run(p);
      }
    });

    insertMany(rawData);
    res.json({ success: true, message: 'Database seeded successfully' });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: 'Seed failed', details: (err as Error).message });
  }
});

// 2. GET PRODUCTS (С пагинацией и подсчетом total)
app.get('/api/products', (req, res) => {
  const { page = 1, limit = 50, status = 'pending', q = '' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  // Базовое условие
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  // Фильтры
  if (status !== 'all') {
    whereClause += ` AND status = ?`;
    params.push(status);
  }

  if (q) {
    whereClause += ` AND (sku LIKE ? OR name LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
  }

  // 1. Запрос данных
  const dataSql = `
    SELECT *, 
    (currentPrice * 0.05 * (salesQty / 365.0)) as daily_loss 
    FROM products 
    ${whereClause}
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

  // 2. Запрос общего количества (для пагинации)
  const countSql = `SELECT COUNT(*) as total FROM products ${whereClause}`;

  try {
    // Получаем общее кол-во
    const totalResult = db.prepare(countSql).get(...params) as {
      total: number;
    };

    // Получаем данные (добавляем limit/offset в параметры)
    const rows = db.prepare(dataSql).all(...params, Number(limit), offset);

    res.json({
      data: rows,
      meta: {
        total: totalResult.total,
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
});

// 3. PATCH PRODUCT
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

  if (updates.length > 0) {
    const sql = `UPDATE products SET ${updates.join(', ')} WHERE sku = ?`;
    db.prepare(sql).run(...params);
  }

  res.json({ success: true });
});

// 4. CREATE BATCH (Excel Export)
app.post('/api/batches/create', async (req, res) => {
  try {
    // 1. Находим все товары со статусом 'approved'
    const products = db
      .prepare(
        `
      SELECT sku, name, stock, costPrice, currentPrice, new_price 
      FROM products 
      WHERE status = 'approved'
    `
      )
      .all() as any[];

    if (products.length === 0) {
      res.status(400).json({ error: 'Нет одобренных товаров для экспорта' });
      return; // Важно прервать выполнение
    }

    // 2. Создаем Excel файл
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Export');

    worksheet.columns = [
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Наименование', key: 'name', width: 40 },
      { header: 'Остаток', key: 'stock', width: 10 },
      { header: 'Закуп', key: 'costPrice', width: 15 },
      { header: 'Старая цена', key: 'currentPrice', width: 15 },
      { header: 'Новая цена', key: 'new_price', width: 15 },
    ];

    worksheet.addRows(products);

    // 3. Сохраняем файл
    const batchId = Date.now();
    const dir = path.join(__dirname, '../public/exports');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filename = `batch_${batchId}.xlsx`;
    await workbook.xlsx.writeFile(path.join(dir, filename));

    // 4. Обновляем статус товаров на 'exported'
    const update = db.prepare(
      "UPDATE products SET status = 'exported' WHERE sku = ?"
    );
    const updateMany = db.transaction((items: any[]) => {
      for (const item of items) {
        update.run(item.sku);
      }
    });
    updateMany(products);

    res.json({
      success: true,
      batch_id: batchId,
      count: products.length,
      downloadUrl: `/exports/${filename}`,
    });
  } catch (err) {
    console.error('Export error:', err);
    res
      .status(500)
      .json({ error: 'Export failed', details: (err as Error).message });
  }
});

app.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
});
