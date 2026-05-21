import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Suppress benign ResizeObserver errors common with Recharts/Monaco in complex layouts
// These errors are safe to ignore as they indicate the browser could not deliver all resize notifications in a single frame
window.addEventListener('error', (e) => {
  if (
    e.message === 'ResizeObserver loop completed with undelivered notifications.' ||
    e.message === 'ResizeObserver loop limit exceeded'
  ) {
    e.stopImmediatePropagation();
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);