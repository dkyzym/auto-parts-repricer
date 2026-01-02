import {
  AppShell,
  Group,
  LoadingOverlay,
  Notification,
  Pagination,
  Paper,
  Text,
  Transition,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCheck } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';

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

  // Для отслеживания достижения цели (21, 42...)
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const prevApprovedCountRef = useRef<number>(0);

  const [openedHistory, { open: openHistory, close: closeHistory }] =
    useDisclosure(false);

  const [marginThreshold, setMarginThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('marginThreshold');
    return saved ? Number(saved) : 30;
  });

  const LIMIT = 50;

  useEffect(
    () => localStorage.setItem('marginThreshold', String(marginThreshold)),
    [marginThreshold]
  );

  // Скрытие тоста через 3 секунды
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // --- Helpers ---
  const fetchStats = useCallback(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((newStats) => {
        setStats(newStats);

        // Логика Тоста: проверяем изменение количества approved
        const approved = newStats.approved || 0;
        const prev = prevApprovedCountRef.current;

        // Если количество выросло и кратно 21
        if (approved > prev && approved > 0 && approved % 21 === 0) {
          setToastMessage(`Отличная работа! Готово товаров: ${approved}`);
        }

        prevApprovedCountRef.current = approved;
      })
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

      if (Array.isArray(json)) {
        list = json;
        total = json.length;
      } else if ('data' in json) {
        list = json.data;
        total = json.meta.total;
      }

      setData(list.map((p) => ({ ...p, manual_flag: Boolean(p.manual_flag) })));
      setTotalItems(total);

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
    // Optimistic UI
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
    // Optimistic UI
    setData((prev) => {
      // Defer из Pending -> скрываем
      if (action === 'defer' && filterStatus === 'pending')
        return prev.filter((p) => p.sku !== sku);
      // Reset из Approved/Deferred -> скрываем (так как они улетают в Pending)
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

      {/* TOAST NOTIFICATION */}
      <Transition
        mounted={!!toastMessage}
        transition="slide-up"
        duration={400}
        timingFunction="ease">
        {(styles) => (
          <div
            style={{
              ...styles,
              position: 'fixed',
              bottom: 20,
              right: 20,
              zIndex: 1000,
            }}>
            <Notification
              icon={<IconCheck size="1.1rem" />}
              color="teal"
              title="Достижение!"
              onClose={() => setToastMessage(null)}
              withCloseButton>
              {toastMessage}
            </Notification>
          </div>
        )}
      </Transition>
    </AppShell>
  );
}
