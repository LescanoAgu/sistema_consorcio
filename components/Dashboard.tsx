
import React, { useState } from 'react';
import { Unit, Expense, AppSettings, ExpenseDistributionType, ReserveTransaction } from '../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, Users, Wallet, X, ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface DashboardProps {
  units: Unit[];
  expenses: Expense[];
  settings: AppSettings;
  reserveHistory?: ReserveTransaction[];
}

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b'];

const Dashboard: React.FC<DashboardProps> = ({ units, expenses, settings, reserveHistory = [] }) => {
  const [showReserveDetail, setShowReserveDetail] = useState(false);

  const totalExpenses = expenses.reduce((acc, curr) => 
    curr.distributionType !== ExpenseDistributionType.FROM_RESERVE ? acc + curr.amount : acc
  , 0);

  const expensesByType = [
    { name: 'Ordinarios', value: expenses.filter(e => e.category === 'Ordinary' && e.distributionType !== ExpenseDistributionType.FROM_RESERVE).reduce((a, b) => a + b.amount, 0) },
    { name: 'Extraordinarios', value: expenses.filter(e => e.category === 'Extraordinary' && e.distributionType !== ExpenseDistributionType.FROM_RESERVE).reduce((a, b) => a + b.amount, 0) },
    { name: 'Fondo Reserva (Gasto)', value: expenses.filter(e => e.distributionType === ExpenseDistributionType.FROM_RESERVE).reduce((a, b) => a + b.amount, 0) },
  ].filter(d => d.value > 0);

  const historicalData = [
    { name: 'Mes Ant.', gastos: totalExpenses * 0.9, fondo: settings.reserveFundBalance * 0.95 },
    { name: 'Actual', gastos: totalExpenses, fondo: settings.reserveFundBalance },
  ];

  return (
    <div className="space-y-6 relative">
      <h2 className="text-2xl font-bold text-slate-800">Panel de Control</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
            <div className="p-3 bg-indigo-100 rounded-full mr-4 text-indigo-600">
                <TrendingUp className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm text-slate-500 font-medium">Gastos del Mes</p>
                <p className="text-2xl font-bold text-slate-900">${totalExpenses.toFixed(2)}</p>
            </div>
        </div>

        {/* Reserve Fund Widget - Clickable */}
        <div 
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center cursor-pointer hover:border-emerald-300 transition-colors group"
            onClick={() => setShowReserveDetail(true)}
        >
            <div className="p-3 bg-emerald-100 rounded-full mr-4 text-emerald-600 group-hover:bg-emerald-200">
                <Wallet className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm text-slate-500 font-medium group-hover:text-emerald-600">Fondo Reserva</p>
                <p className="text-2xl font-bold text-slate-900">${settings.reserveFundBalance.toFixed(2)}</p>
                <p className="text-[10px] text-slate-400">Ver detalle</p>
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
            <div className="p-3 bg-blue-100 rounded-full mr-4 text-blue-600">
                <Users className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm text-slate-500 font-medium">Unidades</p>
                <p className="text-2xl font-bold text-slate-900">{units.length}</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-80">
            <h3 className="text-lg font-semibold mb-4 text-slate-700">Distribución de Gastos</h3>
            {expensesByType.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={expensesByType}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {expensesByType.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                    <Legend />
                </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                    Sin datos de gastos
                </div>
            )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-80">
            <h3 className="text-lg font-semibold mb-4 text-slate-700">Evolución Financiera</h3>
             <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={historicalData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                    <Legend />
                    <Bar dataKey="gastos" name="Gastos" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="fondo" name="Fondo Reserva" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* Reserve Fund Modal */}
      {showReserveDetail && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-fade-in">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                      <div>
                          <h3 className="text-xl font-bold text-slate-800">Detalle Fondo de Reserva</h3>
                          <p className="text-slate-500 text-sm">Historial de movimientos y saldo</p>
                      </div>
                      <button onClick={() => setShowReserveDetail(false)} className="text-slate-400 hover:text-red-500">
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  <div className="p-0 overflow-y-auto flex-1">
                      {reserveHistory.length > 0 ? (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Fecha</th>
                                    <th className="px-6 py-3 font-medium">Descripción</th>
                                    <th className="px-6 py-3 font-medium text-right">Monto</th>
                                    <th className="px-6 py-3 font-medium text-right">Saldo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {reserveHistory.map(t => (
                                    <tr key={t.id}>
                                        <td className="px-6 py-3 text-slate-500">{t.date}</td>
                                        <td className="px-6 py-3 text-slate-800">{t.description}</td>
                                        <td className={`px-6 py-3 text-right font-bold ${t.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
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
                  <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                       <div className="flex justify-between items-center">
                           <span className="font-semibold text-slate-600">Saldo Actual</span>
                           <span className="text-2xl font-bold text-emerald-600">${settings.reserveFundBalance.toFixed(2)}</span>
                       </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default Dashboard;
