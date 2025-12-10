import React, { useState } from 'react';
import { Expense, ExpenseDistributionType } from '../types';
import { Plus, Trash2, DollarSign, Tag, Paperclip, FileText, CheckCircle, Loader2 } from 'lucide-react';
// ✅ Importamos los servicios reales
import { addExpense, uploadReceipt } from '../services/firestoreService';

interface ExpensesViewProps {
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  consortiumId: string; // ✅ Necesario
}

const ExpensesView: React.FC<ExpensesViewProps> = ({ expenses, setExpenses, consortiumId }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // Estado real de subida
  
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    category: 'Ordinary',
    itemCategory: 'Mantenimiento',
    distributionType: ExpenseDistributionType.PRORATED,
    attachmentUrl: ''
  });

  // ✅ SUBIDA DE ARCHIVO REAL (Soluciona el congelamiento)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          
          // Validación de tamaño (Max 5MB) para evitar cuelgues
          if (file.size > 5 * 1024 * 1024) {
              alert("El archivo es demasiado grande. Máximo 5MB.");
              return;
          }

          setIsUploading(true);
          try {
              // Subimos a Firebase Storage
              const url = await uploadReceipt(file, consortiumId);
              setNewExpense(curr => ({ ...curr, attachmentUrl: url }));
          } catch (error) {
              console.error(error);
              alert("Error al subir el archivo.");
          } finally {
              setIsUploading(false);
          }
      }
  }

  const handleAdd = async () => {
    if (!newExpense.description || !newExpense.amount) return;
    
    try {
        const expenseToSave = {
            id: 'temp',
            description: newExpense.description,
            amount: Number(newExpense.amount),
            date: newExpense.date || new Date().toISOString().split('T')[0],
            category: newExpense.category as any,
            itemCategory: newExpense.itemCategory || 'Otros',
            distributionType: newExpense.distributionType as any,
            attachmentUrl: newExpense.attachmentUrl
        };

        // ✅ Guardar en Firestore
        const saved = await addExpense(consortiumId, expenseToSave as Expense);
        
        setExpenses([...expenses, saved]);
        setNewExpense({
            description: '',
            amount: 0,
            date: new Date().toISOString().split('T')[0],
            category: 'Ordinary',
            itemCategory: 'Mantenimiento',
            distributionType: ExpenseDistributionType.PRORATED,
            attachmentUrl: ''
        });
        setIsFormOpen(false);
    } catch (e) {
        alert("Error al guardar el gasto");
    }
  };

  // ... (El resto del renderizado es similar, usa isUploading para mostrar el spinner)
  return (
      <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800">Gastos del Mes</h2>
            <button onClick={() => setIsFormOpen(!isFormOpen)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg">
                {isFormOpen ? 'Cancelar' : 'Nuevo Gasto'}
            </button>
          </div>

          {isFormOpen && (
              <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-sm">
                  {/* ... Campos del formulario ... */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <input 
                        type="text" 
                        placeholder="Descripción" 
                        className="border p-2 rounded" 
                        value={newExpense.description}
                        onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                      />
                      <input 
                        type="number" 
                        placeholder="Monto" 
                        className="border p-2 rounded"
                        value={newExpense.amount}
                        onChange={e => setNewExpense({...newExpense, amount: parseFloat(e.target.value)})} 
                      />
                  </div>

                  {/* Input de Archivo */}
                  <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">Comprobante</label>
                      {isUploading ? (
                          <div className="text-indigo-600 flex items-center text-sm">
                              <Loader2 className="w-4 h-4 mr-2 animate-spin"/> Subiendo a la nube...
                          </div>
                      ) : (
                          <input type="file" onChange={handleFileChange} accept=".pdf,.jpg,.png" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                      )}
                      {newExpense.attachmentUrl && !isUploading && (
                          <div className="text-xs text-emerald-600 mt-1 flex items-center">
                              <CheckCircle className="w-3 h-3 mr-1"/> Archivo cargado correctamente
                          </div>
                      )}
                  </div>

                  <button onClick={handleAdd} disabled={isUploading} className="bg-indigo-600 text-white px-6 py-2 rounded-lg">
                      Guardar
                  </button>
              </div>
          )}

          {/* Tabla de gastos */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b">
                      <tr>
                          <th className="px-6 py-3">Fecha</th>
                          <th className="px-6 py-3">Descripción</th>
                          <th className="px-6 py-3 text-right">Monto</th>
                          <th className="px-6 py-3 text-center">Archivo</th>
                      </tr>
                  </thead>
                  <tbody>
                      {expenses.map(e => (
                          <tr key={e.id} className="border-b">
                              <td className="px-6 py-3">{e.date}</td>
                              <td className="px-6 py-3">{e.description}</td>
                              <td className="px-6 py-3 text-right">${e.amount.toFixed(2)}</td>
                              <td className="px-6 py-3 text-center">
                                  {e.attachmentUrl ? <a href={e.attachmentUrl} target="_blank" className="text-blue-600 underline">Ver</a> : '-'}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
  );
};

export default ExpensesView;