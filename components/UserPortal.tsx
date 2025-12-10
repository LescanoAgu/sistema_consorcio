
import React, { useMemo } from 'react';
import { Unit, Expense, SettlementRecord, Payment, ExpenseDistributionType } from '../types';
import { Wallet, CheckCircle, AlertCircle, TrendingUp, Download, Building, Users } from 'lucide-react';

interface UserPortalProps {
  userEmail: string;
  units: Unit[];
  expenses: Expense[]; // Current month expenses
  history: SettlementRecord[];
  payments: Payment[];
}

const UserPortal: React.FC<UserPortalProps> = ({ userEmail, units, expenses, history, payments }) => {
  // 1. Identify User's Unit (Simple mapping by email for demo, or fallback to first unit if not found)
  const myUnit = useMemo(() => {
    return units.find(u => u.linkedEmail === userEmail) || units.find(u => u.ownerName === 'Usuario Demo') || units[0];
  }, [units, userEmail]);

  // 2. Calculate Financial Status for Current User
  const status = useMemo(() => {
    if (!myUnit) return null;
    
    const initial = myUnit.initialBalance || 0;
    
    // Historical Debt
    const totalSettled = history.reduce((acc, record) => {
        const detail = record.unitDetails?.find(d => d.unitId === myUnit.id);
        return acc + (detail ? detail.totalToPay : 0);
    }, 0);

    // Payments
    const totalPaid = payments.filter(p => p.unitId === myUnit.id).reduce((acc, p) => acc + p.amount, 0);
    
    // Current Debt
    const balance = (initial + totalSettled) - totalPaid;

    return { balance, totalPaid, totalSettled };
  }, [myUnit, history, payments]);

  // 3. Calculate All Debtors for Transparency
  const allDebtors = useMemo(() => {
      return units.map(unit => {
        const initial = unit.initialBalance || 0;
        const totalSettled = history.reduce((acc, record) => {
            const detail = record.unitDetails?.find(d => d.unitId === unit.id);
            return acc + (detail ? detail.totalToPay : 0);
        }, 0);
        const totalPaid = payments.filter(p => p.unitId === unit.id).reduce((acc, p) => acc + p.amount, 0);
        
        // Note: For simplicity in User View, we aren't pulling the Adjustment state here, 
        // assuming standard debt. In a real full sync, we'd pass debtAdjustments too.
        const balance = (initial + totalSettled) - totalPaid;

        return { ...unit, balance };
      })
      .filter(u => u.balance > 100) // Only show significant debt
      .sort((a, b) => b.balance - a.balance);
  }, [units, history, payments]);

  // 4. Current Month Projection (Not closed yet)
  const currentProjection = useMemo(() => {
     if (!myUnit) return 0;
     // Simple projection based on prorate
     const totalExpenses = expenses.reduce((acc, e) => e.distributionType !== ExpenseDistributionType.FROM_RESERVE ? acc + e.amount : acc, 0);
     return totalExpenses * (myUnit.proratePercentage / 100);
  }, [myUnit, expenses]);


  if (!myUnit) return <div className="text-center p-10">No se encontró unidad asociada a {userEmail}</div>;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
          <h2 className="text-2xl font-bold mb-1">Hola, {myUnit.ownerName}</h2>
          <p className="opacity-90">Unidad: <strong>{myUnit.unitNumber}</strong> | Prorrateo: {myUnit.proratePercentage}%</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Status Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:col-span-2">
              <h3 className="text-lg font-semibold text-slate-700 mb-6">Estado de Cuenta</h3>
              <div className="flex flex-col md:flex-row gap-8 items-center justify-between">
                  <div className="text-center md:text-left">
                      <p className="text-slate-500 mb-1">Saldo a Pagar</p>
                      <p className={`text-4xl font-bold ${status?.balance && status.balance > 1 ? 'text-red-600' : 'text-emerald-500'}`}>
                          ${status?.balance.toFixed(2) || '0.00'}
                      </p>
                      {status?.balance && status.balance > 1 ? (
                          <div className="mt-2 inline-flex items-center px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                              <AlertCircle className="w-3 h-3 mr-1" /> Vencido / Pendiente
                          </div>
                      ) : (
                          <div className="mt-2 inline-flex items-center px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                              <CheckCircle className="w-3 h-3 mr-1" /> Al día
                          </div>
                      )}
                  </div>
                  
                  <div className="w-full md:w-auto bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <h4 className="text-xs font-bold uppercase text-slate-400 mb-3">Datos de Transferencia</h4>
                      <p className="text-sm text-slate-700 font-medium flex justify-between gap-4">
                          <span>CBU:</span> <span className="font-mono">0123456789012345678901</span>
                      </p>
                      <p className="text-sm text-slate-700 font-medium flex justify-between gap-4 mt-1">
                          <span>Alias:</span> <span className="font-mono">EDIFICIO.NORTE.PAGO</span>
                      </p>
                      <p className="text-sm text-slate-700 font-medium flex justify-between gap-4 mt-1">
                          <span>Banco:</span> <span>Banco Nación</span>
                      </p>
                  </div>
              </div>
          </div>

          {/* Current Month Preview */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                      <TrendingUp className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-slate-700">Mes en Curso</h3>
              </div>
              <p className="text-slate-500 text-sm mb-4">
                  Estimación de tu cuota basada en los gastos cargados hasta hoy.
              </p>
              <div className="flex justify-between items-end border-b border-slate-100 pb-4 mb-4">
                  <span className="text-slate-600">Gastos Totales</span>
                  <span className="font-medium">${expenses.reduce((a,c) => a+c.amount, 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-end">
                  <span className="text-slate-800 font-bold">Tu Parte Estimada</span>
                  <span className="font-bold text-blue-600 text-xl">~${currentProjection.toFixed(2)}</span>
              </div>
              <p className="text-xs text-slate-400 mt-2 text-center">*Esto no es una liquidación final.</p>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Latest Settlements */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-fit">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
                <h3 className="font-semibold text-slate-700">Últimas Liquidaciones Cerradas</h3>
            </div>
            <div className="divide-y divide-slate-100">
                {history.length > 0 ? history.slice(0, 3).map(rec => {
                    const myShare = rec.unitDetails?.find(d => d.unitId === myUnit.id)?.totalToPay || 0;
                    return (
                        <div key={rec.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="bg-indigo-50 p-2 rounded text-indigo-600">
                                    <Building className="w-5 h-5"/>
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800">{rec.month}</p>
                                    <p className="text-xs text-slate-500">Cerrado el {new Date(rec.dateClosed).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <p className="text-xs text-slate-400 uppercase">Tu Cuota</p>
                                    <p className="font-bold text-slate-700">${myShare.toFixed(2)}</p>
                                </div>
                                <button className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-full transition-colors">
                                    <Download className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )
                }) : (
                    <div className="p-8 text-center text-slate-400">
                        No hay liquidaciones cerradas aún.
                    </div>
                )}
            </div>
        </div>

        {/* Debtors List - Public Transparency */}
        <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden h-fit">
             <div className="p-4 bg-red-50 border-b border-red-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-red-600" />
                <h3 className="font-semibold text-red-800">Listado de Morosidad</h3>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs sticky top-0">
                        <tr>
                            <th className="px-4 py-2 font-medium">UF</th>
                            <th className="px-4 py-2 font-medium">Propietario</th>
                            <th className="px-4 py-2 font-medium text-right">Deuda</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {allDebtors.length > 0 ? allDebtors.map(debtor => (
                            <tr key={debtor.id} className={debtor.id === myUnit.id ? "bg-red-50/50" : ""}>
                                <td className="px-4 py-3 font-bold text-slate-700">{debtor.unitNumber}</td>
                                <td className="px-4 py-3 text-slate-600">{debtor.ownerName} {debtor.id === myUnit.id && '(Vos)'}</td>
                                <td className="px-4 py-3 text-right font-bold text-red-600">${debtor.balance.toFixed(2)}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={3} className="p-6 text-center text-slate-400 text-sm">
                                    ¡Excelente! No hay unidades con deuda significativa en el consorcio.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
};

export default UserPortal;
