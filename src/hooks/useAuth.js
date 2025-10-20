import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

// Un hook simple para acceder a los datos del contexto
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};