import React, { useState, useMemo } from 'react';
import { Expense, ExpenseDistributionType } from '../types';
import { Plus, Trash2, DollarSign, Tag, Sparkles, Paperclip, FileText, CheckCircle, Loader2, Split } from 'lucide-react';
import { analyzeExpenseCategory } from '../services/geminiService';

interface ExpensesViewProps {
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  reserveBalance: number; // NUEVO: Necesitamos saber cuánta plata hay en la caja
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

const ExpensesView: React.FC<ExpensesViewProps> = ({ expenses, setExpenses, reserveBalance }) => {
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

  const gastosAgrupados = useMemo(() => {
    return expenses.reduce((acumulador, gasto) => {
      const categoria = gasto.itemCategory || 'Varios';
      if (!acumulador[categoria]) {
        acumulador[categoria] = [];
      }
      acumulador[categoria].push(gasto);
      return acumulador;
    }, {} as Record<string, Expense[]>);
  }, [expenses]);

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
      if(aiSuggestion) {
          setNewExpense({...newExpense, itemCategory: aiSuggestion});
          setAiSuggestion('');
      }
  };

  const handleAdd = () => {
    if (!newExpense.description || !newExpense.amount) return;

    const amount = Number(newExpense.amount);
    const dateToUse = newExpense.date || new Date().toISOString().split('T')[0];
    
    if (isNaN(Date.parse(dateToUse))) {
         alert("La fecha ingresada no es válida.");
         return;
    }

    // --- LÓGICA DE DESDOBLAMIENTO (FONDO INSUFICIENTE) ---
    // Si paga con Fondo Y el monto es mayor a lo que hay en caja...
    if (newExpense.distributionType === ExpenseDistributionType.FROM_RESERVE && amount > reserveBalance) {
        
        const covered = reserveBalance;   // Lo que cubre el fondo
        const remainder = amount - reserveBalance; // Lo que falta (se pasa a Extraordinaria)

        if (confirm(`⚠️ SALDO INSUFICIENTE EN FONDO\n\nEl fondo tiene $${reserveBalance.toFixed(2)} y el gasto es de $${amount.toFixed(2)}.\n\n¿Desea dividirlo automáticamente?\n1. $${covered.toFixed(2)} se pagan con el Fondo.\n2. $${remainder.toFixed(2)} pasan a Expensa EXTRAORDINARIA (Propietario).`)) {
            
            // Gasto 1: Hasta donde alcance el fondo
            const expenseReserve: Expense = {
                id: crypto.randomUUID(),
                description: `${newExpense.description} (Parte Cubierta por Fondo)`,
                amount: covered,
                date: dateToUse,
                category: 'Ordinary', // Irrelevante porque lo paga el fondo
                itemCategory: newExpense.itemCategory || 'Otros',
                distributionType: ExpenseDistributionType.FROM_RESERVE,
                attachmentUrl: newExpense.attachmentUrl
            };

            // Gasto 2: El resto va al Propietario (Extraordinaria)
            const expenseExtra: Expense = {
                id: crypto.randomUUID(),
                description: `${newExpense.description} (Saldo Remanente)`,
                amount: remainder,
                date: dateToUse,
                category: 'Extraordinary', // ESTO ES CLAVE: Paga propietario
                itemCategory: newExpense.itemCategory || 'Otros',
                distributionType: ExpenseDistributionType.PRORATED, // Se prorratea
                attachmentUrl: newExpense.attachmentUrl
            };

            setExpenses([...expenses, expenseReserve, expenseExtra]);
            resetForm();
            return; // Cortamos acá para no agregar el gasto original
        }
    }

    // --- FLUJO NORMAL ---
    const expense: Expense = {
      id: crypto.randomUUID(),
      description: newExpense.description,
      amount: amount,
      date: dateToUse,
      category: newExpense.category as 'Ordinary' | 'Extraordinary',
      itemCategory: newExpense.itemCategory || 'Otros',
      distributionType: newExpense.distributionType as ExpenseDistributionType,
      attachmentUrl: newExpense.attachmentUrl
    };
    setExpenses([...expenses, expense]);
    resetForm();
  };

  const resetForm = () => {
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
  }

