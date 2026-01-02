import {
  ActionIcon,
  Badge,
  Box,
  Button,
  CopyButton,
  Group,
  NumberInput,
  rem,
  ScrollArea,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowUpRight,
  IconCalculator,
  IconCheck,
  IconCopy,
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
import { useMemo, useState } from 'react';
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

// --- Компонент Калькулятора Закупки (Изолированный) ---
function CostCalculatorCell({ costPrice }: { costPrice: number }) {
  const [baseCost, setBaseCost] = useState<string | number>('');
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);

  const handleCalc = (percent: number) => {
    const base = baseCost === '' ? costPrice : Number(baseCost);
    // Расчет: Цена * (1 + %) -> Округление вверх до 10
    const rawPrice = base * (1 + percent / 100);
    const rounded = Math.ceil(rawPrice / 10) * 10;
    setCalculatedPrice(rounded);
  };

  return (
    <div className="flex flex-col gap-2 w-[120px]">
      {/* Поле ввода закупа */}
      <NumberInput
        placeholder={`Закуп: ${costPrice.toFixed(0)}`}
        value={baseCost}
        onChange={setBaseCost}
        size="xs"
        hideControls
        leftSection={<IconCalculator size={10} />}
        styles={{
          input: {
            fontSize: '11px',
            height: '24px',
            paddingLeft: '24px',
            paddingRight: '4px',
          },
        }}
      />

      {/* Кнопки процентов */}
      <Group gap={4} grow>
        {[56, 66, 76].map((pct) => (
          <Button
            key={pct}
            size="compact-xs"
            variant="default"
            onClick={() => handleCalc(pct)}
            styles={{
              root: {
                padding: 0,
                fontSize: '10px',
                height: '20px',
                borderColor: '#dee2e6',
              },
            }}>
            {pct}%
          </Button>
        ))}
      </Group>

      {/* Результат с копированием */}
      {calculatedPrice !== null && (
        <CopyButton value={String(calculatedPrice)} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip
              label={copied ? 'Скопировано' : 'Скопировать цену'}
              withArrow
              position="bottom">
              <Button
                color={copied ? 'teal' : 'blue'}
                variant="light"
                fullWidth
                size="compact-xs"
                onClick={copy}
                styles={{ root: { height: '22px' } }}>
                {copied ? (
                  <IconCheck style={{ width: rem(12) }} />
                ) : (
                  <Group gap={4}>
                    <Text size="xs" fw={700}>
                      {calculatedPrice}
                    </Text>
                    <IconCopy style={{ width: rem(10) }} />
                  </Group>
                )}
              </Button>
            </Tooltip>
          )}
        </CopyButton>
      )}
    </div>
  );
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
      // 1. Группа
      columnHelper.accessor('abcMargin', {
        header: 'Группа',
        size: 70,
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
      // 2. Товар
      columnHelper.accessor('name', {
        header: 'Товар',
        size: 300,
        cell: (info) => {
          const p = info.row.original;
          return (
            <div>
              <Text
                fw={600}
                size="sm"
                lh={1.3}
                mb={6}
                lineClamp={2}
                title={p.name}>
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

      // 3. Цена (Текущая)
      columnHelper.accessor('currentPrice', {
        header: 'Цена',
        size: 90,
        cell: (info) => (
          <Text fw={800} size="md" ta="right">
            {info.getValue().toFixed(0)}
          </Text>
        ),
      }),

      // 4. Новая цена (Управление)
      columnHelper.display({
        id: 'control',
        header: 'Новая цена',
        size: 280,
        cell: (info) => (
          <PriceControlCell
            product={info.row.original}
            onUpdate={onUpdatePrice}
            onReset={(sku) => onAction(sku, 'reset')}
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

      // 6. Зона Расчета (Калькулятор)
      columnHelper.display({
        id: 'calculator',
        header: 'Расчет',
        size: 140,
        cell: (info) => (
          <CostCalculatorCell costPrice={info.row.original.costPrice} />
        ),
      }),

      // 7. Доход
      columnHelper.accessor('marginTotal', {
        header: 'Доход',
        size: 90,
        cell: (info) => (
          <Text size="sm" ta="right" c="dimmed">
            {Math.round(info.getValue() || 0).toLocaleString()}
          </Text>
        ),
      }),

      // 8. Действия
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
