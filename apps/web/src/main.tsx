import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './index.css';
import App from './app/App';
import { AuthProvider } from './auth/AuthProvider';

const root = document.getElementById('root');
if (!root) {
  throw new Error('找不到 #root 节点');
}

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);
