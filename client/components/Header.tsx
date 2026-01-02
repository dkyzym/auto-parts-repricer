import {
  Group,
  Title,
  Text,
  Paper,
  NumberInput,
  ActionIcon,
  Button,
  Tooltip,
} from '@mantine/core';
import {
  IconDatabase,
  IconRefresh,
  IconHistory,
  IconFileSpreadsheet,
  IconDeviceFloppy,
} from '@tabler/icons-react';

interface HeaderProps {
  marginThreshold: number;
  setMarginThreshold: (val: number) => void;
  onSeed: () => void;
  onBackup: () => void;
  onExport: () => void;
  onHistory: () => void;
}

export function Header({
  marginThreshold,
  setMarginThreshold,
  onSeed,
  onBackup,
  onExport,
  onHistory,
}: HeaderProps) {
  return (
    <Group justify="space-between" h="100%">
      <Group>
        <div
          style={{
            background: '#228be6',
            padding: 8,
            borderRadius: 8,
            color: 'white',
            display: 'flex',
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
              w={50}
              hideControls
              styles={{ input: { textAlign: 'center', fontWeight: 700 } }}
            />
          </Group>
        </Paper>

        <Tooltip label="Создать бэкап сейчас">
          <ActionIcon
            variant="light"
            color="orange"
            size="lg"
            onClick={onBackup}
            radius="md">
            <IconDeviceFloppy size={20} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Сброс и загрузка БД">
          <ActionIcon variant="default" size="lg" onClick={onSeed} radius="md">
            <IconRefresh size={20} />
          </ActionIcon>
        </Tooltip>

        <Button
          variant="default"
          leftSection={<IconHistory size={16} />}
          onClick={onHistory}>
          История
        </Button>
        <Button
          color="green"
          leftSection={<IconFileSpreadsheet size={16} />}
          onClick={onExport}>
          Экспорт
        </Button>
      </Group>
    </Group>
  );
}
