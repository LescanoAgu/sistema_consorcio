import React, { useState, useMemo } from 'react';
import { Unit, Expense, AppSettings, ExpenseDistributionType, ReserveTransaction, UserRole, Payment, SettlementRecord } from '../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, Users, Wallet, X, Trash2, AlertTriangle, CheckSquare, Square, DollarSign, Wrench, Clock, AlertCircle } from 'lucide-react';
import { clearCollection, deleteUnit } from '../services/firestoreService';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
};

interface DashboardProps {
  units: Unit[];
  expenses: Expense[];
  payments: Payment[];
  history?: SettlementRecord[]; 
  settings: AppSettings;
  reserveHistory?: ReserveTransaction[];
  userRole: UserRole;
  consortiumId: string;
  onDataReset: () => void;
}

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

const Dashboard: React.FC<DashboardProps> = ({ units, expenses, payments, history = [], settings, reserveHistory = [], userRole, consortiumId, onDataReset }) => {
  const [showReserveDetail, setShowReserveDetail] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  
  const [deleteOptions, setDeleteOptions] = useState({ expenses: false, payments: false, history: false });
  const [isDeleting, setIsDeleting] = useState(false);

  // --- CÁLCULOS GENERALES ---
  const totalExpenses = expenses.reduce((acc, curr) => 
    curr.distributionType !== ExpenseDistributionType.FROM_RESERVE ? acc + curr.amount : acc
  , 0);

  const currentMonthISO = new Date().toISOString().slice(0, 7);
  const totalCollected = payments
    .filter(p => p.status === 'APPROVED' && p.date.startsWith(currentMonthISO))
    .reduce((acc, curr) => acc + curr.amount, 0);

  const expensesByCategory = useMemo(() => {
      const grouped = expenses.reduce((acc, curr) => {
          const cat = curr.itemCategory || 'Varios';
          if (!acc[cat]) acc[cat] = 0;
          acc[cat] += curr.amount;
          return acc;
      }, {} as Record<string, number>);

      return Object.keys(grouped).map(key => ({ name: key, value: grouped[key] })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  // --- CÁLCULOS DE DEUDA Y PENDIENTE ---
  const { totalHistoricalDebt, totalPendingMonth } = useMemo(() => {
      let hist = 0;
      let pending = 0;

      const lastSettlement = history && history.length > 0 ? history[0] : null;
      const settlementDate = lastSettlement ? new Date(lastSettlement.dateClosed).getTime() : 0;

      units.forEach(u => {
          hist += (u.initialBalance || 0);
          hist += (u.debts || []).reduce((acc, d) => acc + d.total, 0);

          if (lastSettlement && lastSettlement.unitDetails) {
              const detail = lastSettlement.unitDetails.find(d => d.unitId === u.id);
              if (detail) {
                  const isAlreadyInDebts = (u.debts || []).some(d => d.period === lastSettlement.month);
                  if (!isAlreadyInDebts) {
                      const paidSince = payments
                          .filter(p => p.unitId === u.id && p.status === 'APPROVED' && new Date(p.date).getTime() >= settlementDate)
                          .reduce((sum, p) => sum + p.amount, 0);
                      const owed = detail.totalToPay - paidSince;
                      if (owed > 1) {
                          pending += owed;
                      }
                  }
              }
          }
      });

      return { totalHistoricalDebt: hist, totalPendingMonth: pending };
  }, [units, history, payments]);

  const collectionData = [
      { name: 'Recaudado', Valor: totalCollected },
      { name: 'Pendiente Mes', Valor: totalPendingMonth },
      { name: 'Histórico', Valor: totalHistoricalDebt }
  ];

  // --- HERRAMIENTA: REPARAR DUPLICADOS ---
  const handleFixDuplicates = async () => {
      if (!confirm("⚠️ ¿Escanear y eliminar unidades duplicadas?\n\nEl sistema buscará unidades con el mismo número y dejará solo una. Esta acción no se puede deshacer.")) return;
      
      setIsCleaning(true);
      try {
          const uniqueMap = new Map<string, string>(); 
          const duplicates: string[] = [];

          units.forEach(u => {
              const key = u.unitNumber.trim().toUpperCase();
              if (uniqueMap.has(key)) {
                  duplicates.push(u.id);
              } else {
                  uniqueMap.set(key, u.id);
              }
          });

          if (duplicates.length === 0) {
              alert("¡La base de datos está limpia! No se encontraron duplicados.");
          } else {
              let deletedCount = 0;
              for (const id of duplicates) {
                  await deleteUnit(consortiumId, id);
                  deletedCount++;
              }
              alert(`✅ Limpieza completada.\nSe eliminaron ${deletedCount} unidades duplicadas.`);
              onDataReset(); 
          }
      } catch (e) {
          console.error(e);
          alert("Error durante la limpieza.");
      } finally {
          setIsCleaning(false);
      }
  };

  const handleDelete = async () => {
      if (!deleteOptions.expenses && !deleteOptions.payments && !deleteOptions.history) return alert("Selecciona una opción.");
      if (!confirm("⚠️ ¿ESTÁS SEGURO? Acción irreversible.")) return;

      setIsDeleting(true);
      try {
          if (deleteOptions.expenses) await clearCollection(consortiumId, 'expenses');
          if (deleteOptions.payments) await clearCollection(consortiumId, 'payments');
          if (deleteOptions.history) await clearCollection(consortiumId, 'history');
          
          alert("Datos eliminados correctamente.");
          setShowDeleteModal(false);
          onDataReset();
      } catch (error) {
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
            <div className="flex gap-2">
                <button 
                    onClick={handleFixDuplicates} 
                    disabled={isCleaning}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors text-sm font-bold disabled:opacity-50"
                >
                    <Wrench className={`w-4 h-4 ${isCleaning ? 'animate-spin' : ''}`} /> 
                    {isCleaning ? 'Reparando...' : 'Reparar Duplicados'}
                </button>

                <button onClick={() => setShowDeleteModal(true)} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg border border-red-200 hover:bg-red-100 transition-colors text-sm font-bold">
                    <Trash2 className="w-4 h-4" /> Zona de Peligro
                </button>
            </div>
        )}
      </div>

      {/* METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* ROW 1 */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-xl"><TrendingUp className="w-7 h-7 text-indigo-600" /></div>
            <div>
                <p className="text-slate-500 text-sm font-medium">Gastos del Mes</p>
                <h3 className="text-xl font-bold text-slate-800">{formatCurrency(totalExpenses)}</h3>
            </div>
        </div>
        
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-xl"><DollarSign className="w-7 h-7 text-emerald-600" /></div>
            <div>
                <p className="text-slate-500 text-sm font-medium">Recaudado (Mes)</p>
                <h3 className="text-xl font-bold text-emerald-600">{formatCurrency(totalCollected)}</h3>
            </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-3 bg-amber-50 rounded-xl"><Clock className="w-7 h-7 text-amber-600" /></div>
            <div>
                <p className="text-slate-500 text-sm font-medium">Pendiente Mes</p>
                <h3 className="text-xl font-bold text-amber-600">{formatCurrency(totalPendingMonth)}</h3>
            </div>
        </div>

        {/* ROW 2 */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-3 bg-red-50 rounded-xl"><AlertCircle className="w-7 h-7 text-red-600" /></div>
            <div>
                <p className="text-slate-500 text-sm font-medium">Morosidad Histórica</p>
                <h3 className="text-xl font-bold text-red-600">{formatCurrency(totalHistoricalDebt)}</h3>
            </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 cursor-pointer hover:border-amber-300 transition-colors" onClick={() => setShowReserveDetail(!showReserveDetail)}>
            <div className="p-3 bg-amber-100 rounded-xl"><Wallet className="w-7 h-7 text-amber-700" /></div>
            <div>
                <p className="text-slate-500 text-sm font-medium">Fondo Reserva</p>
                <h3 className="text-xl font-bold text-slate-800">{formatCurrency(settings.reserveFundBalance)}</h3>
            </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-xl"><Users className="w-7 h-7 text-purple-600" /></div>
            <div>
                <p className="text-slate-500 text-sm font-medium">Unidades Activas</p>
                <h3 className="text-xl font-bold text-slate-800">{units.length}</h3>
            </div>
        </div>

      </div>

      {/* GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[300px]">
              <h3 className="font-bold text-slate-700 mb-4">Estado de Cobranzas y Morosidad</h3>
              <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={collectionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{fill: 'transparent'}} />
                          <Bar dataKey="Valor" radius={[4, 4, 0, 0]} barSize={60}>
                              {collectionData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : index === 1 ? '#f59e0b' : '#ef4444'} />
                              ))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[300px]">
              <h3 className="font-bold text-slate-700 mb-4">Distribución de Gastos</h3>
              {expenses.length > 0 ? (
                  <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie data={expensesByCategory} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                  {expensesByCategory.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                              </Pie>
                              <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          </PieChart>
                      </ResponsiveContainer>
                  </div>
              ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">No hay gastos registrados.</div>
              )}
          </div>
      </div>

      {/* MODAL DE BORRADO */}
      {showDeleteModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
                  <div className="bg-red-600 p-4 flex justify-between items-center text-white">
                      <h3 className="font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> ZONA DE PELIGRO</h3>
                      <button onClick={() => setShowDeleteModal(false)}><X className="w-5 h-5 hover:opacity-80"/></button>
                  </div>
                  <div className="p-6">
                      <p className="text-slate-600 mb-4 text-sm">Selecciona qué datos deseas eliminar permanentemente.</p>
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
                          <button onClick={handleDelete} disabled={isDeleting} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow disabled:opacity-50">{isDeleting ? 'Borrando...' : 'ELIMINAR'}</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;