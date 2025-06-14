import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import SpinTheWheel from './SpinTheWheel';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <SpinTheWheel />
  </React.StrictMode>
);

reportWebVitals();

