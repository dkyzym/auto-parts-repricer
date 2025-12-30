import {
  ArrowUpRight,
  Database,
  Download,
  EyeOff,
  Flag,
  Loader2,
  RefreshCw, // Иконка для сброса/обновления
  Search,
} from 'lucide-react';
import { useEffect, useState } from 'react';

// --- ТИПЫ ДАННЫХ (TYPES) ---

interface Product {
  sku: string;
  name: string;
  stock: number;
  costPrice: number;
  currentPrice: number;
  salesQty: number;
  abcMargin: 'A' | 'B' | 'C' | 'N';
  marginTotal: number;
  sourceStatus: string;
  new_price: number | null;
  status: 'pending' | 'approved' | 'deferred' | 'exported';
  manual_flag: boolean;
  daily_loss?: number;
}

// --- ЛОГИКА ОКРУГЛЕНИЯ ---
class PriceCalculator {
  private static MARKUP_BASE = 1.06;

  static calculateSuggestions(currentPrice: number): number[] {
    const rawPrice = currentPrice * this.MARKUP_BASE;
    let options: number[] = [];

    if (rawPrice < 50) {
      options = [
        Math.ceil(rawPrice),
        Math.ceil(rawPrice / 5) * 5,
        Math.ceil(rawPrice / 10) * 10,
      ];
    } else if (rawPrice >= 50 && rawPrice < 200) {
      options = [
        Math.ceil(rawPrice / 5) * 5,
        Math.ceil(rawPrice / 10) * 10,
        Math.ceil(rawPrice / 50) * 50,
      ];
    } else if (rawPrice >= 200 && rawPrice < 1000) {
      const optA = Math.ceil(rawPrice / 10) * 10;
      const optB = Math.ceil(rawPrice / 50) * 50;
      let optC = Math.ceil(rawPrice / 100) * 100;
      if (optC % 500 === 0) optC -= 10;
      options = [optA, optB, optC];
    } else {
      const optA = Math.ceil(rawPrice / 50) * 50;
      const optB = Math.ceil((rawPrice - 90) / 100) * 100 + 90;
      const optC = Math.ceil(rawPrice / 100) * 100;
      options = [optA, optB, optC];
    }
    return Array.from(new Set(options)).sort((a, b) => a - b);
  }
}

