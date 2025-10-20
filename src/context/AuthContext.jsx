import React, { createContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';

// 1. Crear el contexto
export const AuthContext = createContext();

// 2. Crear el Proveedor (Provider)
// Este componente envolverá a toda nuestra aplicación
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Este observador de Firebase se activa solo cuando
    // el usuario inicia sesión o cierra sesión.
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    // Limpiar el observador cuando el componente se desmonta
    return () => unsubscribe();
  }, []);

  // Si está "loading", no mostramos nada aún
  if (loading) {
    return <h2>Cargando...</h2>; // O un spinner
  }

  // Devolvemos el Contexto "Provider" con los valores
  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}