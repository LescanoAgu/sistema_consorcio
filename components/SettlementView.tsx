import React, { useMemo, useState, useEffect } from 'react';
import { Unit, Expense, ExpenseDistributionType, SettlementRecord, ConsortiumSettings } from '../types';
import { Archive, AlertCircle, Save, MessageSquare, Edit2, Calendar, CreditCard, Eye, FileText, User } from 'lucide-react';
import { updateExpense } from '../services/firestoreService';
import { generateSettlementPDF, generateIndividualCouponPDF } from '../services/pdfService';

interface SettlementViewProps {
  units: Unit[];
  expenses: Expense[];
  settings: ConsortiumSettings;
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  consortiumId: string;
  consortiumName: string; // ✅ Nombre para el PDF
  updateReserveBalance: (newBalance: number) => void;
  onUpdateBankSettings: (settings: Partial<ConsortiumSettings>) => void;
  onCloseMonth: (record: SettlementRecord) => void;
}

const SettlementView: React.FC<SettlementViewProps> = ({ units, expenses, settings, setExpenses, consortiumId, consortiumName, updateReserveBalance, onUpdateBankSettings, onCloseMonth }) => {
  const [couponMessage, setCouponMessage] = useState('');
  
  // Estado para previsualización
  const [previewUnitId, setPreviewUnitId] = useState<string>('');

  // Vencimientos
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 10);
  const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 20);
  const [firstDate, setFirstDate] = useState(nextMonth.toISOString().split('T')[0]);
  const [secondDate, setSecondDate] = useState(nextMonthEnd.toISOString().split('T')[0]);
  const [surcharge, setSurcharge] = useState(5);

  // Edición Gastos
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [editDesc, setEditDesc] = useState('');
  const [editCat, setEditCat] = useState<'Ordinary' | 'Extraordinary'>('Ordinary');

  // Edición Fondo
  const [isEditingReserve, setIsEditingReserve] = useState(false);
  const [manualReserveBalance, setManualReserveBalance] = useState(settings.reserveFundBalance || 0);

  // Modal Banco
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankForm, setBankForm] = useState({
      bankName: settings.bankName, bankCBU: settings.bankCBU, bankAlias: settings.bankAlias, bankHolder: settings.bankHolder
  });

  useEffect(() => {
    if(!isEditingReserve) setManualReserveBalance(settings.reserveFundBalance || 0);
  }, [settings.reserveFundBalance, isEditingReserve]);

  const totalPercentage = units.reduce((acc, u) => acc + (u.proratePercentage || 0), 0);
  const isPercentageValid = Math.abs(totalPercentage - 100) < 0.1;

  // --- LOGICA DE EDICIÓN ---
  const startEditing = (exp: Expense) => {
      setEditingExpenseId(exp.id);
      setEditValue(exp.amount);
      setEditDesc(exp.description);
      setEditCat(exp.category);
  };

  const saveEditing = async () => {
      if (!editingExpenseId) return;
      const updatedExpense = expenses.find(e => e.id === editingExpenseId);
      if (updatedExpense) {
          const newExp = { 
              ...updatedExpense, 
              amount: editValue, 
              description: editDesc, 
              category: editCat 
          };
          await updateExpense(consortiumId, newExp);
          setExpenses(prev => prev.map(e => e.id === editingExpenseId ? newExp : e));
      }
      setEditingExpenseId(null);
  };

  const saveBank = () => { onUpdateBankSettings(bankForm); setShowBankModal(false); };
  const saveManualReserve = () => { updateReserveBalance(manualReserveBalance); setIsEditingReserve(false); };

  // --- CÁLCULOS ---
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

  // --- GENERACIÓN DE RECORD PROVISORIO ---
  const getTempRecord = (): SettlementRecord => {
      return {
          id: 'temp-preview',
          month: new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' }) + " (PROVISORIO)",
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
          aiReportSummary: "Previsualización.",
          couponMessage: couponMessage, 
          unitDetails: settlementData.map(d => ({ unitId: d.id, totalToPay: d.totalToPay }))
      };
  };

  const handlePreviewGeneral = () => {
      generateSettlementPDF(getTempRecord(), consortiumName, units, settings);
  };

  const handlePreviewIndividual = () => {
      if (!previewUnitId) return alert("Seleccione una unidad.");
      generateIndividualCouponPDF(getTempRecord(), previewUnitId, consortiumName, units, settings);
  };

  const handleConfirmSettlement = () => {
      if(!isPercentageValid) return alert(`Error: Porcentajes suman ${totalPercentage.toFixed(2)}%`);
      if(editingExpenseId) return alert("Termina de editar el gasto pendiente.");

      if(confirm("¿Cerrar liquidación? Esta acción es definitiva.")) {
          // Creamos el record real (sin el texto "PROVISORIO")
          const record = getTempRecord();
          record.id = crypto.randomUUID();
          record.month = new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' });
          onCloseMonth(record);
      }
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <div><h2 className="text-2xl font-bold text-slate-800">Liquidación</h2><p className="text-slate-500 text-sm">Configure vencimientos, revise gastos y cierre.</p></div>
        <button onClick={handleConfirmSettlement} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-bold shadow-lg flex items-center transition-all"><Archive className="w-5 h-5 mr-2"/> Liquidar Mes (Definitivo)</button>
      </div>

      {/* BARRA DE PREVISUALIZACIÓN */}
      <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-600" />
              <span className="font-bold text-indigo-900 text-sm">Previsualizar Documentos:</span>
          </div>
          
          <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
              <button onClick={handlePreviewGeneral} className="px-4 py-2 bg-white border border-indigo-200 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-100 flex items-center shadow-sm">
                  <FileText className="w-4 h-4 mr-2" /> Resumen General
              </button>

              <div className="h-6 w-px bg-indigo-200 hidden md:block"></div>

              <div className="flex gap-2 w-full md:w-auto">
                  <select className="px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm w-full md:w-48" value={previewUnitId} onChange={(e) => setPreviewUnitId(e.target.value)}>
                      <option value="">Seleccionar Unidad...</option>
                      {units.map(u => (<option key={u.id} value={u.id}>{u.unitNumber} - {u.ownerName}</option>))}
                  </select>
                  <button onClick={handlePreviewIndividual} className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center shadow-sm ${!previewUnitId ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white'}`} disabled={!previewUnitId}>
                      <User className="w-4 h-4 mr-2" /> Ver Cupón
                  </button>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Vencimientos */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center"><Calendar className="w-4 h-4 mr-2"/> Vencimientos</h3>
              <div className="grid grid-cols-3 gap-2">
                  <div><label className="block text-[10px] uppercase text-slate-500">1º Vto</label><input type="date" className="w-full p-1 border rounded text-sm" value={firstDate} onChange={e => setFirstDate(e.target.value)} /></div>
                  <div><label className="block text-[10px] uppercase text-slate-500">2º Vto</label><input type="date" className="w-full p-1 border rounded text-sm" value={secondDate} onChange={e => setSecondDate(e.target.value)} /></div>
                  <div><label className="block text-[10px] uppercase text-slate-500">Recargo %</label><input type="number" className="w-full p-1 border rounded text-sm" value={surcharge} onChange={e => setSurcharge(parseFloat(e.target.value))} /></div>
              </div>
          </div>

          {/* Banco */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <h3 className="font-bold text-slate-700 mb-2 flex items-center"><CreditCard className="w-4 h-4 mr-2"/> Datos de Pago</h3>
              <div className="text-sm text-slate-600 mb-2">
                  <p><strong>CBU:</strong> {settings.bankCBU || 'No configurado'}</p>
              </div>
              <button onClick={() => { setBankForm({bankName: settings.bankName, bankCBU: settings.bankCBU, bankAlias: settings.bankAlias, bankHolder: settings.bankHolder}); setShowBankModal(true); }} className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-sm font-medium transition-colors">Editar Datos Bancarios</button>
          </div>
      </div>

      {/* Fondo de Reserva */}
      <div className={`p-6 rounded-xl border shadow-sm ${reserveDeficit > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'}`}>
         <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-700 flex items-center gap-2"><AlertCircle className="w-5 h-5"/> Fondo de Reserva</h3>
             <div className="flex items-center gap-2"><span className="text-sm text-slate-500">Inicial:</span>
                 {isEditingReserve ? (<div className="flex items-center"><input type="number" className="w-24 p-1 border rounded text-right font-bold" value={manualReserveBalance} onChange={e => setManualReserveBalance(parseFloat(e.target.value))}/><button onClick={saveManualReserve} className="ml-2 text-green-600"><Save className="w-4 h-4"/></button></div>) : (<div className="flex items-center"><span className="font-bold text-lg">${manualReserveBalance.toLocaleString()}</span><button onClick={() => setIsEditingReserve(true)} className="ml-2 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4"/></button></div>)}
             </div>
         </div>
         <div className="flex items-center justify-between text-sm">
             <div><p className="text-slate-500">Gastos a cubrir</p><p className="text-xl font-bold text-red-600">-${totalFromReserve.toLocaleString()}</p></div>
             <div className="text-right">
                 <p className="text-slate-500">{reserveDeficit > 0 ? 'Déficit (Se cobra)' : 'Saldo Final'}</p>
                 <p className={`text-2xl font-bold ${reserveDeficit > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                     {reserveDeficit > 0 ? `-$${reserveDeficit.toLocaleString()}` : `$${projectedReserveBalance.toLocaleString()}`}
                 </p>
             </div>
         </div>
      </div>

      {/* TABLA EDITABLE DE GASTOS */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b font-bold text-slate-700 text-sm">Gastos Cargados (Edite antes de cerrar)</div>
          <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-slate-50 border-b">
                  <tr>
                      <th className="px-4 py-2">Desc.</th>
                      <th className="px-4 py-2">Tipo</th>
                      <th className="px-4 py-2 text-right">Monto</th>
                      <th className="px-4 py-2 text-center">Acción</th>
                  </tr>
              </thead>
              <tbody>
                  {expenses.map(e => (
                      <tr key={e.id} className={editingExpenseId === e.id ? 'bg-indigo-50' : ''}>
                          <td className="px-4 py-3">
                              {editingExpenseId === e.id ? <input className="w-full p-1 border rounded" value={editDesc} onChange={ev => setEditDesc(ev.target.value)} /> : e.description}
                          </td>
                          <td className="px-4 py-3">
                              {editingExpenseId === e.id ? (
                                  <select className="p-1 border rounded text-xs" value={editCat} onChange={ev => setEditCat(ev.target.value as any)}>
                                      <option value="Ordinary">Ordinario</option>
                                      <option value="Extraordinary">Extraordinario</option>
                                  </select>
                              ) : (
                                  <span className={`px-2 py-1 rounded text-xs border ${e.category === 'Ordinary' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                                      {e.category === 'Ordinary' ? 'Ord.' : 'Extra.'}
                                  </span>
                              )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                              {editingExpenseId === e.id ? <input type="number" className="w-24 p-1 border rounded text-right" value={editValue} onChange={ev => setEditValue(parseFloat(ev.target.value))} /> : `$${e.amount.toLocaleString()}`}
                          </td>
                          <td className="px-4 py-3 text-center">
                              {editingExpenseId === e.id ? 
                                  <button onClick={saveEditing}><Save className="w-4 h-4 text-green-600"/></button> : 
                                  <button onClick={() => startEditing(e)}><Edit2 className="w-4 h-4 text-slate-400 hover:text-indigo-600"/></button>
                              }
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200">
          <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center"><MessageSquare className="w-4 h-4 mr-2"/> Nota en Cupones</label>
          <textarea className="w-full p-3 border rounded-lg text-sm" rows={2} placeholder="Ej: Se recuerda la asamblea..." value={couponMessage} onChange={e => setCouponMessage(e.target.value)}></textarea>
      </div>

      {/* Modal Banco */}
      {showBankModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-xl">
                  <h3 className="font-bold text-lg mb-4">Editar Datos Bancarios</h3>
                  <div className="space-y-3">
                      <input className="w-full p-2 border rounded" placeholder="Banco" value={bankForm.bankName} onChange={e => setBankForm({...bankForm, bankName: e.target.value})} />
                      <input className="w-full p-2 border rounded" placeholder="Titular" value={bankForm.bankHolder} onChange={e => setBankForm({...bankForm, bankHolder: e.target.value})} />
                      <input className="w-full p-2 border rounded" placeholder="CBU" value={bankForm.bankCBU} onChange={e => setBankForm({...bankForm, bankCBU: e.target.value})} />
                      <input className="w-full p-2 border rounded" placeholder="Alias" value={bankForm.bankAlias} onChange={e => setBankForm({...bankForm, bankAlias: e.target.value})} />
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                      <button onClick={() => setShowBankModal(false)} className="px-4 py-2 text-slate-500">Cancelar</button>
                      <button onClick={saveBank} className="px-4 py-2 bg-indigo-600 text-white rounded">Guardar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SettlementView;