const Badge = ({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) => (
  <span className={`px-2 py-1 rounded text-xs font-bold ${color}`}>
    {children}
  </span>
);

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [marginThreshold, setMarginThreshold] = useState<number>(30);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  // --- API CALLS ---

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: LIMIT.toString(),
        status: filterStatus,
        q: search,
      });

      const res = await fetch(`/api/products?${query}`);
      if (!res.ok) throw new Error('Ошибка сети');

      const data = await res.json();
      console.log('Ответ от сервера:', data); // LOG: Показывает структуру данных в консоли браузера

      // Умная обработка: ищем массив данных в разных популярных ключах или в корне
      let list: any[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && Array.isArray(data.products)) {
        list = data.products;
      } else if (data && Array.isArray(data.data)) {
        list = data.data;
      }

      const formatted = list.map((p: any) => ({
        ...p,
        manual_flag: Boolean(p.manual_flag),
      }));

      setProducts(formatted);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [page, filterStatus, search]);

  // --- ДЕЙСТВИЯ ---

  const handleUpdatePrice = async (sku: string, price: number) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.sku === sku ? { ...p, new_price: price, status: 'approved' } : p
      )
    );
    try {
      await fetch(`/api/products/${sku}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_price: price, status: 'approved' }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDefer = async (sku: string) => {
    setProducts((prev) => prev.filter((p) => p.sku !== sku));
    try {
      await fetch(`/api/products/${sku}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'deferred' }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleFlag = async (sku: string, currentFlag: boolean) => {
    const newFlag = !currentFlag;
    setProducts((prev) =>
      prev.map((p) => (p.sku === sku ? { ...p, manual_flag: newFlag } : p))
    );
    try {
      await fetch(`/api/products/${sku}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual_flag: newFlag }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Кнопка Seed (Сброс БД)
  const handleSeedDatabase = async () => {
    if (
      !confirm(
        'ВНИМАНИЕ: Это полностью очистит базу данных и загрузит исходный JSON. Продолжить?'
      )
    )
      return;

    setLoading(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (!res.ok) throw new Error('Ошибка при посеве данных');

      const result = await res.json();
      alert(result.message || 'База данных успешно обновлена!');

      // Сбрасываем фильтры в дефолтное состояние
      // Если стейт уже такой (стр 1, pending, без поиска), useEffect не сработает
      // Поэтому сохраняем флаг необходимости обновления
      const needForceUpdate =
        page === 1 && filterStatus === 'pending' && search === '';

      setSearch('');
      setPage(1);
      setFilterStatus('pending');

      // Если параметры не изменились, useEffect не сработает, вызываем вручную
      if (needForceUpdate) {
        fetchProducts();
      }
    } catch (err) {
      alert('Ошибка: Не удалось загрузить данные. Проверьте консоль сервера.');
      console.error(err);
      setLoading(false);
    }
  };

  const handleExportBatch = async () => {
    if (!confirm('Создать файл экспорта (Excel) для всех одобренных товаров?'))
      return;
    try {
      const res = await fetch('/api/batches/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Ошибка создания пакета');
      const result = await res.json();
      alert(`Пакет #${result.batch_id} создан!`);
      fetchProducts();
    } catch (err) {
      alert('Ошибка экспорта: ' + err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans">
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded text-white">
              <Database size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-none">
                Repricing Manager
              </h1>
              <p className="text-xs text-gray-500">
                Local Auto Parts • Real API
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded border border-yellow-200">
              <span className="text-xs font-semibold text-yellow-800">
                Маржа (%):
              </span>
              <input
                type="number"
                value={marginThreshold}
                onChange={(e) => setMarginThreshold(Number(e.target.value))}
                className="w-16 bg-white border border-yellow-300 rounded px-1 text-sm text-center"
              />
            </div>

            {/* Кнопка SEED */}
            <button
              onClick={handleSeedDatabase}
              className="text-gray-400 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-50"
              title="Сбросить и загрузить базу данных (Seed)">
              <RefreshCw size={18} />
            </button>

            <button
              onClick={handleExportBatch}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
              <Download size={18} />
              Экспорт (Excel)
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-end md:items-center">
          <div className="relative w-full md:w-96">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Поиск по SKU или названию..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            {['pending', 'approved', 'deferred', 'exported', 'all'].map(
              (st) => (
                <button
                  key={st}
                  onClick={() => {
                    setFilterStatus(st);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-md text-sm capitalize transition-colors ${
                    filterStatus === st
                      ? 'bg-blue-100 text-blue-800 font-bold border border-blue-200'
                      : 'bg-white text-gray-600 border hover:bg-gray-50'
                  }`}>
                  {st}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 pb-12">
        <div className="bg-white rounded-xl shadow border overflow-hidden min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Loader2 className="animate-spin mb-2" size={32} />
              <span>Загрузка данных...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-4">
              <span>Товары не найдены</span>
              <button
                onClick={handleSeedDatabase}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
                Загрузить данные из файла (Seed)
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
                    <th className="p-4 w-12 text-center">ABC</th>
                    <th className="p-4">Товар (SKU / Name)</th>
                    <th className="p-4 w-24 text-right">Stock</th>
                    <th className="p-4 w-28 text-right">Cost</th>
                    <th className="p-4 w-28 text-right">Old Price</th>
                    <th className="p-4 w-32">Margin %</th>
                    <th className="p-4 w-96">Новая цена (Варианты)</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((p) => {
                    const marginPercent =
                      ((p.currentPrice - p.costPrice) / p.costPrice) * 100;
                    const isHighMargin = marginPercent > marginThreshold;
                    const suggestions = PriceCalculator.calculateSuggestions(
                      p.currentPrice
                    );

                    return (
                      <tr
                        key={p.sku}
                        className={`hover:bg-blue-50/50 group transition-colors ${
                          isHighMargin
                            ? 'border-l-4 border-l-green-400 bg-green-50/30'
                            : ''
                        } ${p.status === 'approved' ? 'bg-blue-50/30' : ''}`}>
                        <td className="p-4 text-center">
                          <Badge
                            color={
                              p.abcMargin === 'A'
                                ? 'bg-red-100 text-red-700'
                                : p.abcMargin === 'B'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-gray-100 text-gray-700'
                            }>
                            {p.abcMargin}
                          </Badge>
                          <div className="text-[10px] text-gray-400 mt-1">
                            {p.daily_loss ? Math.round(p.daily_loss) : 0}/d
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span
                              className="font-medium text-gray-900 line-clamp-1"
                              title={p.name}>
                              {p.name}
                            </span>
                            <span className="text-xs text-gray-500 font-mono">
                              {p.sku}
                            </span>
                            {p.manual_flag && (
                              <span className="inline-flex items-center gap-1 text-xs text-red-600 mt-1">
                                <Flag size={12} fill="currentColor" /> Проверить
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-right font-mono text-gray-600">
                          {p.stock}
                        </td>
                        <td className="p-4 text-right font-mono text-gray-500">
                          {p.costPrice.toFixed(0)}
                        </td>
                        <td className="p-4 text-right font-mono font-medium text-gray-900">
                          {p.currentPrice.toFixed(0)}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-bold ${
                                marginPercent < 15
                                  ? 'text-red-600'
                                  : marginPercent > marginThreshold
                                  ? 'text-green-600'
                                  : 'text-gray-700'
                              }`}>
                              {marginPercent.toFixed(1)}%
                            </span>
                            {isHighMargin && (
                              <ArrowUpRight
                                size={14}
                                className="text-green-500"
                              />
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          {p.status === 'approved' ||
                          p.status === 'exported' ? (
                            <div className="flex items-center gap-2">
                              <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded font-bold">
                                {p.new_price}
                              </div>
                              <button
                                onClick={() => handleUpdatePrice(p.sku, 0)}
                                className="text-xs text-blue-600 hover:underline">
                                Изм.
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <div className="flex gap-1 flex-wrap">
                                {suggestions.map((price) => (
                                  <button
                                    key={price}
                                    onClick={() =>
                                      handleUpdatePrice(p.sku, price)
                                    }
                                    className="px-2 py-1 bg-white border hover:bg-blue-600 hover:text-white hover:border-blue-600 rounded text-sm transition-colors shadow-sm">
                                    {price}
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-2 items-center">
                                <input
                                  type="number"
                                  placeholder="Своя"
                                  className="w-20 px-2 py-1 border rounded text-sm"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter')
                                      handleUpdatePrice(
                                        p.sku,
                                        Number(e.currentTarget.value)
                                      );
                                  }}
                                />
                                <button
                                  onClick={() =>
                                    handleUpdatePrice(p.sku, p.currentPrice)
                                  }
                                  className="text-xs text-gray-400 hover:text-gray-700 underline">
                                  Старая
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleFlag(p.sku, p.manual_flag)}
                              className={`p-2 rounded hover:bg-gray-100 ${
                                p.manual_flag ? 'text-red-500' : 'text-gray-400'
                              }`}>
                              <Flag
                                size={16}
                                fill={p.manual_flag ? 'currentColor' : 'none'}
                              />
                            </button>
                            <button
                              onClick={() => handleDefer(p.sku)}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                              <EyeOff size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="p-4 border-t flex items-center justify-between bg-gray-50">
            <span className="text-sm text-gray-500">Страница {page}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border rounded bg-white disabled:opacity-50 hover:bg-gray-50">
                Назад
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border rounded bg-white hover:bg-gray-50">
                Вперед
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
