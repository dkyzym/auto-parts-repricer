import {
  AppShell,
  Group,
  LoadingOverlay,
  Pagination,
  Paper,
  Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useCallback, useEffect, useState } from 'react';

import { FilterBar } from './components/FilterBar';
import { Header } from './components/Header';

import { HistoryModal } from './components/HistoryModal';
import { ProductTable } from './components/ProductTable';
import { ApiResponse, Product } from './types';

export default function App() {
  const [data, setData] = useState<Product[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [openedHistory, { open: openHistory, close: closeHistory }] =
    useDisclosure(false);

  // Исправлено: инициализация из localStorage
  const [marginThreshold, setMarginThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('marginThreshold');
    return saved ? Number(saved) : 30;
  });

  const LIMIT = 50;

  useEffect(
    () => localStorage.setItem('marginThreshold', String(marginThreshold)),
    [marginThreshold]
  );

  // --- Helpers ---
  const fetchStats = useCallback(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        status: filterStatus,
        q: search,
      });

      const res = await fetch(`/api/products?${params}`);
      const json: ApiResponse | Product[] = await res.json();

      let list: Product[] = [];
      let total = 0;

      // Исправлена логика проверки типов для устранения ошибки TS
      if (Array.isArray(json)) {
        list = json;
        total = json.length;
      } else if ('data' in json) {
        list = json.data;
        total = json.meta.total;
      }

      setData(list.map((p) => ({ ...p, manual_flag: Boolean(p.manual_flag) })));
      setTotalItems(total);

      // Обновляем бейджи каждый раз, когда грузим данные
      fetchStats();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, search, fetchStats]);

  useEffect(() => {
    const t = setTimeout(fetchData, 300);
    return () => clearTimeout(t);
  }, [fetchData]);

  // --- ACTIONS ---

  const handleUpdatePrice = async (sku: string, price: number) => {
    // Optimistic: Удаляем из текущего вида, если мы в 'pending'
    if (filterStatus === 'pending') {
      setData((prev) => prev.filter((p) => p.sku !== sku));
    } else {
      setData((prev) =>
        prev.map((p) =>
          p.sku === sku ? { ...p, new_price: price, status: 'approved' } : p
        )
      );
    }

    try {
      await fetch(`/api/products/${sku}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_price: price, status: 'approved' }),
      });
      fetchStats();
    } catch (err) {
      fetchData();
    }
  };

  const handleAction = async (
    sku: string,
    action: 'defer' | 'flag' | 'reset',
    value?: boolean
  ) => {
    // Optimistic Logic
    setData((prev) => {
      // "Отложить" (Defer) в списке Pending -> исчезает
      if (action === 'defer' && filterStatus === 'pending')
        return prev.filter((p) => p.sku !== sku);
      // "Вернуть" (Reset) в списке Approved/Deferred -> исчезает
      if (action === 'reset' && filterStatus !== 'all')
        return prev.filter((p) => p.sku !== sku);

      return prev.map((p) => {
        if (p.sku !== sku) return p;
        if (action === 'flag') return { ...p, manual_flag: !!value };
        if (action === 'reset')
          return { ...p, status: 'pending', new_price: null };
        if (action === 'defer') return { ...p, status: 'deferred' };
        return p;
      });
    });

    const body: any = {};
    if (action === 'flag') body.manual_flag = value;
    if (action === 'defer') body.status = 'deferred';
    if (action === 'reset') {
      body.status = 'pending';
      body.new_price = null;
    }

    await fetch(`/api/products/${sku}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    fetchStats();
  };

  const handleExport = async () => {
    if (!confirm('Экспортировать готовые товары?')) return;
    try {
      const res = await fetch('/api/batches/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error);
      alert(`Экспорт завершен! (${r.count} шт.)`);
      if (r.downloadUrl) window.location.href = r.downloadUrl;
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleBackup = async () => {
    try {
      const res = await fetch('/api/backup', { method: 'POST' });
      const r = await res.json();
      alert(r.message);
    } catch (e) {
      alert('Ошибка бэкапа');
    }
  };

  return (
    <AppShell header={{ height: 70 }} padding="md" bg="gray.0">
      <HistoryModal opened={openedHistory} onClose={closeHistory} />

      <AppShell.Header p="md">
        <Header
          marginThreshold={marginThreshold}
          setMarginThreshold={setMarginThreshold}
          onSeed={async () => {
            if (confirm('Сбросить?')) {
              await fetch('/api/seed', { method: 'POST' });
              fetchData();
            }
          }}
          onBackup={handleBackup}
          onExport={handleExport}
          onHistory={openHistory}
        />
      </AppShell.Header>

      <AppShell.Main
        style={{
          height: 'calc(100vh - 70px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
        <FilterBar
          search={search}
          setSearch={(v) => {
            setSearch(v);
            setPage(1);
          }}
          status={filterStatus}
          setStatus={(v) => {
            setFilterStatus(v);
            setPage(1);
          }}
          stats={stats}
        />

        <Paper
          shadow="xs"
          radius="md"
          withBorder
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
          }}>
          <LoadingOverlay
            visible={loading}
            zIndex={100}
            overlayProps={{ blur: 1 }}
          />

          <ProductTable
            data={data}
            marginThreshold={marginThreshold}
            onUpdatePrice={handleUpdatePrice}
            onAction={handleAction}
          />

          <Group
            justify="space-between"
            p="md"
            bg="gray.0"
            style={{ borderTop: '1px solid #dee2e6' }}>
            <Text size="sm" c="dimmed">
              Стр. {page} из {Math.ceil(totalItems / LIMIT) || 1}
            </Text>
            <Pagination
              total={Math.ceil(totalItems / LIMIT)}
              value={page}
              onChange={setPage}
              size="sm"
            />
          </Group>
        </Paper>
      </AppShell.Main>
    </AppShell>
  );
}
