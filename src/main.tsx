import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '@/styles/index.scss';
import App from '@/App';
import { queryClient } from '@/queryClient';

const root = document.getElementById('root');
if (!root) throw new Error('В index.html нет элемента #root — приложению некуда смонтироваться');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
