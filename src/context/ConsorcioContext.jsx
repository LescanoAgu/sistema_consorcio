import React, { createContext, useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, getDocs } from 'firebase/firestore';

// 1. Crear el contexto
export const ConsorcioContext = createContext();

// 2. Crear el Proveedor (Provider)
// Nota: Por simplicidad inicial, listaremos todos los consorcios
export function ConsorcioProvider({ children }) {
  const [consorcioId, setConsorcioId] = useState(null); // ID del consorcio activo
  const [consorcios, setConsorcios] = useState([]); // Lista de todos los consorcios
  const [loading, setLoading] = useState(true);

  // Cargar lista de consorcios y establecer el primero como activo
  useEffect(() => {
    const fetchConsorcios = async () => {
      try {
        // Por ahora, asumimos que todos los documentos en 'consorcios' son consorcios
        const consorciosCollection = collection(db, 'consorcios');
        const snapshot = await getDocs(consorciosCollection);
        
        const listaConsorcios = snapshot.docs.map(doc => ({
          id: doc.id,
          nombre: doc.data().nombre || doc.id, // Usar el campo 'nombre' del consorcio
        }));
        
        setConsorcios(listaConsorcios);

        // Si hay consorcios, establece el primero como activo por defecto
        if (listaConsorcios.length > 0) {
          setConsorcioId(listaConsorcios[0].id);
        }
      } catch (error) {
        console.error("Error al cargar consorcios:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchConsorcios();
  }, []);

  const value = {
    consorcioId,
    consorcios,
    loading,
    setConsorcioId, // Función para cambiar el consorcio activo
    consorcioActivo: consorcios.find(c => c.id === consorcioId) || { id: consorcioId, nombre: 'Cargando...' }
  };

  // Si está cargando, esperamos (similar a AuthContext)
  if (loading) {
    return <h2>Cargando consorcios...</h2>;
  }
  
  // Si no hay consorcios, la aplicación no puede iniciar
  if (!consorcioId && !loading) {
     // Aquí deberíamos redirigir a una página para crear el primer consorcio
     return <h2>Error: No se encontraron consorcios activos.</h2>;
  }

  return (
    <ConsorcioContext.Provider value={value}>
      {children}
    </ConsorcioContext.Provider>
  );
}