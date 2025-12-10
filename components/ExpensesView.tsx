import React, { useState, useMemo } from 'react';
import { Expense, ExpenseDistributionType } from '../types';
import { Plus, Trash2, DollarSign, Tag, Paperclip, CheckCircle, Loader2, Split, AlertCircle } from 'lucide-react';

// Eliminada la importación de geminiService que rompía la app

interface ExpensesViewProps {
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  reserveBalance: number; // Saldo Inicial
}

const EXPENSE_CATEGORIES = [
  'Mantenimiento', 'Reparaciones', 'Servicios', 'Administrativo', 
  'Seguros', 'Sueldos y Cargas', 'Limpieza', 'Bancarios', 'Otros'
];

const ExpensesView: React.FC<ExpensesViewProps> = ({ expenses, setExpenses, reserveBalance }) => {
  const [isFormOpen, setIsFormOpen] = useState(true);
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

  // --- LÓGICA DE SALDO EN TIEMPO REAL ---
  // 1. Calculamos cuánto ya gastaste del fondo en la lista actual
  const spentFromReserve = useMemo(() => {
    return expenses
      .filter(e => e.distributionType === ExpenseDistributionType.FROM_RESERVE)
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [expenses]);

  // 2. Saldo Inicial seguro
  const initialBalanceSafe = (typeof reserveBalance === 'number' && !isNaN(reserveBalance)) ? reserveBalance : 0;
  
  // 3. SALDO DISPONIBLE AHORA (Inicial - Lo que ya cargaste)
  const currentAvailableBalance = initialBalanceSafe - spentFromReserve;

  // Agrupación para la tabla
  const gastosAgrupados = useMemo(() => {
    return expenses.reduce((acumulador, gasto) => {
      const categoria = gasto.itemCategory || 'Varios';
      if (!acumulador[categoria]) acumulador[categoria] = [];
      acumulador[categoria].push(gasto);
      return acumulador;
    }, {} as Record<string, Expense[]>);
  }, [expenses]);

  const handleAdd = () => {
    if (!newExpense.description) return alert("Falta descripción");
    const amount = Number(newExpense.amount) || 0;
    if (amount <= 0) return alert("El monto debe ser mayor a 0");
    
    const dateToUse = newExpense.date || new Date().toISOString().split('T')[0];
    
    // --- LÓGICA DE DESDOBLAMIENTO (Fondo vs Extraordinaria) ---
    // Usamos el saldo restante actual para validar
    if (newExpense.distributionType === ExpenseDistributionType.FROM_RESERVE && amount > currentAvailableBalance) {
        
        // Cuánto podemos cubrir con lo que queda
        const covered = currentAvailableBalance > 0 ? currentAvailableBalance : 0;   
        const remainder = amount - covered;
        
        // CASO A: No queda nada ($0) -> Todo a Extraordinaria
        if (covered <= 0) {
            if(confirm(`⚠️ EL FONDO ESTÁ VACÍO ($0.00)\n\nEl saldo inicial era $${initialBalanceSafe.toLocaleString()}, pero ya se consumió con los gastos anteriores.\n\n¿Desea cargar los $${amount.toLocaleString()} como EXPENSA EXTRAORDINARIA?`)) {
                const expenseExtra: Expense = {
                    id: crypto.randomUUID(),
                    description: `${newExpense.description} (Saldo)`,
                    amount: amount,
                    date: dateToUse,
                    category: 'Extraordinary',
                    itemCategory: newExpense.itemCategory || 'Otros',
                    distributionType: ExpenseDistributionType.PRORATED,
                    attachmentUrl: newExpense.attachmentUrl
                };
                setExpenses([...expenses, expenseExtra]);
                resetForm();
                return;
            }
            return; // Si dice que no, cancelamos
        }

        // CASO B: Queda algo, pero no alcanza -> Dividimos
        if (confirm(`⚠️ SALDO INSUFICIENTE\n\nQuedan disponibles: $${covered.toLocaleString()}\nGasto a ingresar: $${amount.toLocaleString()}\nFaltan: $${remainder.toLocaleString()}\n\n¿Dividir automáticamente?\n1. $${covered.toLocaleString()} (Fondo)\n2. $${remainder.toLocaleString()} (Extraordinaria)`)) {
            
            // Parte 1: Fondo
            const expenseReserve: Expense = {
                id: crypto.randomUUID(),
                description: `${newExpense.description} (Parte Fondo)`,
                amount: covered,
                date: dateToUse,
                category: 'Ordinary', 
                itemCategory: newExpense.itemCategory || 'Otros',
                distributionType: ExpenseDistributionType.FROM_RESERVE,
                attachmentUrl: newExpense.attachmentUrl
            };

            // Parte 2: Extraordinaria
            const expenseExtra: Expense = {
                id: crypto.randomUUID(),
                description: `${newExpense.description} (Saldo)`,
                amount: remainder,
                date: dateToUse,
                category: 'Extraordinary', 
                itemCategory: newExpense.itemCategory || 'Otros',
                distributionType: ExpenseDistributionType.PRORATED,
                attachmentUrl: newExpense.attachmentUrl
            };

            setExpenses([...expenses, expenseReserve, expenseExtra]);
            resetForm();
            return; 
        }
    }

    // --- CARGA NORMAL ---
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
        description: '', amount: 0, date: new Date().toISOString().split('T')[0],
        category: 'Ordinary', itemCategory: 'Mantenimiento',
        distributionType: ExpenseDistributionType.PRORATED, attachmentUrl: ''
      });
      // No cerramos el formulario para permitir carga rápida
  }

  const handleDelete = (id: string) => {
    if(confirm('¿Eliminar gasto?')) setExpenses(expenses.filter(e => e.id !== id));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setIsUploading(true);
          const interval = setInterval(() => {
              setUploadProgress((prev) => {
                  if (prev >= 100) {
                      clearInterval(interval);
                      setIsUploading(false);
                      setNewExpense(curr => ({ ...curr, attachmentUrl: `ticket_${file.name}` }));
                      return 100;
                  }
                  return prev + 20;
              });
          }, 100);
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Registro de Gastos</h2>
        {isFormOpen ? (
             <button onClick={() => setIsFormOpen(false)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                Ocultar Formulario
             </button>
        ) : (
            <button onClick={() => setIsFormOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition-colors">
                <Plus className="w-4 h-4 mr-2" /> Nuevo Gasto
            </button>
        )}
      </div>

      {isFormOpen && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-indigo-100 animate-fade-in">
          
          <h3 className="text-lg font-bold text-slate-700 mb-4 border-b border-slate-100 pb-2">Nuevo Gasto</h3>
          
          {/* INDICADOR DE SALDO EN TIEMPO REAL */}
          <div className="flex gap-4 mb-6">
              <div className="text-xs px-3 py-2 rounded border bg-slate-50 border-slate-200 text-slate-600">
                  Saldo Inicial: <strong>${initialBalanceSafe.toLocaleString()}</strong>
              </div>
              <div className={`text-xs px-3 py-2 rounded border font-bold flex items-center ${currentAvailableBalance > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  <AlertCircle className="w-3 h-3 mr-2"/>
                  Saldo RESTANTE Hoy: ${currentAvailableBalance.toLocaleString()}
              </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                    <input 
                        type="text" 
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                        placeholder="Ej: Reparación bomba de agua" 
                        value={newExpense.description} 
                        onChange={e => setNewExpense({ ...newExpense, description: e.target.value })} 
                    />
                </div>
                <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Monto ($)</label>
                    <div className="relative">
                        <DollarSign className="w-4 h-4 absolute left-2 top-3 text-slate-400" />
                        <input 
                            type="number" 
                            step="0.01" 
                            className="w-full pl-8 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium" 
                            placeholder="0"
                            value={newExpense.amount || ''} 
                            onChange={e => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })} 
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Factura</label>
                    <input 
                        type="date" 
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none" 
                        value={newExpense.date} 
                        onChange={e => setNewExpense({ ...newExpense, date: e.target.value })} 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Rubro / Categoría</label>
                    <select 
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none" 
                        value={newExpense.itemCategory} 
                        onChange={e => setNewExpense({ ...newExpense, itemCategory: e.target.value })}
                    >
                        {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Gasto</label>
                    <select 
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none" 
                        value={newExpense.category} 
                        onChange={e => setNewExpense({ ...newExpense, category: e.target.value as any })}
                    >
                        <option value="Ordinary">Ordinario (Habitual)</option>
                        <option value="Extraordinary">Extraordinario</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Distribución</label>
                    <select 
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none" 
                        value={newExpense.distributionType} 
                        onChange={e => setNewExpense({ ...newExpense, distributionType: e.target.value as any })}
                    >
                        <option value={ExpenseDistributionType.PRORATED}>Por Prorrateo (Coeficiente)</option>
                        <option value={ExpenseDistributionType.EQUAL_PARTS}>Partes Iguales</option>
                        <option value={ExpenseDistributionType.FROM_RESERVE}>Pagar desde Fondo Reserva</option>
                    </select>
                    {newExpense.distributionType === ExpenseDistributionType.FROM_RESERVE && (
                        <p className="text-xs text-slate-500 mt-1">
                            * Se usará el saldo restante ($ {currentAvailableBalance.toLocaleString()})
                        </p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Comprobante (PDF/Foto)</label>
                    {isUploading ? (
                        <div className="w-full h-[42px] px-4 border border-indigo-200 rounded-lg flex items-center bg-indigo-50 text-sm text-indigo-700">
                            <Loader2 className="w-4 h-4 mr-2 animate-spin"/> Subiendo... {uploadProgress}%
                        </div>
                    ) : (
                        <label className={`flex items-center w-full px-3 py-2 border rounded-lg cursor-pointer transition-colors ${newExpense.attachmentUrl ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-300 hover:bg-slate-50 text-slate-500'}`}>
                            {newExpense.attachmentUrl ? (
                                <><CheckCircle className="w-4 h-4 mr-2" /> <span className="truncate flex-1">{newExpense.attachmentUrl.replace('ticket_', '')}</span></>
                            ) : (
                                <><Paperclip className="w-4 h-4 mr-2" /> <span className="flex-1">Adjuntar archivo...</span></>
                            )}
                            <input type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={handleFileChange} />
                        </label>
                    )}
                </div>
            </div>

            <div className="mt-6 flex justify-end pt-4 border-t border-slate-50">
                <button 
                    onClick={handleAdd} 
                    disabled={isUploading} 
                    className={`px-8 py-2.5 rounded-lg text-white font-medium shadow-sm transition-transform active:scale-95 ${isUploading ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                >
                    Guardar Gasto
                </button>
            </div>

          </div>
        </div>
      )}

      {/* LISTADO DE GASTOS */}
      <div className="space-y-6 mt-8">
          {Object.keys(gastosAgrupados).length === 0 && !isFormOpen && (
              <div className="text-center p-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                  <p className="font-medium">No hay gastos registrados este mes.</p>
                  <button onClick={() => setIsFormOpen(true)} className="text-indigo-600 hover:underline mt-2 text-sm">Crear el primero</button>
              </div>
          )}
          
          {Object.keys(gastosAgrupados).sort().map(cat => (
             <div key={cat} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 font-bold text-slate-700 text-sm uppercase flex justify-between items-center">
                     <span className="flex items-center"><Tag className="w-4 h-4 mr-2 text-indigo-500"/> {cat}</span>
                     <span className="bg-white px-2 py-1 rounded border text-xs text-slate-500">{gastosAgrupados[cat].length} ítems</span>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white border-b border-slate-100 text-slate-400 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-3 font-medium">Fecha</th>
                                <th className="px-6 py-3 font-medium">Descripción</th>
                                <th className="px-6 py-3 font-medium">Tipo</th>
                                <th className="px-6 py-3 font-medium text-right">Monto</th>
                                <th className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {gastosAgrupados[cat].map(e => (
                                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-3 text-slate-500 whitespace-nowrap">{new Date(e.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-3 font-medium text-slate-800">{e.description}</td>
                                    <td className="px-6 py-3">
                                        <div className="flex flex-col items-start gap-1">
                                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${e.category === 'Ordinary' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>
                                                {e.category === 'Ordinary' ? 'Ordinario' : 'Extraordinario'}
                                            </span>
                                            {e.distributionType === ExpenseDistributionType.FROM_RESERVE && (
                                                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-50 text-amber-700 border border-amber-100">
                                                    Fondo Reserva
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-right font-bold text-slate-700">${(e.amount || 0).toLocaleString()}</td>
                                    <td className="px-6 py-3 text-right">
                                        <button onClick={() => handleDelete(e.id)} className="p-1 hover:bg-red-50 rounded text-slate-300 hover:text-red-500 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-200">
                            <tr>
                                <td colSpan={3} className="px-6 py-3 text-right font-bold text-xs text-slate-500 uppercase">Subtotal {cat}:</td>
                                <td className="px-6 py-3 text-right font-bold text-indigo-700 text-sm">
                                    ${gastosAgrupados[cat].reduce((a,b)=>a+(b.amount||0),0).toLocaleString()}
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                 </div>
             </div>
          ))}
      </div>
      
      {/* TOTAL GLOBAL */}
      {expenses.length > 0 && (
          <div className="flex justify-end">
              <div className="bg-slate-900 text-white px-8 py-4 rounded-xl shadow-lg flex items-center gap-6">
                  <div className="text-right">
                      <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Total General</p>
                      <p className="text-3xl font-bold">${expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ExpensesView;