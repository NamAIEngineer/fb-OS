import React from 'react';
import ReactDOM from 'react-dom/client';
import 'antd/dist/reset.css';
import './theme/index.css';
import { AppRouter } from './router';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><AppRouter /></React.StrictMode>
);
