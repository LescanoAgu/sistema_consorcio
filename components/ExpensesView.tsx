
import React, { useState } from 'react';
import { Expense, ExpenseDistributionType } from '../types';
import { Plus, Trash2, DollarSign, Tag, Sparkles, Paperclip, FileText, CheckCircle, Loader2 } from 'lucide-react';
import { analyzeExpenseCategory } from '../services/geminiService';

interface ExpensesViewProps {
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
}

const EXPENSE_CATEGORIES = [
  'Mantenimiento',
  'Reparaciones',
  'Servicios',
  'Administrativo',
  'Seguros',
  'Sueldos y Cargas',
  'Limpieza',
  'Bancarios',
  'Otros'
];

const ExpensesView: React.FC<ExpensesViewProps> = ({ expenses, setExpenses }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string>('');
  
  // Upload Simulation State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    category: 'Ordinary',
    itemCategory: 'Mantenimiento',
    distributionType: ExpenseDistributionType.PRORATED,
    attachmentUrl: ''
  });

  const handleDescriptionBlur = async () => {
    if (newExpense.description && newExpense.description.length > 3) {
      setAnalyzing(true);
      const category = await analyzeExpenseCategory(newExpense.description);
      if (category) {
        setAiSuggestion(category);
      }
      setAnalyzing(false);
    }
  };

  const applyAiSuggestion = () => {
      // Try to match suggestion to our list, or default to 'Otros' if completely unknown, 
      // or just accept the string if we want flexibility. 
      // For now, let's try to set it if it matches, or keep it as text.
      if(aiSuggestion) {
          setNewExpense({...newExpense, itemCategory: aiSuggestion});
          setAiSuggestion('');
      }
  };

  const handleAdd = () => {
    if (!newExpense.description || !newExpense.amount) return;

    // Date Validation
    const dateToUse = newExpense.date || new Date().toISOString().split('T')[0];
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(dateToUse)) {
        alert("Formato de fecha inválido. Por favor utilice el formato YYYY-MM-DD.");
        return;
    }
    
    if (isNaN(Date.parse(dateToUse))) {
         alert("La fecha ingresada no es válida.");
         return;
    }

    const expense: Expense = {
      id: crypto.randomUUID(),
      description: newExpense.description,
      amount: Number(newExpense.amount),
      date: dateToUse,
      category: newExpense.category as 'Ordinary' | 'Extraordinary',
      itemCategory: newExpense.itemCategory || 'Otros',
      distributionType: newExpense.distributionType as ExpenseDistributionType,
      attachmentUrl: newExpense.attachmentUrl
    };
    setExpenses([...expenses, expense]);
    setNewExpense({
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      category: 'Ordinary',
      itemCategory: 'Mantenimiento',
      distributionType: ExpenseDistributionType.PRORATED,
      attachmentUrl: ''
    });
    setAiSuggestion('');
    setIsFormOpen(false);
  };

  const handleDelete = (id: string) => {
    if(confirm('¿Está seguro que desea eliminar este gasto?')) {
        setExpenses(expenses.filter(e => e.id !== id));
    }
  };

  // Simulate file upload with progress bar
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setIsUploading(true);
          setUploadProgress(0);

          // Simulate upload delay
          const interval = setInterval(() => {
              setUploadProgress((prev) => {
                  if (prev >= 100) {
                      clearInterval(interval);
                      setIsUploading(false);
                      setNewExpense(curr => ({ 
                          ...curr, 
                          attachmentUrl: `ticket_simulado_${file.name}` 
                      }));
                      return 100;
                  }
                  return prev + 10;
              });
          }, 150); // Updates every 150ms
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Registro de Gastos</h2>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center shadow-sm transition-colors"
        >
          {isFormOpen ? 'Cancelar' : (
             <>
                <Plus className="w-4 h-4 mr-2" />
                Registrar Gasto
             </>
          )}
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-indigo-100 animate-fade-in">
          <h3 className="text-lg font-semibold mb-4 text-slate-700">Nuevo Gasto</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
              <div className="relative">
                <input
                    type="text"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all"
                    placeholder="Ej: Reparación cerradura entrada"
                    value={newExpense.description}
                    onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                    onBlur={handleDescriptionBlur}
                />
                {analyzing && <span className="absolute right-3 top-2 text-xs text-indigo-500 animate-pulse">IA Analizando...</span>}
              </div>
              {aiSuggestion && (
                  <button 
                    onClick={applyAiSuggestion}
                    className="text-xs text-indigo-600 mt-1 flex items-center hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                    title="Clic para aplicar categoría sugerida"
                  >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Sugerencia IA: <strong>{aiSuggestion}</strong> (Clic para usar)
                  </button>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monto ($)</label>
              <div className="relative">
                <DollarSign className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                    type="number"
                    step="0.01"
                    className="w-full pl-9 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all"
                    value={newExpense.amount}
                    onChange={e => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Factura</label>
              <input
                  type="date"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all"
                  value={newExpense.date}
                  onChange={e => setNewExpense({ ...newExpense, date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rubro / Categoría</label>
              <div className="relative">
                <Tag className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <select
                    className="w-full pl-9 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all"
                    value={newExpense.itemCategory}
                    onChange={e => setNewExpense({ ...newExpense, itemCategory: e.target.value })}
                >
                    {EXPENSE_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                    {/* Allow custom entry if the AI suggested something else that isn't in list */}
                    {!EXPENSE_CATEGORIES.includes(newExpense.itemCategory || '') && newExpense.itemCategory && (
                        <option value={newExpense.itemCategory}>{newExpense.itemCategory}</option>
                    )}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Gasto</label>
              <select
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all"
                  value={newExpense.category}
                  onChange={e => setNewExpense({ ...newExpense, category: e.target.value as any })}
              >
                  <option value="Ordinary">Ordinario (Habitual)</option>
                  <option value="Extraordinary">Extraordinario</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Distribución</label>
              <select
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all"
                  value={newExpense.distributionType}
                  onChange={e => setNewExpense({ ...newExpense, distributionType: e.target.value as any })}
              >
                  <option value={ExpenseDistributionType.PRORATED}>Por Prorrateo (Coeficiente)</option>
                  <option value={ExpenseDistributionType.EQUAL_PARTS}>Partes Iguales</option>
                  <option value={ExpenseDistributionType.FROM_RESERVE}>Pagar desde Fondo Reserva</option>
              </select>
            </div>

            <div className="col-span-1 md:col-span-2">
                 <label className="block text-sm font-medium text-slate-700 mb-1">Comprobante (PDF/Foto)</label>
                 
                 {isUploading ? (
                     <div className="w-full h-[42px] px-4 border border-indigo-200 rounded-lg flex flex-col justify-center bg-indigo-50">
                         <div className="flex justify-between items-center text-xs text-indigo-700 mb-1 font-medium">
                             <span className="flex items-center"><Loader2 className="w-3 h-3 mr-1 animate-spin"/> Subiendo archivo...</span>
                             <span>{uploadProgress}%</span>
                         </div>
                         <div className="w-full bg-indigo-200 rounded-full h-1.5">
                             <div 
                                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300 ease-out" 
                                style={{ width: `${uploadProgress}%` }}
                             ></div>
                         </div>
                     </div>
                 ) : (
                    <div className="flex items-center gap-2">
                        <label className={`flex items-center justify-center px-4 py-2 border rounded-lg cursor-pointer transition-colors w-full bg-white shadow-sm ${newExpense.attachmentUrl ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-300 hover:bg-slate-50 text-slate-600'}`}>
                            {newExpense.attachmentUrl ? (
                                <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    <span className="text-sm truncate max-w-[200px]">{newExpense.attachmentUrl.replace('ticket_simulado_', '')}</span>
                                    <span className="ml-auto text-xs bg-white/50 px-2 py-0.5 rounded text-emerald-800">Cambiar</span>
                                </>
                            ) : (
                                <>
                                    <Paperclip className="w-4 h-4 mr-2 text-slate-500" />
                                    <span className="text-sm truncate">Adjuntar archivo...</span>
                                </>
                            )}
                            <input type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={handleFileChange} />
                        </label>
                    </div>
                 )}
            </div>
            
          </div>
          <div className="mt-6 flex justify-end">
              <button
                onClick={handleAdd}
                disabled={isUploading}
                className={`px-6 py-2 rounded-lg transition-colors shadow-sm text-white ${isUploading ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                  Guardar Gasto
              </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
              <th className="px-6 py-3 font-medium">Fecha</th>
              <th className="px-6 py-3 font-medium">Descripción</th>
              <th className="px-6 py-3 font-medium">Rubro</th>
              <th className="px-6 py-3 font-medium">Tipo</th>
              <th className="px-6 py-3 font-medium text-right">Monto</th>
              <th className="px-6 py-3 font-medium text-center">Archivo</th>
              <th className="px-6 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {expenses.map((expense) => (
              <tr key={expense.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4 text-slate-600 whitespace-nowrap text-sm">{expense.date}</td>
                <td className="px-6 py-4 text-slate-900 font-medium">
                    {expense.description}
                    <div className="text-xs text-slate-400 mt-0.5">
                         {expense.distributionType === ExpenseDistributionType.PRORATED && 'Prorrateo'}
                        {expense.distributionType === ExpenseDistributionType.EQUAL_PARTS && 'Partes Iguales'}
                        {expense.distributionType === ExpenseDistributionType.FROM_RESERVE && 'Fondo Reserva'}
                    </div>
                </td>
                <td className="px-6 py-4">
                     <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {expense.itemCategory || 'Otros'}
                     </span>
                </td>
                <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        expense.category === 'Ordinary' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                        {expense.category === 'Ordinary' ? 'Ordinario' : 'Extraordinario'}
                    </span>
                    {expense.distributionType === ExpenseDistributionType.FROM_RESERVE && (
                         <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                             Reserva
                         </span>
                    )}
                </td>
                <td className="px-6 py-4 text-right font-bold text-slate-800">
                    ${expense.amount.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-center">
                    {expense.attachmentUrl ? (
                         <button className="text-indigo-600 hover:text-indigo-800" title="Ver comprobante">
                             <FileText className="w-5 h-5 mx-auto" />
                         </button>
                    ) : (
                        <span className="text-slate-300">-</span>
                    )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => handleDelete(expense.id)} 
                    className="p-2 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all opacity-100"
                    title="Eliminar Gasto"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
             {expenses.length === 0 && (
                <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                        No hay gastos registrados este mes.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExpensesView;
