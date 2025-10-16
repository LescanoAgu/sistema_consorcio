// 1. Importar las herramientas que instalamos
const express = require('express');
const cors = require('cors');

// 2. Inicializar nuestro servidor
const app = express();
const PORT = 4000; // El "puerto" por donde escuchará nuestro servidor

// 3. Configurar el servidor para que use las herramientas
app.use(cors()); // Habilita que la app de Flutter pueda hacerle peticiones
app.use(express.json()); // Permite al servidor entender el formato JSON

// 4. Crear nuestra primera "ruta" o "endpoint" de datos
// Cuando la app pida la lista de comunicados, esta función se ejecutará.
app.get('/api/comunicados', (req, res) => {
  // Por ahora, enviamos datos de prueba (más adelante vendrán de una base de datos)
  const comunicadosDePrueba = [
    { id: 1, titulo: 'Corte de agua programado', fecha: '2025-10-18', contenido: 'Se realizará un corte por mantenimiento general.' },
    { id: 2, titulo: 'Fumigación de espacios comunes', fecha: '2025-10-17', contenido: 'El próximo sábado se fumigará el SUM y los pasillos.' },
    { id: 3, titulo: 'Asamblea Anual Ordinaria', fecha: '2025-10-15', contenido: 'Se convoca a todos los propietarios a la asamblea.' },
  ];
  
  // Enviamos los datos como respuesta en formato JSON
  res.json(comunicadosDePrueba);
});

// 5. Poner el servidor a "escuchar" para atender las peticiones
app.listen(PORT, () => {
  console.log(`✅ Servidor del consorcio corriendo en http://localhost:${PORT}`);
});