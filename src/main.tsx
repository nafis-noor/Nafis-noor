import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initScrollPerformance } from './utils/performance';

// Initialize iOS Safari passive scroll listeners & 100ms debouncing
initScrollPerformance();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
