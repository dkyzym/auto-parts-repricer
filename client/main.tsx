import { MantineProvider, createTheme } from '@mantine/core';
import ReactDOM from 'react-dom/client';
import App from './App';

// Обязательные стили Mantine
import '@mantine/core/styles.css';

const theme = createTheme({
  primaryColor: 'blue',
  fontFamily: 'Inter, system-ui, sans-serif',
  defaultRadius: 'md',
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

ReactDOM.createRoot(rootElement).render(
  <MantineProvider theme={theme}>
    <App />
  </MantineProvider>
);
