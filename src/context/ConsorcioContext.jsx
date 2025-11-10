import React, { createContext, useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth'; // <-- 1. IMPORTAR EL HOOK DE AUTH

// 1. Crear el contexto
export const ConsorcioContext = createContext();

// 2. Crear el Proveedor (Provider)
export function ConsorcioProvider({ children }) {
  const { user } = useAuth(); // <-- 2. OBTENER EL USUARIO DEL AUTHCONTEXT
  
  const [consorcioId, setConsorcioId] = useState(null);
  const [consorcios, setConsorcios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // <-- Estado de error

  // 3. Modificar el useEffect
  useEffect(() => {
    const fetchConsorcios = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log("Intentando cargar consorcios (usuario autenticado)...");
        const consorciosCollection = collection(db, 'consorcios');
        const snapshot = await getDocs(consorciosCollection);
        
        const listaConsorcios = snapshot.docs.map(doc => ({
          id: doc.id,
          nombre: doc.data().nombre || doc.id,
        }));
        
        setConsorcios(listaConsorcios);

        if (listaConsorcios.length > 0) {
          // Intentar mantener el ID si ya existía, o poner el primero
          setConsorcioId(prevId => 
            listaConsorcios.some(c => c.id === prevId) ? prevId : listaConsorcios[0].id
          );
        } else {
          setError("No se encontraron consorcios. El administrador debe crear uno.");
          setConsorcioId(null);
        }
      } catch (error) {
        console.error("Error al cargar consorcios:", error);
        setError(error.message); // Guardar el error
      } finally {
        setLoading(false);
      }
    };

    // 4. LA CLAVE: Solo buscar consorcios SI el usuario está logueado
    if (user) {
      fetchConsorcios();
    } else {
      // Si el usuario se desloguea, limpiamos todo
      setLoading(false);
      setConsorcios([]);
      setConsorcioId(null);
      setError(null);
    }
    
  }, [user]); // <-- 5. AGREGAR 'user' COMO DEPENDENCIA

  const value = {
    consorcioId,
    consorcios,
    loading,
    error, // <-- Exponer el error
    setConsorcioId,
    consorcioActivo: consorcios.find(c => c.id === consorcioId) || null
  };

  // 6. Ajustar la lógica de carga
  // El AuthContext ya muestra "Cargando..."
  // No necesitamos mostrar otro spinner aquí mientras 'user' es null.
  
  // Si el usuario NO está logueado (ej: en /login), simplemente renderizamos 'children'
  // y el contexto estará vacío, lo cual es correcto.
  if (!user) {
    return (
      <ConsorcioContext.Provider value={value}>
        {children}
      </ConsorcioContext.Provider>
    );
  }
  
  // Si el usuario ESTÁ logueado pero estamos cargando consorcios
  if (user && loading) {
     return <h2>Cargando consorcios...</h2>; // Spinner de Consorcios
  }
  
  // Si el usuario ESTÁ logueado y hubo un error al cargar consorcios
  if (user && error) {
     return <h2>Error al cargar consorcios: {error}</h2>;
  }
  
  // Si el usuario ESTÁ logueado y NO hay consorcios
  if (user && !loading && consorcios.length === 0 && !error) {
     return <h2>No se encontraron consorcios. Contacte al administrador.</h2>;
  }

  // Si todo está bien (usuario logueado, consorcios cargados)
  return (
    <ConsorcioContext.Provider value={value}>
      {children}
    </ConsorcioContext.Provider>
  );
}