import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Proteção contra debug via console
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  window.console.log = () => {};
  window.console.info = () => {};
  window.console.warn = () => {};
  window.console.debug = () => {};
  
  setInterval(() => { debugger; }, 1000);
  
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I') || (e.ctrlKey && e.key === 'U')) {
      e.preventDefault();
    }
  });
}

// Garantir que o elemento root existe
const rootElement = document.getElementById('root');
if (!rootElement) {
  const div = document.createElement('div');
  div.id = 'root';
  document.body.appendChild(div);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);