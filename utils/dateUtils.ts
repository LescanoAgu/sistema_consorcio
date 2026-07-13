// Utilidades para manejar fechas sin errores de Timezone (UTC vs Local)

// Obtiene la fecha actual en formato YYYY-MM-DD en la zona horaria LOCAL del usuario.
// Evita el bug donde getLocalIsoDate() devuelve el día siguiente de noche.
export const getLocalIsoDate = (date: Date = new Date()): string => {
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 10);
    return localISOTime;
};

// Parsea un string 'YYYY-MM-DD' de manera segura para mostrarlo en formato local (DD/MM/YYYY)
// Evita el bug donde new Date('YYYY-MM-DD') se interpreta como UTC medianoche y al formatear localmente
// se atrasa al día anterior.
export const formatLocalDate = (isoDateString?: string): string => {
    if (!isoDateString) isoDateString = getLocalIsoDate();
    // Si la fecha ya viene con hora (ej: ISO completo), la parseamos directo
    if (isoDateString.includes('T')) {
        return new Date(isoDateString).toLocaleDateString('es-AR');
    }
    // Si viene como YYYY-MM-DD, extraemos los componentes
    const [year, month, day] = isoDateString.split('-');
    if (!year || !month || !day) return isoDateString;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
};
