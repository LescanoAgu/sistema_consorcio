import React, { useMemo, useState, useEffect } from 'react';
import { Unit, Expense, ExpenseDistributionType, SettlementRecord, ConsortiumSettings } from '../types';
import { Archive, AlertCircle, Save, MessageSquare, Edit2, Calendar } from 'lucide-react';
import { updateExpense } from '../services/firestoreService';

interface SettlementViewProps {
  units: Unit[];
  expenses: Expense[];
  settings: ConsortiumSettings;
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  consortiumId: string;
  updateReserveBalance: (newBalance: number) => void;
  onCloseMonth: (record: SettlementRecord) => void;
}

const SettlementView: React.FC<SettlementViewProps> = ({ units, expenses, settings, setExpenses, consortiumId, updateReserveBalance, onCloseMonth }) => {
  const [couponMessage, setCouponMessage] = useState('');
  
  // Vencimientos automáticos (Mes siguiente)
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 10);
  const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 20);
  
  const [firstDate, setFirstDate] = useState(nextMonth.toISOString().split('T')[0]);
  const [secondDate, setSecondDate] = useState(nextMonthEnd.toISOString().split('T')[0]);
  const [surcharge, setSurcharge] = useState(5);

  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [editDesc, setEditDesc] = useState('');

  const [isEditingReserve, setIsEditingReserve] = useState(false);
  const [manualReserveBalance, setManualReserveBalance] = useState(settings.reserveFundBalance || 0);

  useEffect(() => {
    if(!isEditingReserve) setManualReserveBalance(settings.reserveFundBalance || 0);
  }, [settings.reserveFundBalance, isEditingReserve]);

  const totalPercentage = units.reduce((acc, u) => acc + (u.proratePercentage || 0), 0);
  const isPercentageValid = Math.abs(totalPercentage - 100) < 0.1;

  const startEditing = (exp: Expense) => {
      setEditingExpenseId(exp.id);
      setEditValue(exp.amount);
      setEditDesc(exp.description);
  };

  const saveEditing = async () => {
      if (!editingExpenseId) return;
      const updatedExpense = expenses.find(e => e.id === editingExpenseId);
      if (updatedExpense) {
          const newExp = { ...updatedExpense, amount: editValue, description: editDesc };
          await updateExpense(consortiumId, newExp);
          setExpenses(prev => prev.map(e => e.id === editingExpenseId ? newExp : e));
      }
      setEditingExpenseId(null);
  };

  const saveManualReserve = () => {
      updateReserveBalance(manualReserveBalance);
      setIsEditingReserve(false);
  };

  const { totalOrdinary, totalExtraordinary, totalFromReserve, expensesProrated, expensesEqual } = useMemo(() => {
    let ord = 0, extra = 0, reserve = 0;
    const prorated: Expense[] = [];
    const equal: Expense[] = [];

    expenses.forEach(e => {
      const amount = e.amount || 0; 
      if (e.distributionType === ExpenseDistributionType.FROM_RESERVE) {
        reserve += amount; 
      } else {
        if (e.category === 'Ordinary') ord += amount;
        else extra += amount;

        if (e.distributionType === ExpenseDistributionType.PRORATED) prorated.push(e);
        else if (e.distributionType === ExpenseDistributionType.EQUAL_PARTS) equal.push(e);
      }
    });

    return { totalOrdinary: ord, totalExtraordinary: extra, totalFromReserve: reserve, expensesProrated: prorated, expensesEqual: equal };
  }, [expenses]);

  const projectedReserveBalance = manualReserveBalance - totalFromReserve;
  const reserveDeficit = projectedReserveBalance < 0 ? Math.abs(projectedReserveBalance) : 0;
  const finalBalanceInBox = projectedReserveBalance < 0 ? 0 : projectedReserveBalance;
  const monthlyReserveContributionAmount = (totalOrdinary * (settings.monthlyReserveContributionPercentage || 0)) / 100;

  const settlementData = useMemo(() => {
    return units.map(unit => {
      const percentage = unit.proratePercentage || 0;
      const proratedShare = expensesProrated.reduce((acc, exp) => acc + (exp.amount || 0), 0) * (percentage / 100);
      const equalShare = expensesEqual.reduce((acc, exp) => acc + (exp.amount || 0), 0) / (units.length || 1);
      const reserveContributionShare = monthlyReserveContributionAmount * (percentage / 100);
      const deficitShare = reserveDeficit * (percentage / 100);

      return {
        ...unit,
        totalToPay: proratedShare + equalShare + reserveContributionShare + deficitShare,
      };
    });
  }, [units, expensesProrated, expensesEqual, monthlyReserveContributionAmount, reserveDeficit]);

  const totalToCollect = settlementData.reduce((acc, curr) => acc + curr.totalToPay, 0);

  const handleConfirmSettlement = () => {
      if(!isPercentageValid) return alert(`Error: Porcentajes suman ${totalPercentage.toFixed(2)}%`);
      if(editingExpenseId) return alert("Termina de editar el gasto pendiente.");

      if(confirm("¿Cerrar liquidación?")) {
          const record: SettlementRecord = {
              id: crypto.randomUUID(),
              month: new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' }),
              dateClosed: new Date().toISOString(),
              totalExpenses: totalOrdinary + totalExtraordinary + totalFromReserve,
              totalCollected: totalToCollect,
              
              reserveBalanceStart: manualReserveBalance,
              reserveExpense: totalFromReserve,
              reserveBalanceAtClose: finalBalanceInBox, 
              reserveContribution: monthlyReserveContributionAmount,
              reserveDeficitCovered: reserveDeficit,
              
              firstExpirationDate: firstDate,
              secondExpirationDate: secondDate,
              secondExpirationSurcharge: surcharge,

              snapshotExpenses: [...expenses],
              aiReportSummary: "Resumen IA desactivado.",
              couponMessage: couponMessage, 
              unitDetails: settlementData.map(d => ({ unitId: d.id, totalToPay: d.totalToPay }))
          };
          onCloseMonth(record);
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h2 className="text-2xl font-bold text-slate-800">Liquidación</h2><p className="text-slate-500 text-sm">Configure vencimientos y cierre el mes.</p></div>
        <button onClick={handleConfirmSettlement} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-bold shadow-lg flex items-center transition-all"><Archive className="w-5 h-5 mr-2"/> Liquidar Mes</button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center"><Calendar className="w-4 h-4 mr-2"/> Vencimientos</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-xs font-medium text-slate-500 uppercase mb-1">1º Vto</label><input type="date" className="w-full p-2 border rounded" value={firstDate} onChange={e => setFirstDate(e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-slate-500 uppercase mb-1">2º Vto</label><input type="date" className="w-full p-2 border rounded" value={secondDate} onChange={e => setSecondDate(e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-slate-500 uppercase mb-1">Recargo 2º Vto (%)</label><input type="number" className="w-full p-2 border rounded" value={surcharge} onChange={e => setSurcharge(parseFloat(e.target.value))} /></div>
          </div>
      </div>

      <div className={`p-6 rounded-xl border shadow-sm ${reserveDeficit > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'}`}>
         <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-700 flex items-center gap-2"><AlertCircle className="w-5 h-5"/> Fondo de Reserva</h3>
             <div className="flex items-center gap-2"><span className="text-sm text-slate-500">Inicial:</span>
                 {isEditingReserve ? (<div className="flex items-center"><input type="number" className="w-24 p-1 border rounded text-right font-bold" value={manualReserveBalance} onChange={e => setManualReserveBalance(parseFloat(e.target.value))}/><button onClick={saveManualReserve} className="ml-2 text-green-600"><Save className="w-4 h-4"/></button></div>) : (<div className="flex items-center"><span className="font-bold text-lg">${manualReserveBalance.toLocaleString()}</span><button onClick={() => setIsEditingReserve(true)} className="ml-2 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4"/></button></div>)}
             </div>
         </div>
         <div className="flex items-center justify-between text-sm">
             <div><p className="text-slate-500">Gastos a cubrir</p><p className="text-xl font-bold text-red-600">-${totalFromReserve.toLocaleString()}</p></div>
             <div className="text-right"><p className="text-slate-500">{reserveDeficit > 0 ? 'Déficit (Se cobra)' : 'Saldo Final'}</p><p className={`text-2xl font-bold ${reserveDeficit > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{reserveDeficit > 0 ? `-$${reserveDeficit.toLocaleString()}` : `$${projectedReserveBalance.toLocaleString()}`}</p></div>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b font-bold text-slate-700 text-sm">Gastos Cargados</div>
          <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-slate-50 border-b"><tr><th className="px-4 py-2">Desc.</th><th className="px-4 py-2 text-right">Monto</th><th className="px-4 py-2 text-center">Acción</th></tr></thead>
              <tbody>
                  {expenses.map(e => (
                      <tr key={e.id} className={editingExpenseId === e.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}>
                          <td className="px-4 py-3">{editingExpenseId === e.id ? <input className="w-full p-1 border rounded" value={editDesc} onChange={ev => setEditDesc(ev.target.value)} /> : e.description}</td>
                          <td className="px-4 py-3 text-right font-bold">{editingExpenseId === e.id ? <input type="number" className="w-24 p-1 border rounded text-right" value={editValue} onChange={ev => setEditValue(parseFloat(ev.target.value))} /> : `$${e.amount.toLocaleString()}`}</td>
                          <td className="px-4 py-3 text-center">{editingExpenseId === e.id ? <button onClick={saveEditing}><Save className="w-4 h-4 text-green-600"/></button> : <button onClick={() => startEditing(e)}><Edit2 className="w-4 h-4 text-slate-400 hover:text-indigo-600"/></button>}</td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200">
          <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center"><MessageSquare className="w-4 h-4 mr-2"/> Nota en Cupones</label>
          <textarea className="w-full p-3 border rounded-lg text-sm" rows={2} placeholder="Ej: Se recuerda la asamblea..." value={couponMessage} onChange={e => setCouponMessage(e.target.value)}></textarea>
      </div>
    </div>
  );
};

export default SettlementView;