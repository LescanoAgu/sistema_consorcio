import { useContext } from 'react';
import { ConsorcioContext } from '../context/ConsorcioContext';

// Un hook simple para acceder a los datos del consorcio activo
export const useConsorcio = () => {
  const context = useContext(ConsorcioContext);
  if (!context) {
    throw new Error('useConsorcio debe ser usado dentro de un ConsorcioProvider');
  }
  return context;
};