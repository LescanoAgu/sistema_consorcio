import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext'; // <-- Importamos

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Envolvemos la App completa */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
); 