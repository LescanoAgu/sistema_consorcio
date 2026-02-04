import React, { useState } from 'react';
import { Unit, Expense, AppSettings, ExpenseDistributionType, ReserveTransaction, UserRole } from '../types';
import { TrendingUp, Users, Wallet, X, ArrowDownRight, ArrowUpRight, History, Trash2, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import { clearCollection } from '../services/firestoreService';

interface DashboardProps {
  units: Unit[];
  expenses: Expense[];
  settings: AppSettings;
  reserveHistory?: ReserveTransaction[];
  userRole: UserRole; // <--- Nuevo Prop
  consortiumId: string; // <--- Nuevo Prop
  onDataReset: () => void; // <--- Nuevo Callback
}

const Dashboard: React.FC<DashboardProps> = ({ units, expenses, settings, reserveHistory = [], userRole, consortiumId, onDataReset }) => {
  const [showReserveDetail, setShowReserveDetail] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Estado para las opciones de borrado
  const [deleteOptions, setDeleteOptions] = useState({
      expenses: false,
      payments: false,
      history: false,
      debtors: false
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const totalExpenses = expenses.reduce((acc, curr) => 
    curr.distributionType !== ExpenseDistributionType.FROM_RESERVE ? acc + curr.amount : acc
  , 0);

  const handleDelete = async () => {
      if (!deleteOptions.expenses && !deleteOptions.payments && !deleteOptions.history && !deleteOptions.debtors) {
          return alert("Selecciona al menos una opción para borrar.");
      }
      
      if (!confirm("⚠️ ¿ESTÁS SEGURO? \n\nEsta acción eliminará permanentemente los datos seleccionados de la base de datos. No se puede deshacer.")) {
          return;
      }

      setIsDeleting(true);
      try {
          if (deleteOptions.expenses) await clearCollection(consortiumId, 'expenses');
          if (deleteOptions.payments) await clearCollection(consortiumId, 'payments');
          if (deleteOptions.history) await clearCollection(consortiumId, 'history');
          // Agregar 'debtors' si existiera colección separada
          
          alert("Datos eliminados correctamente.");
          setShowDeleteModal(false);
          setDeleteOptions({ expenses: false, payments: false, history: false, debtors: false });
          onDataReset(); // Recargar la app para ver los cambios
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
           <p className="text-slate-500 text-sm">Resumen del estado del consorcio</p>
        </div>
        
        {/* BOTÓN DE ADMIN PARA BORRAR DATOS */}
        {userRole === 'ADMIN' && (
            <button 
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg border border-red-200 hover:bg-red-100 transition-colors text-sm font-bold"
            >
                <Trash2 className="w-4 h-4" />
                Herramientas de Limpieza
            </button>
        )}
      </div>

      {/* MODAL DE BORRADO - ZONA DE PELIGRO */}
      {showDeleteModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
                  <div className="bg-red-600 p-4 flex justify-between items-center text-white">
                      <h3 className="font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> ZONA DE PELIGRO</h3>
                      <button onClick={() => setShowDeleteModal(false)}><X className="w-5 h-5 hover:opacity-80"/></button>
                  </div>
                  <div className="p-6">
                      <p className="text-slate-600 mb-4 text-sm">
                          Selecciona qué datos deseas eliminar permanentemente de la base de datos. <br/>
                          <strong>Esta acción es irreversible.</strong>
                      </p>
                      
                      <div className="space-y-3 mb-6">
                          <div 
                            onClick={() => toggleOption('expenses')}
                            className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer transition-colors ${deleteOptions.expenses ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                          >
                              {deleteOptions.expenses ? <CheckSquare className="w-5 h-5 text-red-600"/> : <Square className="w-5 h-5 text-slate-400"/>}
                              <div>
                                  <p className="font-bold text-slate-700">Gastos Activos</p>
                                  <p className="text-xs text-slate-500">Elimina gastos cargados aún no liquidados.</p>
                              </div>
                          </div>

                          <div 
                            onClick={() => toggleOption('payments')}
                            className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer transition-colors ${deleteOptions.payments ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                          >
                              {deleteOptions.payments ? <CheckSquare className="w-5 h-5 text-red-600"/> : <Square className="w-5 h-5 text-slate-400"/>}
                              <div>
                                  <p className="font-bold text-slate-700">Historial de Pagos</p>
                                  <p className="text-xs text-slate-500">Elimina registros de cobros recibidos.</p>
                              </div>
                          </div>

                          <div 
                            onClick={() => toggleOption('history')}
                            className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer transition-colors ${deleteOptions.history ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                          >
                              {deleteOptions.history ? <CheckSquare className="w-5 h-5 text-red-600"/> : <Square className="w-5 h-5 text-slate-400"/>}
                              <div>
                                  <p className="font-bold text-slate-700">Historial de Liquidaciones</p>
                                  <p className="text-xs text-slate-500">Elimina las expensas cerradas de meses anteriores.</p>
                              </div>
                          </div>
                      </div>

                      <div className="flex gap-3">
                          <button 
                            onClick={() => setShowDeleteModal(false)}
                            className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-lg"
                          >
                              Cancelar
                          </button>
                          <button 
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="flex-1 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow disabled:opacity-50"
                          >
                              {isDeleting ? 'Borrando...' : 'ELIMINAR SELECCIÓN'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

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
                <div className="p-2 bg-purple-50 rounded-lg"><Users className="w-6 h-6 text-purple-600" /></div>
            </div>
            <p className="text-slate-500 text-sm">Unidades</p>
            <h3 className="text-2xl font-bold text-slate-800">{units.length}</h3>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2 relative overflow-hidden">
             <div className="flex justify-between items-start z-10 relative">
                <div>
                     <div className="flex items-center gap-2 mb-1">
                        <div className="p-2 bg-emerald-50 rounded-lg"><Wallet className="w-6 h-6 text-emerald-600" /></div>
                        <h3 className="font-bold text-slate-700">Fondo de Reserva</h3>
                     </div>
                     <p className="text-3xl font-bold text-emerald-700 mt-2">${settings.reserveFundBalance.toFixed(2)}</p>
                </div>
                <button onClick={() => setShowReserveDetail(!showReserveDetail)} className="text-emerald-600 text-sm font-medium hover:underline">
                    {showReserveDetail ? 'Ocultar' : 'Ver Movimientos'}
                </button>
            </div>
        </div>
      </div>

      {/* RESERVE DETAIL (EXPANDABLE) */}
      {showReserveDetail && (
          <div className="bg-white rounded-xl shadow-sm border border-emerald-100 overflow-hidden animate-fade-in">
              <div className="bg-emerald-50/50 p-4 border-b border-emerald-100">
                  <h4 className="font-bold text-emerald-800 flex items-center gap-2">
                      <History className="w-4 h-4"/> Historial del Fondo
                  </h4>
              </div>
              <div className="max-h-60 overflow-y-auto">
                  <div className="p-4">
                      {reserveHistory.length > 0 ? (
                        <table className="w-full text-sm">
                            <thead className="text-slate-500 border-b border-slate-100">
                                <tr>
                                    <th className="text-left py-2">Fecha</th>
                                    <th className="text-left py-2">Concepto</th>
                                    <th className="text-right py-2">Monto</th>
                                    <th className="text-right py-2">Saldo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reserveHistory.map(t => (
                                    <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                                        <td className="py-3 text-slate-600">{t.date}</td>
                                        <td className="py-3 font-medium text-slate-700">{t.description}</td>
                                        <td className={`py-3 text-right font-bold ${t.amount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            <div className="flex items-center justify-end gap-1">
                                                {t.amount > 0 ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownRight className="w-3 h-3"/>}
                                                {t.amount > 0 ? '+' : ''}{t.amount.toFixed(2)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-right text-slate-600 bg-slate-50/50">
                                            ${t.balanceAfter.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                      ) : (
                          <div className="p-10 text-center text-slate-400">
                              <Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" />
                              <p>No hay movimientos registrados aún.</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default Dashboard;