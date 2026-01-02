import { Button, Modal, Table } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

export // --- Модальное окно истории ---
const HistoryModal = ({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) => {
  const [batches, setBatches] = useState<any[]>([]);

  useEffect(() => {
    if (opened)
      fetch('/api/batches')
        .then((r) => r.json())
        .then(setBatches);
  }, [opened]);

  return (
    <Modal opened={opened} onClose={onClose} title="История выгрузок" size="lg">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Дата</Table.Th>
            <Table.Th>Файл</Table.Th>
            <Table.Th></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {batches.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={3} align="center">
                Нет истории
              </Table.Td>
            </Table.Tr>
          ) : (
            batches.map((b) => (
              <Table.Tr key={b.id}>
                <Table.Td>{new Date(b.date).toLocaleString('ru-RU')}</Table.Td>
                <Table.Td style={{ fontFamily: 'monospace' }}>
                  {b.name}
                </Table.Td>
                <Table.Td align="right">
                  <Button
                    component="a"
                    href={b.url}
                    download
                    size="xs"
                    variant="light"
                    leftSection={<IconDownload size={14} />}>
                    Скачать
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </Modal>
  );
};
