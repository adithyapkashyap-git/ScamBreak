import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import './styles.css';
import { AnalysisStoreProvider } from './state/AnalysisStore';
import { AuthProvider } from './state/AuthContext';
import { ThemeProvider } from './state/ThemeContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <AnalysisStoreProvider>
          <App />
        </AnalysisStoreProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
