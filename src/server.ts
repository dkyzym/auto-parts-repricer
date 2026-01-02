import cors from 'cors';
import ExcelJS from 'exceljs';
import express from 'express';
import fs from 'fs';
import path from 'path';
import db, { initDb } from './database.js';

const app = express();
app.use(cors());
app.use(express.json());

// ОПРЕДЕЛЕНИЕ ПУТЕЙ
// Используем process.cwd() для надежной работы путей в любой среде
const PROJECT_ROOT = process.cwd();
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const EXPORTS_DIR = path.join(PUBLIC_DIR, 'exports');
const BACKUPS_DIR = path.join(PROJECT_ROOT, 'backups'); // Папка для бэкапов

// Гарантируем существование папок
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Раздача статики (для прямого доступа, если нужно)
app.use('/exports', express.static(EXPORTS_DIR));

// --- ВАЖНО: Настройка для поиска без учета регистра (Кириллица) ---
try {
  db.function('lower', { deterministic: true }, (text: unknown) => {
    if (typeof text === 'string') return text.toLowerCase();
    return text;
  });
} catch (err) {
  console.log('SQLite function registration skipped or failed:', err);
}

initDb();

// --- HELPER: СОЗДАНИЕ БЭКАПА ---
const createBackup = async (prefix = 'manual') => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${prefix}_${timestamp}.sqlite`;
  const dest = path.join(BACKUPS_DIR, filename);

  // better-sqlite3 имеет встроенный метод .backup(), который работает "на лету"
  await db.backup(dest);
  return filename;
};

// --- API ROUTES ---

// 1. SEED (Загрузка данных с АВТО-БЭКАПОМ)
app.post('/api/seed', async (req, res) => {
  console.log('--- SEED STARTED ---');

  // ШАГ 0: Создаем бэкап текущей базы перед удалением
  try {
    const backupName = await createBackup('before_seed');
    console.log(`Auto-backup created: ${backupName}`);
  } catch (bkpErr) {
    console.error(
      'Backup warning: Could not create backup before seed:',
      bkpErr
    );
    // Не прерываем процесс, но логируем ошибку
  }

  // ШАГ 1: Чтение и парсинг файла
  try {
    const jsonPath = path.join(PROJECT_ROOT, 'products_initial.json');
    console.log(`Reading file: ${jsonPath}`);

    if (!fs.existsSync(jsonPath)) {
      throw new Error(`Файл ${jsonPath} не найден`);
    }

    const fileContent = fs.readFileSync(jsonPath, 'utf-8');
    let rawData;
    try {
      rawData = JSON.parse(fileContent);
    } catch (e) {
      throw new Error('Ошибка парсинга JSON. Проверьте валидность файла.');
    }

    if (!Array.isArray(rawData)) {
      throw new Error('JSON должен быть массивом объектов');
    }

    console.log(`Found ${rawData.length} items in JSON.`);

    if (rawData.length > 0) {
      console.log('Sample item (first):', JSON.stringify(rawData[0], null, 2));
    }

    const insert = db.prepare(`
      INSERT OR REPLACE INTO products (sku, name, stock, costPrice, currentPrice, salesQty, abcMargin, marginTotal, sourceStatus)
      VALUES (@sku, @name, @stock, @costPrice, @currentPrice, @salesQty, @abcMargin, @marginTotal, @sourceStatus)
    `);

    const insertMany = db.transaction((products: any[]) => {
      console.log('Clearing old data...');
      db.prepare('DELETE FROM products').run();

      let inserted = 0;
      let skipped = 0;
      let skipReasons: Record<string, number> = {};

      for (const rawItem of products) {
        // Нормализация ключей
        const p = {
          sku: rawItem.sku || rawItem.SKU || rawItem.Sku,
          name: rawItem.name || rawItem.Name || rawItem.NAME,
          stock: rawItem.stock ?? rawItem.Stock ?? 0,
          costPrice: rawItem.costPrice || rawItem.CostPrice || 0,
          currentPrice: rawItem.currentPrice || rawItem.CurrentPrice || 0,
          salesQty: rawItem.salesQty || rawItem.SalesQty || 0,
          abcMargin: rawItem.abcMargin || rawItem.AbcMargin || 'N',
          marginTotal: rawItem.marginTotal || rawItem.MarginTotal || 0,
          sourceStatus: rawItem.sourceStatus || rawItem.SourceStatus || '',
        };

        if (!p.sku || !p.name) {
          skipped++;
          skipReasons['Missing SKU/Name'] =
            (skipReasons['Missing SKU/Name'] || 0) + 1;
          continue;
        }

        // Фильтр: Пропускаем только если < 0 (товары с 0 загружаем)
        if (Number(p.stock) < 0) {
          skipped++;
          skipReasons['Stock < 0'] = (skipReasons['Stock < 0'] || 0) + 1;
          continue;
        }

        if (p.sourceStatus === 'ABC_Only') {
          skipped++;
          skipReasons['Source=ABC_Only'] =
            (skipReasons['Source=ABC_Only'] || 0) + 1;
          continue;
        }

        insert.run(p);
        inserted++;
      }

      console.log(
        `Transaction finished. Inserted: ${inserted}, Skipped: ${skipped}`
      );
      console.log('Skip reasons:', skipReasons);
      return { inserted, skipped };
    });

    const result = insertMany(rawData);
    res.json({
      success: true,
      message: `База данных обновлена. Загружено: ${result.inserted}, Пропущено: ${result.skipped}`,
    });
  } catch (err) {
    console.error('Seed Error:', err);
    res
      .status(500)
      .json({ error: 'Seed failed', details: (err as Error).message });
  }
});

// 2. GET PRODUCTS (С пагинацией и поиском)
app.get('/api/products', (req, res) => {
  const { page = 1, limit = 50, status = 'pending', q = '' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (status !== 'all') {
    whereClause += ` AND status = ?`;
    params.push(status);
  }

  // Поиск по частям слов
  if (q) {
    const terms = String(q).trim().split(/\s+/);
    for (const term of terms) {
      if (term) {
        whereClause += ` AND (LOWER(sku) LIKE LOWER(?) OR LOWER(name) LIKE LOWER(?))`;
        params.push(`%${term}%`, `%${term}%`);
      }
    }
  }

  const dataSql = `
    SELECT *, 
    (currentPrice * 0.05 * (salesQty / 365.0)) as daily_loss 
    FROM products 
    ${whereClause}
    ORDER BY 
      CASE abcMargin WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 ELSE 4 END ASC,
      daily_loss DESC
    LIMIT ? OFFSET ?
  `;

  const countSql = `SELECT COUNT(*) as total FROM products ${whereClause}`;

  try {
    const totalResult = db.prepare(countSql).get(...params) as {
      total: number;
    };
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
    const products = db
      .prepare(`SELECT * FROM products WHERE status = 'approved'`)
      .all() as any[];

    if (products.length === 0) {
      res.status(400).json({ error: 'Нет одобренных товаров для экспорта' });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Export');

    worksheet.columns = [
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Наименование', key: 'name', width: 50 },
      { header: 'Старая цена', key: 'currentPrice', width: 15 },
      { header: 'Новая цена', key: 'new_price', width: 15 },
    ];

    worksheet.addRows(products);

    const batchId = Date.now();
    const filename = `batch_${batchId}.xlsx`;
    const filePath = path.join(EXPORTS_DIR, filename);

    await workbook.xlsx.writeFile(filePath);

    const update = db.prepare(
      "UPDATE products SET status = 'exported', batch_id = ? WHERE sku = ?"
    );
    const updateMany = db.transaction((items: any[]) => {
      for (const item of items) {
        update.run(batchId, item.sku);
      }
    });
    updateMany(products);

    res.json({
      success: true,
      batch_id: batchId,
      count: products.length,
      downloadUrl: `/api/download/${filename}`,
    });
  } catch (err) {
    console.error('Export error:', err);
    res
      .status(500)
      .json({ error: 'Export failed', details: (err as Error).message });
  }
});

// 5. DOWNLOAD FILE (Надежное скачивание)
app.get('/api/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const safeFilename = path.basename(filename);
  const filePath = path.join(EXPORTS_DIR, safeFilename);

  if (fs.existsSync(filePath)) {
    res.download(filePath, safeFilename, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) res.status(500).send('Error downloading file');
      }
    });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// 6. GET BATCHES HISTORY
app.get('/api/batches', (req, res) => {
  try {
    if (!fs.existsSync(EXPORTS_DIR)) return res.json([]);

    const files = fs
      .readdirSync(EXPORTS_DIR)
      .filter((f) => f.endsWith('.xlsx'));
    const batches = files
      .map((f) => {
        const stats = fs.statSync(path.join(EXPORTS_DIR, f));
        const match = f.match(/batch_(\d+)\.xlsx/);
        const timestamp = match ? parseInt(match[1]) : stats.mtimeMs;

        return {
          id: f,
          name: f,
          date: new Date(timestamp).toISOString(),
          size: stats.size,
          url: `/api/download/${f}`,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json(batches);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list batches' });
  }
});

// 7. MANUAL BACKUP (Ручное создание бэкапа)
app.post('/api/backup', async (req, res) => {
  try {
    const filename = await createBackup('user_request');
    res.json({
      success: true,
      message: `Бэкап успешно создан: ${filename}`,
      filename,
    });
  } catch (err) {
    console.error('Backup error:', err);
    res
      .status(500)
      .json({ error: 'Backup failed', details: (err as Error).message });
  }
});

app.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
  console.log('Exports dir:', EXPORTS_DIR);
  console.log('Backups dir:', BACKUPS_DIR);
});
