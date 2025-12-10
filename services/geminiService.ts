import { GoogleGenAI } from "@google/genai";
import { Expense, Unit, ExpenseDistributionType } from "../types";

const apiKey = process.env.API_KEY || '';
// Initialize loosely to allow app to function without key (graceful degradation)
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateMonthlyReport = async (
  month: string,
  expenses: Expense[],
  units: Unit[],
  totalCollected: number,
  reserveTotal: number
): Promise<string> => {
  if (!ai) {
    return "API Key no configurada. Por favor configure la variable de entorno API_KEY para usar la IA.";
  }

  const expenseSummary = expenses.map(e => 
    `- ${e.date}: ${e.description} ($${e.amount}) [${e.category} - ${e.distributionType}]`
  ).join('\n');

  const prompt = `
    Actúa como un administrador de consorcio profesional y amable.
    Escribe un breve correo electrónico o nota para los propietarios (sin asunto).
    
    Contexto:
    - Mes de liquidación: ${month}
    - Total de gastos del mes: $${expenses.reduce((acc, curr) => curr.distributionType !== ExpenseDistributionType.FROM_RESERVE ? acc + curr.amount : acc, 0).toFixed(2)}
    - Total a recaudar (expensas + fondo): $${totalCollected.toFixed(2)}
    - Estado actual del Fondo de Reserva: $${reserveTotal.toFixed(2)}
    
    Detalle de gastos:
    ${expenseSummary}

    Instrucciones:
    1. Saluda cordialmente a los vecinos.
    2. Resume los gastos más importantes del mes.
    3. Menciona si hubo algún gasto cubierto por el Fondo de Reserva (FROM_RESERVE).
    4. Recuerda la importancia de mantener el fondo de reserva.
    5. Cierre formal.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No se pudo generar el reporte.";
  } catch (error) {
    console.error("Error generating report:", error);
    return "Hubo un error al conectar con Gemini para generar el reporte.";
  }
};

export const analyzeExpenseCategory = async (description: string): Promise<string> => {
  if (!ai) return "";
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Categoriza el siguiente gasto de consorcio en una palabra (ej: Mantenimiento, Servicios, Administrativo, Reparación): "${description}"`,
    });
    return response.text?.trim() || "";
  } catch (e) {
    return "";
  }
}