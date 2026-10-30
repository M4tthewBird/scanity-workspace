import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { PointCloud } from './components/PointCloud';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PointCloud />
    <App />
  </StrictMode>,
);
