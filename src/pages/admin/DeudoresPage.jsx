// ... (importaciones de React y MUI)
import { aplicarInteresesMoratorios } from '../../services/propietariosService'; // <-- IMPORTAR
// ...// ... (dentro de DeudoresPage)

const handleSubmitIntereses = async (e) => {
  e.preventDefault();

  // Pedimos confirmación porque es una acción delicada
  const confirmacion = window.confirm(
    "¿Está seguro que desea aplicar intereses a TODOS los deudores?\n" +
    "Esta acción afectará sus saldos permanentemente."
  );
  if (!confirmacion) return;

  setLoading(true);
  setMessage('');

  try {
    const temFloat = parseFloat(tem.replace(',', '.'));
    if (isNaN(temFloat) || temFloat <= 0) {
      throw new Error('La Tasa (TEM) debe ser un número positivo.');
    }

    // Convertimos la tasa (ej: 5%) a decimal (ej: 0.05)
    const tasaDecimal = temFloat / 100;

    // Creamos un concepto claro para el registro
    const mesActual = new Date().toLocaleString('es-AR', { month: 'long' });
    const anioActual = new Date().getFullYear();
    const concepto = `Interés por Mora (${mesActual} ${anioActual})`;

    // --- AQUÍ LLAMAMOS AL SERVICE ---
    const resultado = await aplicarInteresesMoratorios(tasaDecimal, concepto);

    if (resultado.unidadesActualizadas === 0) {
      setMessage('No se encontraron deudores para aplicar intereses.');
    } else {
      setMessage(`¡Intereses aplicados a ${resultado.unidadesActualizadas} deudores!`);
    }

  } catch (error) {
    setMessage(`Error: ${error.message}`);
  } finally {
    setLoading(false);
  }
};