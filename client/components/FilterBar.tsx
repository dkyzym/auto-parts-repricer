import { Group, TextInput, Button, Badge } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';

interface FilterBarProps {
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  stats: Record<string, number>;
}

export function FilterBar({
  search,
  setSearch,
  status,
  setStatus,
  stats,
}: FilterBarProps) {
  const tabs = [
    { id: 'pending', label: 'В работе', color: 'gray' },
    { id: 'approved', label: 'Готовы', color: 'blue' },
    { id: 'deferred', label: 'Отложенные', color: 'orange' },
    { id: 'exported', label: 'Архив', color: 'grape' },
    { id: 'all', label: 'Все', color: 'dark' },
  ];

  return (
    <Group justify="space-between" align="end" w="100%">
      <TextInput
        placeholder="Поиск (SKU или имя)..."
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        w={400}
      />

      <Group gap={8}>
        {tabs.map((tab) => {
          const isActive = status === tab.id;
          const count = stats[tab.id] || 0;

          return (
            <Button
              key={tab.id}
              variant={isActive ? 'filled' : 'default'}
              color={isActive ? tab.color : 'gray'}
              onClick={() => setStatus(tab.id)}
              size="sm"
              rightSection={
                <Badge
                  size="xs"
                  circle
                  color={isActive ? 'white' : tab.color}
                  variant={isActive ? 'light' : 'filled'}
                  style={{
                    color: isActive ? 'var(--mantine-color-text)' : undefined,
                  }}>
                  {count}
                </Badge>
              }>
              {tab.label}
            </Button>
          );
        })}
      </Group>
    </Group>
  );
}
