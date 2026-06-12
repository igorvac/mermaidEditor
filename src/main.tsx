import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ubuntu/400.css';
import '@fontsource/ubuntu/500.css';
import '@fontsource/ubuntu/700.css';
import 'material-symbols/rounded.css';
import './theme/global.css';
import App from './App';
import { installMockApi } from './devMockApi';

installMockApi();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
