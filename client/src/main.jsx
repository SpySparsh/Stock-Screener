import React from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';
import Counter from './counter'; // If you renamed it, use App

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Counter />
  </React.StrictMode>
);
