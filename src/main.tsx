import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

/**
 * ホーム画面に追加したときにオフラインでも開けるようにする。
 * アーティファクト内など登録できない環境では、何もせず通常どおり動く。
 */
function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL;
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      // 登録できない環境ではオフライン対応を諦めるだけで、アプリは動く
    });
  });
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  registerServiceWorker();
}
