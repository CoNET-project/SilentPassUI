import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { DaemonProvider } from './providers/DaemonProvider';




const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <DaemonProvider>
      <App />
    </DaemonProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// --- Service Worker 註冊 ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // 確保路徑與您將 service-worker.js 放置在 public 目錄中的位置相匹配
    // 在生產環境中，React 應用程式的根路徑就是 Service Worker 的作用域
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker 註冊成功，範圍:', registration.scope);

      })
      .catch(error => {
        console.error('Service Worker 註冊失敗:', error);

      });
  });
} else {
  console.warn('您的瀏覽器不支持 Service Worker。離線功能不可用。');
  //  UI 反饋
}