import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client';
import './index.css'
import App from './App.jsx'

// 添加全局错误处理
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Root element not found!');
  document.body.innerHTML = '<div style="color: white; background: #1a1a1a; padding: 20px; font-family: sans-serif;"><h1>错误：找不到根元素</h1><p>请检查 index.html 文件</p></div>';
} else {
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    console.log('App rendered successfully');
  } catch (error) {
    console.error('Failed to render app:', error);
    rootElement.innerHTML = '<div style="color: white; background: #1a1a1a; padding: 20px; font-family: sans-serif;"><h1>渲染错误</h1><p>' + error.message + '</p></div>';
  }
}
