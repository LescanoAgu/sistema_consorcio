import React, { useState, useMemo } from 'react';
import { Unit, Expense, AppSettings, ExpenseDistributionType, ReserveTransaction, UserRole, Payment } from '../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, Users, Wallet, X, ArrowDownRight, ArrowUpRight, History, Trash2, AlertTriangle, CheckSquare, Square, DollarSign } from 'lucide-react';
import { clearCollection } from '../services/firestoreService';

interface DashboardProps {
  units: Unit[];
  expenses: Expense[];
  payments: Payment[]; // <--- NUEVA PROP para calcular recaudación
  settings: AppSettings;
  reserveHistory?: ReserveTransaction[];
  userRole: UserRole;
  consortiumId: string;
  onDataReset: () => void;
}

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

const Dashboard: React.FC<DashboardProps> = ({ units, expenses, payments, settings, reserveHistory = [], userRole, consortiumId, onDataReset }) => {
  const [showReserveDetail, setShowReserveDetail] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Estado para las opciones de borrado
  const [deleteOptions, setDeleteOptions] = useState({ expenses: false, payments: false, history: false, debtors: false });
  const [isDeleting, setIsDeleting] = useState(false);

  // --- CÁLCULOS PARA GRÁFICOS ---
  const totalExpenses = expenses.reduce((acc, curr) => 
    curr.distributionType !== ExpenseDistributionType.FROM_RESERVE ? acc + curr.amount : acc
  , 0);

  const currentMonthISO = new Date().toISOString().slice(0, 7); // "2023-10"
  const totalCollected = payments
    .filter(p => p.status === 'APPROVED' && p.date.startsWith(currentMonthISO))
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Datos para Gráfico de Torta (Gastos por Rubro)
  const expensesByCategory = useMemo(() => {
      const grouped = expenses.reduce((acc, curr) => {
          const cat = curr.itemCategory || 'Varios';
          if (!acc[cat]) acc[cat] = 0;
          acc[cat] += curr.amount;
          return acc;
      }, {} as Record<string, number>);

      return Object.keys(grouped).map(key => ({
          name: key,
          value: grouped[key]
      })).sort((a, b) => b.value - a.value); // Ordenar mayor a menor
  }, [expenses]);

  // Datos para Gráfico de Barras (Balance del Mes)
  const balanceData = [
      { name: 'Balance Mensual', Gastos: totalExpenses, Recaudado: totalCollected }
  ];

  // --- LÓGICA DE BORRADO ---
  const handleDelete = async () => {
      if (!deleteOptions.expenses && !deleteOptions.payments && !deleteOptions.history && !deleteOptions.debtors) return alert("Selecciona una opción.");
      if (!confirm("⚠️ ¿ESTÁS SEGURO? Acción irreversible.")) return;

      setIsDeleting(true);
      try {
          if (deleteOptions.expenses) await clearCollection(consortiumId, 'expenses');
          if (deleteOptions.payments) await clearCollection(consortiumId, 'payments');
          if (deleteOptions.history) await clearCollection(consortiumId, 'history');
          // if (deleteOptions.debtors) await clearCollection(consortiumId, 'debt_adjustments');
          
          alert("Limpieza completada.");
          setShowDeleteModal(false);
          setDeleteOptions({ expenses: false, payments: false, history: false, debtors: false });
          onDataReset();
      } catch (error) {
          console.error(error);
          alert("Error al eliminar datos.");
      } finally {
          setIsDeleting(false);
      }
  };

  const toggleOption = (key: keyof typeof deleteOptions) => {
      setDeleteOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Panel General</h2>
           <p className="text-slate-500 text-sm">Resumen financiero y estado del consorcio</p>
        </div>
        
        {userRole === 'ADMIN' && (
            <button onClick={() => setShowDeleteModal(true)} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg border border-red-200 hover:bg-red-100 transition-colors text-sm font-bold">
                <Trash2 className="w-4 h-4" /> Herramientas de Limpieza
            </button>
        )}
      </div>

      {/* METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-indigo-50 rounded-lg"><TrendingUp className="w-6 h-6 text-indigo-600" /></div>
            </div>
            <p className="text-slate-500 text-sm">Gastos del Mes</p>
            <h3 className="text-2xl font-bold text-slate-800">${totalExpenses.toFixed(2)}</h3>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-emerald-50 rounded-lg"><DollarSign className="w-6 h-6 text-emerald-600" /></div>
            </div>
            <p className="text-slate-500 text-sm">Recaudado (Mes)</p>
            <h3 className="text-2xl font-bold text-emerald-600">${totalCollected.toFixed(2)}</h3>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-purple-50 rounded-lg"><Users className="w-6 h-6 text-purple-600" /></div>
            </div>
            <p className="text-slate-500 text-sm">Unidades</p>
            <h3 className="text-2xl font-bold text-slate-800">{units.length}</h3>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-emerald-300 transition-colors" onClick={() => setShowReserveDetail(!showReserveDetail)}>
             <div className="flex justify-between items-start">
                <div>
                     <div className="flex items-center gap-2 mb-1">
                        <div className="p-2 bg-amber-50 rounded-lg"><Wallet className="w-6 h-6 text-amber-600" /></div>
                     </div>
                     <p className="text-slate-500 text-sm mt-3">Fondo Reserva</p>
                     <p className="text-2xl font-bold text-slate-800">${settings.reserveFundBalance.toFixed(2)}</p>
                </div>
            </div>
        </div>
      </div>

      {/* GRÁFICOS (NUEVO) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Gráfico 1: Distribución de Gastos */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[300px]">
              <h3 className="font-bold text-slate-700 mb-4">Distribución de Gastos</h3>
              {expenses.length > 0 ? (
                  <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie
                                  data={expensesByCategory}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={80}
                                  paddingAngle={5}
                                  dataKey="value"
                              >
                                  {expensesByCategory.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                              </Pie>
                              <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                              <Legend />
                          </PieChart>
                      </ResponsiveContainer>
                  </div>
              ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                      No hay gastos registrados para graficar.
                  </div>
              )}
          </div>

          {/* Gráfico 2: Balance Gastos vs Recaudación */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[300px]">
              <h3 className="font-bold text-slate-700 mb-4">Balance Financiero (Mes Actual)</h3>
              <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={balanceData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                          <Legend />
                          <Bar dataKey="Gastos" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={50} />
                          <Bar dataKey="Recaudado" fill="#10b981" radius={[4, 4, 0, 0]} barSize={50} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>
      </div>

      {/* MODAL DE BORRADO (ZONA DE PELIGRO) */}
      {showDeleteModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
                  <div className="bg-red-600 p-4 flex justify-between items-center text-white">
                      <h3 className="font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> ZONA DE PELIGRO</h3>
                      <button onClick={() => setShowDeleteModal(false)}><X className="w-5 h-5 hover:opacity-80"/></button>
                  </div>
                  <div className="p-6">
                      <p className="text-slate-600 mb-4 text-sm">
                          Selecciona qué datos deseas eliminar permanentemente. <strong>Irreversible.</strong>
                      </p>
                      
                      <div className="space-y-3 mb-6">
                          <div onClick={() => toggleOption('expenses')} className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer ${deleteOptions.expenses ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                              {deleteOptions.expenses ? <CheckSquare className="w-5 h-5 text-red-600"/> : <Square className="w-5 h-5 text-slate-400"/>}
                              <div><p className="font-bold text-slate-700">Gastos Activos</p></div>
                          </div>
                          <div onClick={() => toggleOption('payments')} className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer ${deleteOptions.payments ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                              {deleteOptions.payments ? <CheckSquare className="w-5 h-5 text-red-600"/> : <Square className="w-5 h-5 text-slate-400"/>}
                              <div><p className="font-bold text-slate-700">Historial de Pagos</p></div>
                          </div>
                          <div onClick={() => toggleOption('history')} className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer ${deleteOptions.history ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                              {deleteOptions.history ? <CheckSquare className="w-5 h-5 text-red-600"/> : <Square className="w-5 h-5 text-slate-400"/>}
                              <div><p className="font-bold text-slate-700">Historial Liquidaciones</p></div>
                          </div>
                      </div>

                      <div className="flex gap-3">
                          <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-lg">Cancelar</button>
                          <button onClick={handleDelete} disabled={isDeleting} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow disabled:opacity-50">
                              {isDeleting ? 'Borrando...' : 'ELIMINAR'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* RESERVE DETAIL */}
      {showReserveDetail && (
          <div className="bg-white rounded-xl shadow-sm border border-emerald-100 overflow-hidden animate-fade-in">
              <div className="bg-emerald-50/50 p-4 border-b border-emerald-100">
                  <h4 className="font-bold text-emerald-800 flex items-center gap-2"><History className="w-4 h-4"/> Historial del Fondo</h4>
              </div>
              <div className="p-4 text-center text-slate-400">
                  {reserveHistory.length > 0 ? <p>Tabla de historial...</p> : <p>No hay movimientos registrados.</p>}
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;