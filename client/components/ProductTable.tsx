import {
  ActionIcon,
  Badge,
  Box,
  Group,
  ScrollArea,
  Table,
  Text,
} from '@mantine/core';
import {
  IconArrowUpRight,
  IconEyeOff,
  IconFlag,
  IconRotate2,
} from '@tabler/icons-react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo } from 'react';
import { Product } from '../types';
import { PriceControlCell } from './PriceControlCell';

interface ProductTableProps {
  data: Product[];
  marginThreshold: number;
  onUpdatePrice: (sku: string, price: number) => void;
  onAction: (
    sku: string,
    action: 'defer' | 'flag' | 'reset',
    value?: boolean
  ) => void;
}

export function ProductTable({
  data,
  marginThreshold,
  onUpdatePrice,
  onAction,
}: ProductTableProps) {
  const columnHelper = createColumnHelper<Product>();

  const columns = useMemo(
    () => [
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
      columnHelper.accessor('name', {
        header: 'Товар',
        size: 400,
        cell: (info) => {
          const p = info.row.original;
          return (
            <div>
              <Text fw={600} size="sm" lh={1.3} mb={6}>
                {p.name}
              </Text>
              <Group gap={6}>
                <Badge variant="outline" color="gray" size="xs">
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
              </Group>
            </div>
          );
        },
      }),
      columnHelper.accessor('currentPrice', {
        header: 'Цена',
        size: 100,
        cell: (info) => (
          <Text fw={800} size="md" ta="right">
            {info.getValue().toFixed(0)}
          </Text>
        ),
      }),
      columnHelper.display({
        id: 'control',
        header: 'Новая цена',
        size: 300,
        cell: (info) => (
          <PriceControlCell
            product={info.row.original}
            onUpdate={onUpdatePrice}
            onReset={(sku) => onAction(sku, 'reset')}
          />
        ),
      }),
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

      columnHelper.accessor('stock', {
        header: 'Ост.',
        size: 70,
        cell: (info) => (
          <Text size="sm" c="dimmed" ta="right">
            {info.getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor('costPrice', {
        header: 'Закуп',
        size: 90,
        cell: (info) => (
          <Text size="sm" c="dimmed" ta="right">
            {info.getValue().toFixed(0)}
          </Text>
        ),
      }),

      columnHelper.accessor('marginTotal', {
        header: 'Доход',
        size: 100,
        cell: (info) => (
          <Text size="sm" ta="right">
            {Math.round(info.getValue() || 0).toLocaleString()}
          </Text>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        size: 80,
        cell: (info) => {
          const p = info.row.original;
          return (
            <Group gap={4} justify="center">
              {p.status === 'deferred' ||
              p.status === 'approved' ||
              p.status === 'exported' ? (
                <ActionIcon
                  variant="light"
                  color="green"
                  onClick={() => onAction(p.sku, 'reset')}
                  title="Вернуть в работу">
                  <IconRotate2 size={18} />
                </ActionIcon>
              ) : (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={() => onAction(p.sku, 'defer')}
                  title="Отложить">
                  <IconEyeOff size={18} />
                </ActionIcon>
              )}

              <ActionIcon
                variant={p.manual_flag ? 'filled' : 'subtle'}
                color={p.manual_flag ? 'red' : 'gray'}
                onClick={() => onAction(p.sku, 'flag', !p.manual_flag)}
                title="Флаг">
                <IconFlag size={18} />
              </ActionIcon>
            </Group>
          );
        },
      }),
    ],
    [marginThreshold, onUpdatePrice, onAction]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Box
      flex={1}
      style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <ScrollArea h="100%">
        <Table stickyHeader highlightOnHover verticalSpacing="sm">
          <Table.Thead bg="gray.0">
            {table.getHeaderGroups().map((headerGroup) => (
              <Table.Tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <Table.Th
                    key={header.id}
                    w={header.getSize()}
                    style={{
                      fontSize: '11px',
                      color: '#868e96',
                      textTransform: 'uppercase',
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
                let bg = undefined;
                if (p.status === 'approved') bg = 'var(--mantine-color-blue-0)';
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
                <Table.Td
                  colSpan={columns.length}
                  align="center"
                  p="xl"
                  c="dimmed">
                  Нет данных
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Box>
  );
}
