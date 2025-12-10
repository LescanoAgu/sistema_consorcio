import React, { useState } from 'react';
import { Expense, ExpenseDistributionType } from '../types';
import { Plus, Trash2, CheckCircle, Loader2, Paperclip, FileText } from 'lucide-react';
// Importamos servicios
import { addExpense, uploadReceipt } from '../services/firestoreService';

interface ExpensesViewProps {
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  consortiumId: string; // ✅
}

const ExpensesView: React.FC<ExpensesViewProps> = ({ expenses, setExpenses, consortiumId }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    description: '', amount: 0, date: new Date().toISOString().split('T')[0], category: 'Ordinary', itemCategory: 'Mantenimiento', distributionType: ExpenseDistributionType.PRORATED, attachmentUrl: ''
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setIsUploading(true);
          try {
              // ✅ Subida real a Firebase Storage
              const url = await uploadReceipt(file, consortiumId);
              setNewExpense(curr => ({ ...curr, attachmentUrl: url }));
          } catch (error) { alert("Error al subir archivo"); } 
          finally { setIsUploading(false); }
      }
  }

  const handleAdd = async () => {
    if (!newExpense.description || !newExpense.amount) return;
    try {
        // ✅ Guardado real
        const saved = await addExpense(consortiumId, {
            id: 'temp',
            description: newExpense.description,
            amount: Number(newExpense.amount),
            date: newExpense.date || '',
            category: newExpense.category as any,
            distributionType: newExpense.distributionType as any,
            itemCategory: newExpense.itemCategory,
            attachmentUrl: newExpense.attachmentUrl
        });
        setExpenses([...expenses, saved]);
        setIsFormOpen(false);
        setNewExpense({ description: '', amount: 0, date: new Date().toISOString().split('T')[0], category: 'Ordinary', itemCategory: 'Mantenimiento', distributionType: ExpenseDistributionType.PRORATED, attachmentUrl: '' });
    } catch (e) { alert("Error al guardar gasto"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Gastos</h2>
        <button onClick={() => setIsFormOpen(!isFormOpen)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg">
            {isFormOpen ? 'Cancelar' : 'Nuevo Gasto'}
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-white p-6 rounded-xl border shadow-sm grid gap-4">
             <input className="border p-2 rounded" placeholder="Descripción" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} />
             <div className="flex gap-4">
                 <input type="number" className="border p-2 rounded w-1/3" placeholder="Monto" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: parseFloat(e.target.value)})} />
                 <input type="date" className="border p-2 rounded w-1/3" value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} />
                 <select className="border p-2 rounded w-1/3" value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value as any})}><option value="Ordinary">Ordinario</option><option value="Extraordinary">Extraordinario</option></select>
             </div>
             
             {/* Subida de Archivo */}
             <div className="border p-3 rounded-lg bg-slate-50">
                 <label className="text-sm font-bold block mb-2">Comprobante</label>
                 {isUploading ? <span className="text-indigo-600 flex items-center"><Loader2 className="animate-spin mr-2"/> Subiendo...</span> : 
                 <input type="file" onChange={handleFileChange} />}
                 {newExpense.attachmentUrl && !isUploading && <span className="text-green-600 flex items-center mt-2"><CheckCircle className="w-4 h-4 mr-1"/> Cargado</span>}
             </div>

             <button onClick={handleAdd} disabled={isUploading} className="bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700">Guardar</button>
        </div>
      )}

      {/* Lista de gastos */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 uppercase text-slate-500">
                  <tr><th className="px-6 py-3">Fecha</th><th className="px-6 py-3">Descripción</th><th className="px-6 py-3 text-right">Monto</th><th className="px-6 py-3 text-center">Archivo</th></tr>
              </thead>
              <tbody>
                  {expenses.map(e => (
                      <tr key={e.id} className="border-b">
                          <td className="px-6 py-3">{e.date}</td>
                          <td className="px-6 py-3">{e.description}</td>
                          <td className="px-6 py-3 text-right">${e.amount.toFixed(2)}</td>
                          <td className="px-6 py-3 text-center">{e.attachmentUrl ? <a href={e.attachmentUrl} target="_blank" className="text-blue-600"><FileText className="inline w-4 h-4"/></a> : '-'}</td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>
    </div>
  );
};
export default ExpensesView;