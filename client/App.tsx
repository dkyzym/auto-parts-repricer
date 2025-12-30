import {
  ArrowUpRight,
  CheckCircle2,
  Database,
  EyeOff,
  FileSpreadsheet,
  Flag,
  Loader2,
  RefreshCw,
  Search,
  Undo2,
} from 'lucide-react';
import { useEffect, useState } from 'react';

// --- ТИПЫ ДАННЫХ ---

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

interface ApiResponse {
  data: Product[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
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
  <span
    className={`px-3 py-1.5 rounded-md text-sm font-bold shadow-sm ${color}`}>
    {children}
  </span>
);

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [marginThreshold, setMarginThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('marginThreshold');
    return saved ? Number(saved) : 30;
  });

  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const LIMIT = 50;

  useEffect(() => {
    localStorage.setItem('marginThreshold', String(marginThreshold));
  }, [marginThreshold]);

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

      const responseData = await res.json();

      let list: any[] = [];
      let total = 0;

      // Обработка нового формата { data: [], meta: { total: 100 } }
      if (responseData.data && Array.isArray(responseData.data)) {
        list = responseData.data;
        total = responseData.meta?.total || 0;
      } else if (Array.isArray(responseData)) {
        // Fallback для старого формата
        list = responseData;
        total = responseData.length;
      }

      const formatted = list.map((p: any) => ({
        ...p,
        manual_flag: Boolean(p.manual_flag),
      }));

      setProducts(formatted);
      setTotalItems(total);
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

  const handleResetStatus = async (sku: string) => {
    setProducts((prev) =>
      filterStatus === 'all'
        ? prev.map((p) =>
            p.sku === sku ? { ...p, status: 'pending', new_price: null } : p
          )
        : prev.filter((p) => p.sku !== sku)
    );

    try {
      await fetch(`/api/products/${sku}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending', new_price: null }),
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
      setSearch('');
      setPage(1);
      setFilterStatus('pending');
      fetchProducts();
    } catch (err) {
      alert('Ошибка: Не удалось загрузить данные.');
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

      if (!res.ok) {
        const errText = await res.json();
        throw new Error(errText.error || 'Ошибка сервера');
      }

      const result = await res.json();
      alert(
        `Пакет #${result.batch_id} успешно создан! Товаров: ${result.count}`
      );

      // Если сервер вернул ссылку на скачивание (пока просто алертим, но можно открыть)
      // window.location.href = result.downloadUrl;

      fetchProducts();
    } catch (err: any) {
      alert('Ошибка экспорта: ' + err.message);
    }
  };

  const totalPages = Math.ceil(totalItems / LIMIT);

  // Стили для категорий (вкладок)
  const STATUS_STYLES = {
    pending: {
      label: 'В работе',
      base: 'text-gray-600 border-transparent hover:bg-gray-50',
      active:
        'bg-white ring-2 ring-blue-600 text-blue-700 font-bold shadow-md transform scale-105',
    },
    approved: {
      label: 'Готовы',
      base: 'text-blue-600 border-blue-200 hover:bg-blue-50',
      active:
        'bg-blue-100 ring-2 ring-blue-600 text-blue-900 font-bold shadow-md transform scale-105',
    },
    deferred: {
      label: 'Отложенные',
      base: 'text-gray-500 border-gray-200 hover:bg-gray-50',
      active:
        'bg-gray-100 ring-2 ring-gray-500 text-gray-800 font-bold shadow-md transform scale-105',
    },
    exported: {
      label: 'Архив',
      base: 'text-purple-600 border-purple-200 hover:bg-purple-50',
      active:
        'bg-purple-100 ring-2 ring-purple-600 text-purple-900 font-bold shadow-md transform scale-105',
    },
    all: {
      label: 'Все',
      base: 'text-gray-600 border-transparent hover:bg-gray-50',
      active:
        'bg-gray-800 ring-2 ring-gray-900 text-white font-bold shadow-md transform scale-105',
    },
  };

  // Helper для определения стилей строки
  const getRowStyles = (p: Product, isHighMargin: boolean) => {
    let base = 'hover:bg-gray-50 transition-colors border-b border-gray-100 ';
    let border = 'border-l-4 border-transparent';

    if (p.status === 'approved') {
      base += 'bg-blue-50/60 ';
      border = 'border-l-4 border-blue-500';
    } else if (p.status === 'deferred') {
      base += 'bg-gray-100/80 text-gray-500 ';
      border = 'border-l-4 border-gray-400';
    } else if (p.status === 'exported') {
      base += 'bg-purple-50/50 ';
      border = 'border-l-4 border-purple-400';
    } else if (isHighMargin) {
      base += 'bg-green-50/30 ';
      border = 'border-l-4 border-green-400';
    }

    return { rowClass: base, borderClass: border };
  };

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans">
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded text-white">
              <Database size={24} />
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
            <div
              className="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded border border-yellow-200"
              title="Если маржа выше этого значения, товар подсвечивается зеленым">
              <span className="text-xs font-semibold text-yellow-800">
                Маржа (%):
              </span>
              <input
                type="number"
                value={marginThreshold}
                onChange={(e) => setMarginThreshold(Number(e.target.value))}
                className="w-16 bg-white border border-yellow-300 rounded px-1 text-sm text-center font-bold outline-none focus:ring-1 focus:ring-yellow-400"
              />
            </div>

            <button
              onClick={handleSeedDatabase}
              className="text-gray-400 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-50"
              title="Сброс и полная перезагрузка БД">
              <RefreshCw size={20} />
            </button>

            <button
              onClick={handleExportBatch}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm text-sm"
              title="Экспорт всех одобренных товаров в Excel">
              <FileSpreadsheet size={18} />
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
                if (e.target.value) setFilterStatus('all');
              }}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm transition-shadow"
            />
          </div>
          <div className="flex gap-2">
            {(
              Object.keys(STATUS_STYLES) as Array<keyof typeof STATUS_STYLES>
            ).map((key) => {
              const style = STATUS_STYLES[key];
              const isActive = filterStatus === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setFilterStatus(key);
                    setPage(1);
                  }}
                  className={`px-4 py-2 rounded-md text-sm transition-all duration-200 border ${
                    isActive ? style.active : style.base
                  }`}>
                  {style.label}
                </button>
              );
            })}
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
              {filterStatus === 'pending' && !search && (
                <button
                  onClick={handleSeedDatabase}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
                  Загрузить данные из файла (Seed)
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
                    <th className="p-4 w-16 text-center">Группа</th>
                    <th className="p-4">Товар (SKU / Название)</th>
                    <th className="p-4 w-24 text-right">Остаток</th>
                    <th className="p-4 w-28 text-right">Закуп</th>

                    <th className="p-4 w-32 text-right">Цена</th>
                    <th className="p-4 w-24 text-center">Маржа %</th>
                    <th className="p-4 w-32 text-right">Доход</th>

                    <th className="p-4 w-96">Новая цена (Варианты)</th>
                    <th className="p-4 text-center">Действия</th>
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

                    const { rowClass, borderClass } = getRowStyles(
                      p,
                      isHighMargin
                    );

                    // Определение цвета для ABC (A=Green, B=Yellow, C=Red)
                    let abcColor = 'bg-gray-100 text-gray-700';
                    if (p.abcMargin === 'A')
                      abcColor = 'bg-green-100 text-green-800';
                    else if (p.abcMargin === 'B')
                      abcColor = 'bg-yellow-100 text-yellow-800';
                    else if (p.abcMargin === 'C')
                      abcColor = 'bg-red-100 text-red-800';

                    return (
                      <tr
                        key={p.sku}
                        className={`${rowClass} group ${borderClass}`}>
                        {/* ГРУППА ABC */}
                        <td className="p-4 text-center">
                          <Badge color={abcColor}>{p.abcMargin}</Badge>
                          <div
                            className="text-lg font-bold text-red-600 mt-2 cursor-help"
                            title={`Потери в день: ${
                              p.daily_loss?.toFixed(2) || 0
                            }`}>
                            {p.daily_loss ? p.daily_loss.toFixed(2) : '0.00'}
                          </div>
                        </td>

                        {/* ТОВАР */}
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            <span
                              className="font-medium text-gray-900 line-clamp-2 text-base flex items-center gap-2"
                              title={p.name}>
                              {p.name}
                            </span>

                            {/* Индикатор статуса для поиска */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm text-gray-500 font-mono font-bold">
                                {p.sku}
                              </span>

                              {p.status === 'approved' && (
                                <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 uppercase flex items-center gap-1">
                                  <CheckCircle2 size={10} /> Готов
                                </span>
                              )}
                              {p.status === 'deferred' && (
                                <span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded border border-gray-300 uppercase flex items-center gap-1">
                                  <EyeOff size={10} /> Отложен
                                </span>
                              )}
                              {p.status === 'exported' && (
                                <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 uppercase flex items-center gap-1">
                                  <FileSpreadsheet size={10} /> Архив
                                </span>
                              )}
                            </div>

                            {p.manual_flag && (
                              <span className="inline-flex items-center gap-1 text-xs text-red-600 mt-1 font-bold">
                                <span title="Требует внимания">
                                  <Flag size={12} fill="currentColor" />
                                </span>{' '}
                                На проверке
                              </span>
                            )}
                          </div>
                        </td>

                        {/* ОСТАТОК */}
                        <td className="p-4 text-right font-mono text-gray-600 text-base">
                          {p.stock}
                        </td>

                        {/* ЗАКУП */}
                        <td className="p-4 text-right font-mono text-gray-500 text-base">
                          {p.costPrice.toFixed(0)}
                        </td>

                        {/* ЦЕНА */}
                        <td className="p-4 text-right font-mono font-bold text-gray-900 text-base">
                          {p.currentPrice.toFixed(0)}
                        </td>

                        {/* МАРЖА % */}
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span
                              className={`text-base font-bold ${
                                marginPercent < 15
                                  ? 'text-red-600'
                                  : marginPercent > marginThreshold
                                  ? 'text-green-600'
                                  : 'text-gray-700'
                              }`}>
                              {marginPercent.toFixed(1)}%
                            </span>
                            {isHighMargin && (
                              <div title="Высокая маржа">
                                <ArrowUpRight
                                  size={16}
                                  className="text-green-500"
                                />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* ДОХОД */}
                        <td className="p-4 text-right font-mono text-gray-600 text-base">
                          {Math.round(p.marginTotal || 0).toLocaleString()}
                        </td>

                        {/* НОВАЯ ЦЕНА / ВАРИАНТЫ */}
                        <td className="p-4">
                          {p.status === 'approved' ||
                          p.status === 'exported' ? (
                            <div className="flex items-center gap-3">
                              <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-bold text-lg border border-blue-200">
                                {p.new_price}
                              </div>
                              {/* Кнопка отмены утверждения */}
                              {p.status !== 'exported' && (
                                <button
                                  onClick={() => handleResetStatus(p.sku)}
                                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                  title="Вернуть в работу (Сбросить статус)">
                                  <Undo2 size={20} />
                                </button>
                              )}
                              {p.status === 'exported' && (
                                <span className="text-xs text-gray-400 italic">
                                  Экспортирован
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-3">
                              <div className="flex gap-2 flex-wrap">
                                {suggestions.map((price) => (
                                  <button
                                    key={price}
                                    onClick={() =>
                                      handleUpdatePrice(p.sku, price)
                                    }
                                    className="px-3 py-2 bg-white border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 rounded-md text-base font-medium transition-all shadow-sm"
                                    title={`Установить цену: ${price}`}>
                                    {price}
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-2 items-center">
                                <input
                                  type="number"
                                  placeholder="Своя цена"
                                  className="w-28 px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
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
                                  className="text-sm text-gray-500 hover:text-gray-800 underline decoration-dotted"
                                  title="Оставить текущую цену без изменений">
                                  Оставить старую
                                </button>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* ДЕЙСТВИЯ (Иконки) */}
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-2">
                            {/* Кнопка возврата для отложенных */}
                            {p.status === 'deferred' && (
                              <button
                                onClick={() => handleResetStatus(p.sku)}
                                className="p-2.5 rounded-lg text-green-600 hover:bg-green-50 border border-transparent hover:border-green-200 transition-all"
                                title="Вернуть в работу">
                                <Undo2 size={20} />
                              </button>
                            )}

                            <button
                              onClick={() => handleFlag(p.sku, p.manual_flag)}
                              className={`p-2.5 rounded-lg border border-transparent hover:border-gray-200 transition-all ${
                                p.manual_flag
                                  ? 'text-red-500 bg-red-50'
                                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                              }`}
                              title={
                                p.manual_flag
                                  ? 'Снять метку проверки'
                                  : 'Пометить для ручной проверки'
                              }>
                              <span
                                title={
                                  p.manual_flag
                                    ? 'Снять метку'
                                    : 'Поставить метку'
                                }>
                                <Flag
                                  size={20}
                                  fill={p.manual_flag ? 'currentColor' : 'none'}
                                />
                              </span>
                            </button>

                            {p.status === 'pending' && (
                              <button
                                onClick={() => handleDefer(p.sku)}
                                className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg border border-transparent hover:border-gray-200 transition-all"
                                title="Отложить товар (Пропустить)">
                                <EyeOff size={20} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ПАГИНАЦИЯ */}
          <div className="p-4 border-t flex items-center justify-between bg-gray-50">
            <span className="text-sm text-gray-600 font-medium">
              Страница {page} из {totalPages || 1}{' '}
              <span className="text-gray-400 font-normal ml-1">
                (Всего: {totalItems})
              </span>
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 border rounded-md bg-white disabled:opacity-50 hover:bg-gray-50 text-sm font-medium transition-colors">
                Назад
              </button>
              <button
                // Кнопка будет активна, если мы еще не достигли лимита страниц (totalPages)
                // Если totalPages = 0 (нет данных), кнопка отключена
                disabled={totalPages > 0 ? page >= totalPages : true}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 border rounded-md bg-white disabled:opacity-50 hover:bg-gray-50 text-sm font-medium transition-colors">
                Вперед
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
