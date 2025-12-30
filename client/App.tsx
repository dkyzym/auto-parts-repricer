import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Database,
  Download,
  EyeOff,
  FileSpreadsheet,
  Flag,
  Loader2,
  RefreshCw,
  Search,
  Undo2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

// --- ТИПЫ И ИНТЕРФЕЙСЫ ---

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
  batch_id?: number; // ID выгрузки, если товар в архиве
}

interface BatchFile {
  id: string;
  name: string;
  date: string;
  size: number;
  url: string;
}

// --- УТИЛИТЫ ---

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

// --- SUB-COMPONENTS ---

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

const HistoryModal = ({ onClose }: { onClose: () => void }) => {
  const [batches, setBatches] = useState<BatchFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/batches')
      .then((res) => res.json())
      .then((data) => setBatches(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between bg-gray-50 rounded-t-xl">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
            <Clock className="text-blue-600" /> История выгрузок
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-12 text-gray-500">История пуста</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-100 text-gray-600 text-sm sticky top-0">
                <tr>
                  <th className="p-4 font-semibold">Дата создания</th>
                  <th className="p-4 font-semibold">Файл</th>
                  <th className="p-4 text-right font-semibold">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-blue-50 transition-colors">
                    <td className="p-4 text-sm text-gray-700">
                      {new Date(b.date).toLocaleString('ru-RU')}
                    </td>
                    <td className="p-4 text-sm font-mono text-gray-500">
                      {b.name}
                    </td>
                    <td className="p-4 text-right">
                      <a
                        href={b.url}
                        download
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium px-3 py-1 rounded hover:bg-blue-100 transition-colors">
                        <Download size={16} /> Скачать
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const Header = ({
  marginThreshold,
  setMarginThreshold,
  onSeed,
  onExport,
  onHistory,
}: any) => (
  <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
    <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg shadow-blue-200">
          <Database size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-none text-gray-900">
            Repricing Manager
          </h1>
          <p className="text-xs text-gray-500 font-medium">Local Auto Parts</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div
          className="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-lg border border-yellow-200 shadow-sm"
          title="Порог маржи для подсветки">
          <span className="text-xs font-bold text-yellow-800 uppercase tracking-wide">
            Маржа %
          </span>
          <input
            type="number"
            value={marginThreshold}
            onChange={(e) => setMarginThreshold(Number(e.target.value))}
            className="w-14 bg-white border border-yellow-300 rounded px-1 text-sm text-center font-bold outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>

        <button
          onClick={onSeed}
          className="text-gray-400 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-50"
          title="Сброс БД">
          <RefreshCw size={20} />
        </button>

        <div className="h-8 w-px bg-gray-200 mx-1"></div>

        <button
          onClick={onHistory}
          className="flex items-center gap-2 text-gray-600 hover:text-blue-600 px-3 py-2 rounded-lg font-medium transition-colors text-sm hover:bg-blue-50">
          <Clock size={18} /> История
        </button>

        <button
          onClick={onExport}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg font-bold transition-all shadow-md hover:shadow-lg active:scale-95 text-sm">
          <FileSpreadsheet size={18} /> Экспорт
        </button>
      </div>
    </div>
  </header>
);

const Pagination = ({ page, totalPages, totalItems, setPage, limit }: any) => (
  <div className="p-4 border-t flex items-center justify-between bg-gray-50 rounded-b-xl">
    <span className="text-sm text-gray-600 font-medium">
      Страница {page} из {totalPages || 1}{' '}
      <span className="text-gray-400 font-normal ml-1">
        ({totalItems} товаров)
      </span>
    </span>
    <div className="flex gap-2">
      <button
        disabled={page === 1}
        onClick={() => setPage((p: number) => p - 1)}
        className="px-4 py-2 border rounded-md bg-white disabled:opacity-50 hover:bg-gray-100 text-sm font-medium transition-colors shadow-sm">
        Назад
      </button>
      <button
        disabled={totalPages > 0 ? page >= totalPages : true}
        onClick={() => setPage((p: number) => p + 1)}
        className="px-4 py-2 border rounded-md bg-white disabled:opacity-50 hover:bg-gray-100 text-sm font-medium transition-colors shadow-sm">
        Вперед
      </button>
    </div>
  </div>
);

// --- MAIN APP COMPONENT ---

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showHistory, setShowHistory] = useState(false);

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

      if (responseData.data && Array.isArray(responseData.data)) {
        list = responseData.data;
        total = responseData.meta?.total || 0;
      } else if (Array.isArray(responseData)) {
        list = responseData;
        total = responseData.length;
      }

      setProducts(
        list.map((p: any) => ({ ...p, manual_flag: Boolean(p.manual_flag) }))
      );
      setTotalItems(total);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchProducts(), 300);
    return () => clearTimeout(timer);
  }, [page, filterStatus, search]);

  // Optimistic Update: Remove from list if filter matches current status
  const handleUpdatePrice = async (sku: string, price: number) => {
    setProducts((prev) => {
      // Если мы во вкладке "В работе", то при утверждении товар должен исчезнуть
      if (filterStatus === 'pending') {
        return prev.filter((p) => p.sku !== sku);
      }
      return prev.map((p) =>
        p.sku === sku ? { ...p, new_price: price, status: 'approved' } : p
      );
    });

    try {
      await fetch(`/api/products/${sku}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_price: price, status: 'approved' }),
      });
    } catch (err) {
      console.error(err);
      fetchProducts();
    } // Revert on error
  };

  const handleResetStatus = async (sku: string) => {
    setProducts((prev) =>
      // Если мы в архиве или отложенных, товар исчезает при возврате
      filterStatus === 'exported' ||
      filterStatus === 'deferred' ||
      filterStatus === 'approved'
        ? prev.filter((p) => p.sku !== sku)
        : prev.map((p) =>
            p.sku === sku ? { ...p, status: 'pending', new_price: null } : p
          )
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
    if (!confirm('ВНИМАНИЕ: Сброс базы данных удалит всю историю. Продолжить?'))
      return;
    setLoading(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (!res.ok) throw new Error('Ошибка при посеве');
      alert('БД сброшена!');
      setSearch('');
      setPage(1);
      setFilterStatus('pending');
      fetchProducts();
    } catch (err) {
      alert('Ошибка');
      console.error(err);
      setLoading(false);
    }
  };

  const handleExportBatch = async () => {
    if (!confirm('Экспортировать ВСЕ одобренные товары?')) return;
    try {
      const res = await fetch('/api/batches/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok)
        throw new Error((await res.json()).error || 'Ошибка сервера');
      const result = await res.json();
      alert(`Пакет #${result.batch_id} создан! (${result.count} товаров)`);
      if (result.downloadUrl) {
        const link = document.createElement('a');
        link.href = result.downloadUrl;
        link.download = `batch_${result.batch_id}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      fetchProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const STATUS_STYLES = {
    pending: {
      label: 'В работе',
      base: 'text-gray-600 border-transparent hover:bg-gray-100',
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
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}

      <Header
        marginThreshold={marginThreshold}
        setMarginThreshold={setMarginThreshold}
        onSeed={handleSeedDatabase}
        onExport={handleExportBatch}
        onHistory={() => setShowHistory(true)}
      />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-end md:items-center">
          <div className="relative w-full md:w-96 group">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors"
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
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm transition-all"
            />
          </div>
          <div className="flex gap-2 bg-gray-100 p-1.5 rounded-lg border border-gray-200">
            {(
              Object.keys(STATUS_STYLES) as Array<keyof typeof STATUS_STYLES>
            ).map((key) => (
              <button
                key={key}
                onClick={() => {
                  setFilterStatus(key);
                  setPage(1);
                }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 border ${
                  filterStatus === key
                    ? STATUS_STYLES[key].active
                    : STATUS_STYLES[key].base
                }`}>
                {STATUS_STYLES[key].label}
              </button>
            ))}
          </div>
        </div>

        <main className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col min-h-[500px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center flex-1 text-gray-500">
              <Loader2 className="animate-spin mb-3 text-blue-600" size={40} />
              <span className="font-medium">Загрузка данных...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-4">
              <span>Список пуст</span>
              {filterStatus === 'pending' && !search && (
                <button
                  onClick={handleSeedDatabase}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors shadow-md">
                  Загрузить данные (Seed)
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-100/80 text-gray-600 text-xs uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="p-4 w-16 text-center">Группа</th>
                    <th className="p-4">Товар</th>
                    <th className="p-4 w-24 text-right">Остаток</th>
                    <th className="p-4 w-28 text-right">Закуп</th>
                    <th className="p-4 w-24 text-center">Маржа %</th>
                    <th className="p-4 w-28 text-right">Доход</th>
                    <th className="p-4 w-28 text-right">Цена</th>
                    <th className="p-4 w-96">Управление ценой</th>
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
                        <td className="p-4 text-center align-top">
                          <Badge color={abcColor}>{p.abcMargin}</Badge>
                          <div
                            className="text-sm font-bold text-red-600 mt-2 cursor-help"
                            title={`Потери в день: ${p.daily_loss?.toFixed(
                              2
                            )}`}>
                            {p.daily_loss ? p.daily_loss.toFixed(2) : '0.00'}
                          </div>
                        </td>

                        <td className="p-4 align-top">
                          <div className="flex flex-col gap-1.5">
                            <span
                              className="font-semibold text-gray-900 leading-snug text-sm md:text-base line-clamp-2"
                              title={p.name}>
                              {p.name}
                            </span>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 rounded">
                                {p.sku}
                              </span>
                              {p.status === 'approved' && (
                                <span className="status-badge bg-blue-100 text-blue-700 border-blue-200">
                                  <CheckCircle2 size={12} /> Готов
                                </span>
                              )}
                              {p.status === 'deferred' && (
                                <span className="status-badge bg-gray-200 text-gray-600 border-gray-300">
                                  <EyeOff size={12} /> Отложен
                                </span>
                              )}
                              {p.status === 'exported' && (
                                <div className="flex items-center gap-2">
                                  <span className="status-badge bg-purple-100 text-purple-700 border-purple-200">
                                    <FileSpreadsheet size={12} /> Архив
                                  </span>
                                  {p.batch_id && (
                                    <a
                                      href={`/exports/batch_${p.batch_id}.xlsx`}
                                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                      title="Скачать исходный файл выгрузки">
                                      <Download size={10} /> Файл
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                            {p.manual_flag && (
                              <span className="inline-flex items-center gap-1 text-xs text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded w-fit">
                                <Flag size={10} fill="currentColor" /> Проверить
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-4 text-right font-mono text-gray-600 align-top">
                          {p.stock}
                        </td>
                        <td className="p-4 text-right font-mono text-gray-500 align-top">
                          {p.costPrice.toFixed(0)}
                        </td>
                        <td className="p-4 text-center align-top">
                          <div className="flex justify-center items-center gap-1 font-bold">
                            <span
                              className={
                                marginPercent < 15
                                  ? 'text-red-600'
                                  : marginPercent > marginThreshold
                                  ? 'text-green-600'
                                  : 'text-gray-700'
                              }>
                              {marginPercent.toFixed(0)}%
                            </span>
                            {isHighMargin && (
                              <ArrowUpRight
                                size={14}
                                className="text-green-500"
                              />
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-right font-mono text-gray-600 align-top">
                          {Math.round(p.marginTotal || 0).toLocaleString()}
                        </td>
                        <td className="p-4 text-right font-bold text-gray-900 font-mono align-top text-lg">
                          {p.currentPrice.toFixed(0)}
                        </td>

                        <td className="p-4 align-top">
                          {p.status === 'approved' ||
                          p.status === 'exported' ? (
                            <div className="flex items-center gap-3">
                              <div className="bg-blue-600 text-white px-4 py-1.5 rounded-lg font-bold text-lg shadow-sm">
                                {p.new_price}
                              </div>
                              {p.status !== 'exported' && (
                                <button
                                  onClick={() => handleResetStatus(p.sku)}
                                  className="p-2 text-gray-400 hover:text-red-600 bg-white border border-gray-200 hover:border-red-200 rounded-lg transition-all shadow-sm"
                                  title="Отменить">
                                  <Undo2 size={18} />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <div className="flex gap-2 flex-wrap">
                                {suggestions.map((price) => (
                                  <button
                                    key={price}
                                    onClick={() =>
                                      handleUpdatePrice(p.sku, price)
                                    }
                                    className="px-3 py-1.5 bg-white border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-sm font-bold transition-all shadow-sm active:scale-95">
                                    {price}
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-2 items-center">
                                <input
                                  type="number"
                                  placeholder="Своя..."
                                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
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
                                  className="text-xs text-gray-500 hover:text-gray-900 underline">
                                  Старая
                                </button>
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="p-4 text-center align-top">
                          <div className="flex justify-center gap-2">
                            {p.status === 'deferred' && (
                              <button
                                onClick={() => handleResetStatus(p.sku)}
                                className="action-btn text-green-600 hover:bg-green-50 hover:border-green-200"
                                title="Вернуть">
                                <Undo2 size={18} />
                              </button>
                            )}
                            <button
                              onClick={() => handleFlag(p.sku, p.manual_flag)}
                              className={`action-btn ${
                                p.manual_flag
                                  ? 'text-red-500 bg-red-50 border-red-200'
                                  : 'text-gray-400 hover:bg-gray-50'
                              }`}
                              title="Флаг">
                              <Flag
                                size={18}
                                fill={p.manual_flag ? 'currentColor' : 'none'}
                              />
                            </button>
                            {p.status === 'pending' && (
                              <button
                                onClick={() => handleDefer(p.sku)}
                                className="action-btn text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                                title="Отложить">
                                <EyeOff size={18} />
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
          <Pagination
            page={page}
            totalPages={Math.ceil(totalItems / LIMIT)}
            totalItems={totalItems}
            setPage={setPage}
            limit={LIMIT}
          />
        </main>
      </div>

      {/* Global Styles for badge consistency */}
      <style>{`
        .status-badge { @apply text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase flex items-center gap-1 w-fit; }
        .action-btn { @apply p-2 rounded-lg border border-transparent hover:border-gray-200 transition-all; }
      `}</style>
    </div>
  );
}
