import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Button,
  Container,
  Group,
  LoadingOverlay,
  NumberInput,
  Pagination,
  Paper,
  ScrollArea,
  SegmentedControl,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconArrowUpRight,
  IconDatabase,
  IconEyeOff,
  IconFileSpreadsheet,
  IconFlag,
  IconHistory,
  IconRefresh,
  IconRotate2,
  IconSearch,
} from '@tabler/icons-react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { HistoryModal } from './components/HistoryModal/HistoryModal';
import { PriceControlCell } from './components/PriceControlCell';
import { ApiResponse, Product } from './types';

export default function App() {
  // --- Состояние ---
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [marginThreshold, setMarginThreshold] = useState<number>(() => {
    return Number(localStorage.getItem('marginThreshold') || 30);
  });

  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [openedHistory, { open: openHistory, close: closeHistory }] =
    useDisclosure(false);

  const LIMIT = 50;

  useEffect(
    () => localStorage.setItem('marginThreshold', String(marginThreshold)),
    [marginThreshold]
  );

  // --- Загрузка данных ---
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

      if ('meta' in json) {
        list = json.data;
        total = json.meta.total;
      } else if (Array.isArray(json)) {
        list = json;
        total = json.length;
      }

      setData(list.map((p) => ({ ...p, manual_flag: Boolean(p.manual_flag) })));
      setTotalItems(total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, search]);

  useEffect(() => {
    const t = setTimeout(fetchData, 300);
    return () => clearTimeout(t);
  }, [fetchData]);

  // --- Действия пользователя ---
  const handleUpdatePrice = async (sku: string, price: number) => {
    // Если мы на вкладке "В работе", товар исчезает сразу
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
    } catch (err) {
      fetchData();
    }
  };

  const handleAction = async (
    sku: string,
    action: 'defer' | 'flag' | 'reset',
    value?: boolean
  ) => {
    setData((prev) => {
      // Логика исчезновения из списка
      if (action === 'defer' && filterStatus === 'pending')
        return prev.filter((p) => p.sku !== sku);
      if (action === 'reset' && filterStatus !== 'all')
        return prev.filter((p) => p.sku !== sku);

      return prev.map((p) => {
        if (p.sku !== sku) return p;
        if (action === 'flag') return { ...p, manual_flag: !!value };
        if (action === 'reset')
          return { ...p, status: 'pending', new_price: null };
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
  };

  const handleSeed = async () => {
    if (!confirm('ВНИМАНИЕ: Это полностью сбросит базу данных. Продолжить?'))
      return;
    setLoading(true);
    await fetch('/api/seed', { method: 'POST' });
    setSearch('');
    setPage(1);
    setFilterStatus('pending');
    fetchData();
  };

  const handleExport = async () => {
    if (!confirm('Создать файл экспорта для готовых товаров?')) return;
    try {
      const res = await fetch('/api/batches/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert(`Экспорт завершен! Товаров: ${data.count}`);
      if (data.downloadUrl) window.location.href = data.downloadUrl;
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // --- Настройка Таблицы (React Table) ---
  const columnHelper = createColumnHelper<Product>();

  const columns = useMemo(
    () => [
      // 1. Группа
      columnHelper.accessor('abcMargin', {
        header: 'Группа',
        size: 80,
        cell: (info) => {
          const val = info.getValue();
          const loss = info.row.original.daily_loss || 0;
          let color = 'gray';
          if (val === 'A') color = 'green';
          if (val === 'B') color = 'yellow';
          if (val === 'C') color = 'red';
          return (
            <div style={{ textAlign: 'center' }}>
              <Badge color={color} size="lg" radius="sm">
                {val}
              </Badge>
              <Text c="red.8" fw={700} size="xs" mt={4} title="Потери в день">
                {loss.toFixed(2)}
              </Text>
            </div>
          );
        },
      }),
      // 2. Наименование (Широкая колонка)
      columnHelper.accessor('name', {
        header: 'Наименование',
        size: 400,
        cell: (info) => {
          const p = info.row.original;
          return (
            <div>
              <Text
                fw={600}
                size="sm"
                style={{ lineHeight: 1.3, marginBottom: 6 }}>
                {p.name}
              </Text>
              <Group gap={6}>
                <Badge variant="outline" color="gray" size="xs" radius="xs">
                  {p.sku}
                </Badge>
                {p.manual_flag && (
                  <Badge
                    color="red"
                    variant="light"
                    size="xs"
                    leftSection={<IconFlag size={10} />}>
                    Проверить
                  </Badge>
                )}
                {p.status === 'approved' && (
                  <Badge color="blue" variant="dot" size="xs">
                    Готов
                  </Badge>
                )}
                {p.status === 'deferred' && (
                  <Badge color="gray" variant="dot" size="xs">
                    Отложен
                  </Badge>
                )}
              </Group>
            </div>
          );
        },
      }),
      // 3. Текущая цена
      columnHelper.accessor('currentPrice', {
        header: 'Цена',
        size: 100,
        cell: (info) => (
          <Text fw={800} size="md" ta="right">
            {info.getValue().toFixed(0)}
          </Text>
        ),
      }),
      // 4. Управление ценой (Важно!)
      columnHelper.display({
        id: 'control',
        header: 'Новая цена',
        size: 300,
        cell: (info) => (
          <PriceControlCell
            product={info.row.original}
            onUpdate={handleUpdatePrice}
            onReset={(sku) => handleAction(sku, 'reset')}
          />
        ),
      }),
      // 5. Маржа %
      columnHelper.display({
        id: 'margin',
        header: 'Маржа',
        size: 80,
        cell: (info) => {
          const p = info.row.original;
          const margin = ((p.currentPrice - p.costPrice) / p.costPrice) * 100;
          const isHigh = margin > marginThreshold;
          return (
            <Group gap={4} justify="center">
              <Text
                fw={700}
                size="sm"
                c={margin < 15 ? 'red' : isHigh ? 'green' : 'dimmed'}>
                {margin.toFixed(0)}%
              </Text>
              {isHigh && (
                <IconArrowUpRight
                  size={14}
                  color="var(--mantine-color-green-6)"
                />
              )}
            </Group>
          );
        },
      }),

      // 6. Доход
      columnHelper.accessor('marginTotal', {
        header: 'Доход',
        size: 100,
        cell: (info) => (
          <Text size="sm" ta="right">
            {Math.round(info.getValue() || 0).toLocaleString()}
          </Text>
        ),
      }),

      // 7. Остаток (второстепенно)
      columnHelper.accessor('stock', {
        header: 'Ост.',
        size: 70,
        cell: (info) => (
          <Text size="sm" c="dimmed" ta="right">
            {info.getValue()}
          </Text>
        ),
      }),
      // 8. Закуп (второстепенно)
      columnHelper.accessor('costPrice', {
        header: 'Закуп',
        size: 90,
        cell: (info) => (
          <Text size="sm" c="dimmed" ta="right">
            {info.getValue().toFixed(0)}
          </Text>
        ),
      }),

      // 9. Действия
      columnHelper.display({
        id: 'actions',
        header: '',
        size: 80,
        cell: (info) => {
          const p = info.row.original;
          return (
            <Group gap={4} justify="center">
              {p.status === 'deferred' && (
                <ActionIcon
                  variant="light"
                  color="green"
                  onClick={() => handleAction(p.sku, 'reset')}
                  title="Вернуть">
                  <IconRotate2 size={18} />
                </ActionIcon>
              )}
              <ActionIcon
                variant={p.manual_flag ? 'filled' : 'subtle'}
                color={p.manual_flag ? 'red' : 'gray'}
                onClick={() => handleAction(p.sku, 'flag', !p.manual_flag)}
                title="Флаг">
                <IconFlag size={18} />
              </ActionIcon>
              {p.status === 'pending' && (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={() => handleAction(p.sku, 'defer')}
                  title="Отложить">
                  <IconEyeOff size={18} />
                </ActionIcon>
              )}
            </Group>
          );
        },
      }),
    ],
    [marginThreshold, handleUpdatePrice]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // --- RENDER ---
  return (
    <AppShell header={{ height: 70 }} padding="md" bg="gray.0">
      <HistoryModal opened={openedHistory} onClose={closeHistory} />

      {/* ШАПКА */}
      <AppShell.Header p="md">
        <Group justify="space-between">
          <Group>
            <div
              style={{
                background: '#228be6',
                padding: 8,
                borderRadius: 8,
                color: 'white',
              }}>
              <IconDatabase size={24} />
            </div>
            <div>
              <Title order={4} lh={1}>
                Repricing Manager
              </Title>
              <Text size="xs" c="dimmed" fw={500}>
                React + Mantine
              </Text>
            </div>
          </Group>

          <Group>
            <Paper withBorder p={4} radius="md" bg="gray.0">
              <Group gap={6}>
                <Text size="xs" fw={700} tt="uppercase" c="dimmed" px={4}>
                  Маржа %
                </Text>
                <NumberInput
                  value={marginThreshold}
                  onChange={(v) => setMarginThreshold(Number(v))}
                  size="xs"
                  w={60}
                  hideControls
                  styles={{ input: { textAlign: 'center', fontWeight: 700 } }}
                />
              </Group>
            </Paper>

            <ActionIcon
              variant="default"
              size="lg"
              onClick={handleSeed}
              title="Сброс БД"
              radius="md">
              <IconRefresh size={20} />
            </ActionIcon>

            <Button
              variant="default"
              leftSection={<IconHistory size={16} />}
              onClick={openHistory}>
              История
            </Button>
            <Button
              color="green"
              leftSection={<IconFileSpreadsheet size={16} />}
              onClick={handleExport}>
              Экспорт
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main
        style={{
          height: 'calc(100vh - 70px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
        {/* ПАНЕЛЬ ФИЛЬТРОВ */}
        <Container fluid w="100%" px={0}>
          <Group justify="space-between" align="end">
            <TextInput
              placeholder="Поиск по SKU или названию..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
                if (e.target.value) setFilterStatus('all');
              }}
              w={400}
            />
            <SegmentedControl
              value={filterStatus}
              onChange={(val) => {
                setFilterStatus(val);
                setPage(1);
              }}
              data={[
                { label: 'В работе', value: 'pending' },
                { label: 'Готовы', value: 'approved' },
                { label: 'Отложенные', value: 'deferred' },
                { label: 'Архив', value: 'exported' },
                { label: 'Все', value: 'all' },
              ]}
            />
          </Group>
        </Container>

        {/* ОСНОВНАЯ ТАБЛИЦА */}
        <Paper
          shadow="xs"
          radius="md"
          withBorder
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
          <LoadingOverlay
            visible={loading}
            zIndex={1000}
            overlayProps={{ radius: 'sm', blur: 2 }}
          />

          <ScrollArea style={{ flex: 1 }}>
            <Table stickyHeader highlightOnHover verticalSpacing="sm">
              <Table.Thead bg="gray.0">
                {table.getHeaderGroups().map((headerGroup) => (
                  <Table.Tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <Table.Th
                        key={header.id}
                        w={header.getSize()}
                        style={{
                          textTransform: 'uppercase',
                          fontSize: '11px',
                          color: '#868e96',
                        }}>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Thead>
              <Table.Tbody>
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((row) => {
                    const p = row.original;
                    // Подсветка строки
                    let bg = undefined;
                    if (p.status === 'approved')
                      bg = 'var(--mantine-color-blue-0)';
                    else if (p.status === 'deferred')
                      bg = 'var(--mantine-color-gray-1)';
                    else if (p.status === 'exported')
                      bg = 'var(--mantine-color-grape-0)';
                    else {
                      const margin =
                        ((p.currentPrice - p.costPrice) / p.costPrice) * 100;
                      if (margin > marginThreshold)
                        bg = 'var(--mantine-color-green-0)';
                    }

                    return (
                      <Table.Tr key={row.id} bg={bg}>
                        {row.getVisibleCells().map((cell) => (
                          <Table.Td key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </Table.Td>
                        ))}
                      </Table.Tr>
                    );
                  })
                ) : (
                  <Table.Tr>
                    <Table.Td colSpan={columns.length}>
                      <Box p="xl" ta="center" c="dimmed">
                        Нет данных
                      </Box>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>

          {/* ПАГИНАЦИЯ ВНИЗУ ТАБЛИЦЫ */}
          <Group
            justify="space-between"
            p="md"
            bg="gray.0"
            style={{ borderTop: '1px solid #dee2e6' }}>
            <Text size="sm" c="dimmed">
              Страница {page} из {Math.ceil(totalItems / LIMIT) || 1} (Всего:{' '}
              {totalItems})
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