  const handleDelete = (id: string) => {
    if(confirm('¿Está seguro que desea eliminar este gasto?')) {
        setExpenses(expenses.filter(e => e.id !== id));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setIsUploading(true);
          setUploadProgress(0);

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
          }, 150);
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Registro de Gastos</h2>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className={`px-4 py-2 rounded-lg flex items-center shadow-sm transition-colors ${isFormOpen ? 'bg-white border border-slate-300 text-slate-700' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
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
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-lg font-semibold text-slate-700">Nuevo Gasto</h3>
             {/* Indicador de saldo disponible si elige Fondo Reserva */}
             {newExpense.distributionType === ExpenseDistributionType.FROM_RESERVE && (
                 <div className={`text-xs px-3 py-1 rounded-full font-bold border ${reserveBalance >= (newExpense.amount || 0) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                    <Split className="w-3 h-3 inline mr-1"/>
                    Saldo Fondo: ${reserveBalance.toFixed(2)}
                 </div>
             )}
          </div>
          
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
                    // CORRECCIÓN ERROR NaN: Si no hay valor, pasamos string vacío
                    value={newExpense.amount || ''}
                    onChange={e => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })}
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

      {/* --- LISTADO AGRUPADO --- */}
      <div className="space-y-8">
        {expenses.length === 0 ? (
           !isFormOpen && (
                <div className="text-center p-10 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                    <p className="text-slate-500">No hay gastos registrados este mes.</p>
                </div>
           )
        ) : (
          Object.keys(gastosAgrupados).sort().map((categoria) => (
            <div key={categoria} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 uppercase tracking-wide text-sm flex items-center">
                        <Tag className="w-4 h-4 mr-2 text-indigo-500"/>
                        {categoria}
                    </h3>
                    <span className="text-xs font-semibold bg-white px-2 py-1 rounded border text-slate-500">
                        {gastosAgrupados[categoria].length} ítem{gastosAgrupados[categoria].length !== 1 ? 's' : ''}
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white border-b border-slate-100">
                            <tr className="text-slate-400 text-xs uppercase">
                                <th className="px-6 py-3 font-medium">Fecha</th>
                                <th className="px-6 py-3 font-medium">Descripción</th>
                                <th className="px-6 py-3 font-medium">Tipo / Distrib.</th>
                                <th className="px-6 py-3 font-medium text-center">Archivo</th>
                                <th className="px-6 py-3 font-medium text-right">Monto</th>
                                <th className="px-6 py-3 font-medium text-right"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {gastosAgrupados[categoria].map((expense) => (
                            <tr key={expense.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-3 text-slate-500 text-sm whitespace-nowrap">
                                    {new Date(expense.date).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-3 text-slate-800 font-medium text-sm">
                                    {expense.description}
                                </td>
                                <td className="px-6 py-3 text-sm">
                                    <div className="flex flex-col gap-1 items-start">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
                                            expense.category === 'Ordinary' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-purple-50 text-purple-700 border border-purple-100'
                                        }`}>
                                            {expense.category === 'Ordinary' ? 'Ordinario' : 'Extraordinario'}
                                        </span>
                                        {expense.distributionType === ExpenseDistributionType.FROM_RESERVE && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-100">
                                                Fondo Reserva
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-3 text-center">
                                    {expense.attachmentUrl ? (
                                        <button className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 p-1.5 rounded transition-colors" title="Ver comprobante">
                                            <FileText className="w-4 h-4" />
                                        </button>
                                    ) : (
                                        <span className="text-slate-200">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-3 text-right font-bold text-slate-700 text-sm">
                                    ${expense.amount.toFixed(2)}
                                </td>
                                <td className="px-6 py-3 text-right">
                                    <button 
                                        onClick={() => handleDelete(expense.id)} 
                                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                        title="Eliminar Gasto"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-200">
                            <tr>
                                <td colSpan={4} className="px-6 py-2 text-right text-xs font-bold text-slate-500 uppercase">
                                    Subtotal {categoria}:
                                </td>
                                <td className="px-6 py-2 text-right font-bold text-indigo-600 text-sm">
                                    ${gastosAgrupados[categoria].reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
          ))
        )}
      </div>

      {expenses.length > 0 && (
          <div className="flex justify-end pt-4">
              <div className="bg-slate-800 text-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-6">
                  <div className="text-right">
                      <p className="text-slate-400 text-xs uppercase font-semibold">Total del Mes</p>
                      <p className="text-2xl font-bold">${expenses.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ExpensesView;