import {
  ActionIcon,
  Badge,
  Button,
  Group,
  NumberInput,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconDownload, IconRotate2 } from '@tabler/icons-react';
import { useState } from 'react';
import { PriceCalculator, Product } from '../types';

interface PriceControlCellProps {
  product: Product;
  onUpdate: (sku: string, price: number) => void;
  onReset: (sku: string) => void;
}

export function PriceControlCell({
  product,
  onUpdate,
  onReset,
}: PriceControlCellProps) {
  const [customPrice, setCustomPrice] = useState<string | number>('');

  // 1. Если цена уже утверждена или товар в архиве
  if (product.status === 'approved' || product.status === 'exported') {
    return (
      <Group gap="xs" wrap="nowrap">
        <Badge
          size="lg"
          variant="filled"
          color="blue"
          radius="sm"
          styles={{ root: { fontSize: '14px', height: '32px' } }}>
          {product.new_price}
        </Badge>

        {product.status !== 'exported' ? (
          <Tooltip label="Вернуть в работу">
            <ActionIcon
              variant="light"
              color="gray"
              onClick={() => onReset(product.sku)}
              size="lg">
              <IconRotate2 size={18} />
            </ActionIcon>
          </Tooltip>
        ) : (
          <Group gap={4}>
            <Text size="xs" c="dimmed" fs="italic">
              Архив
            </Text>
            {product.batch_id && (
              <ActionIcon
                component="a"
                href={`/api/download/batch_${product.batch_id}.xlsx`}
                variant="subtle"
                size="sm"
                title="Скачать файл">
                <IconDownload size={14} />
              </ActionIcon>
            )}
          </Group>
        )}
      </Group>
    );
  }

  // 2. Если товар в работе — показываем варианты
  const suggestions = PriceCalculator.calculateSuggestions(
    product.currentPrice
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Кнопки автоматических предложений */}
      <Group gap={6}>
        {suggestions.map((price) => (
          <Button
            key={price}
            size="compact-md"
            variant="default"
            onClick={() => onUpdate(product.sku, price)}
            styles={{
              root: {
                fontWeight: 600,
                borderWidth: '1px',
                '&:hover': {
                  borderColor: 'var(--mantine-color-blue-5)',
                  color: 'var(--mantine-color-blue-6)',
                  backgroundColor: 'var(--mantine-color-blue-0)',
                },
              },
            }}>
            {price}
          </Button>
        ))}
      </Group>

      {/* Ручной ввод */}
      <Group gap={6}>
        <NumberInput
          placeholder="Своя..."
          value={customPrice}
          onChange={setCustomPrice}
          hideControls
          size="xs"
          w={80}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && customPrice) {
              onUpdate(product.sku, Number(customPrice));
            }
          }}
        />
        <Button
          variant="subtle"
          size="compact-xs"
          color="gray"
          td="underline"
          onClick={() => onUpdate(product.sku, product.currentPrice)}>
          Старая ({product.currentPrice})
        </Button>
      </Group>
    </div>
  );
}
