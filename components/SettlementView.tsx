import React, { useMemo, useState, useEffect } from 'react';
import { Unit, Expense, ExpenseDistributionType, SettlementRecord, ConsortiumSettings } from '../types';
import { Archive, AlertCircle, Save, MessageSquare, Edit2, Calendar, CreditCard, Eye, FileText, User, Download, Calculator } from 'lucide-react';
import { updateExpense } from '../services/firestoreService';
import { generateSettlementPDF } from '../services/pdfService';

interface SettlementViewProps {
  units: Unit[];
  expenses: Expense[];
  settings: ConsortiumSettings;
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  consortiumId: string;
  consortiumName: string;
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

  // Datos bancarios (Formulario local)
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankForm, setBankForm] = useState({
      bankName: settings.bankName || '',
      bankCBU: settings.bankCBU || '',
      bankAlias: settings.bankAlias || '',
      bankHolder: settings.bankHolder || ''
  });

  // --- CÁLCULOS ---
  const totalOrdinary = expenses.filter(e => e.category === 'Ordinary' && e.distributionType !== ExpenseDistributionType.FROM_RESERVE).reduce((a, b) => a + b.amount, 0);
  const totalExtraordinary = expenses.filter(e => e.category === 'Extraordinary' && e.distributionType !== ExpenseDistributionType.FROM_RESERVE).reduce((a, b) => a + b.amount, 0);
  const totalReserveSpent = expenses.filter(e => e.distributionType === ExpenseDistributionType.FROM_RESERVE).reduce((a, b) => a + b.amount, 0);
  
  const reserveContribution = (totalOrdinary * settings.monthlyReserveContributionPercentage) / 100;
  const newReserveBalance = settings.reserveFundBalance - totalReserveSpent + reserveContribution;

  const unitDebts = useMemo(() => {
      const totalToDistribute = totalOrdinary + totalExtraordinary + reserveContribution;
      return units.map(u => {
          const share = totalToDistribute * (u.proratePercentage / 100);
          return { unitId: u.id, unitNumber: u.unitNumber, owner: u.ownerName, total: share };
      });
  }, [units, totalOrdinary, totalExtraordinary, reserveContribution]);

  const handleClose = () => {
      if(confirm("¿Confirmar cierre de expensas? Esto generará la deuda a las unidades y archivará los gastos.")) {
          const record: SettlementRecord = {
              id: '', 
              month: new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' }),
              dateClosed: new Date().toISOString(),
              totalExpenses: totalOrdinary + totalExtraordinary,
              totalCollected: 0, 
              
              reserveBalanceStart: settings.reserveFundBalance,
              reserveContribution,
              reserveExpense: totalReserveSpent,
              reserveBalanceAtClose: newReserveBalance,

              firstExpirationDate: firstDate,
              secondExpirationDate: secondDate,
              
              snapshotExpenses: expenses,
              couponMessage,
              unitDetails: unitDebts.map(u => ({ unitId: u.unitId, totalToPay: u.total }))
          };
          onCloseMonth(record);
      }
  };

  const saveBank = () => {
      onUpdateBankSettings(bankForm);
      setShowBankModal(false);
  }

  const handlePreviewPDF = () => {
      const dummyRecord: SettlementRecord = {
          id: 'preview',
          month: 'BORRADOR / VISTA PREVIA',
          dateClosed: new Date().toISOString(),
          totalExpenses: totalOrdinary + totalExtraordinary,
          totalCollected: 0,
          reserveBalanceStart: settings.reserveFundBalance,
          reserveContribution,
          reserveExpense: totalReserveSpent,
          reserveBalanceAtClose: newReserveBalance,
          snapshotExpenses: expenses,
          unitDetails: unitDebts.map(u => ({ unitId: u.unitId, totalToPay: u.total }))
      };
      
      generateSettlementPDF(dummyRecord, consortiumName, units, settings);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Cierre de Liquidación</h2>
            <p className="text-slate-500">Revise los números antes de emitir las expensas.</p>
          </div>
          <div className="flex gap-2">
              <button 
                onClick={handlePreviewPDF}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 shadow-sm"
              >
                  <FileText className="w-4 h-4" />
                  Vista Previa PDF
              </button>
              <button onClick={handleClose} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                  <Archive className="w-4 h-4" />
                  Cerrar Mes y Emitir
              </button>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* COLUMNA 1: Resumen General */}
          <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-indigo-500"/> Totales
                  </h3>
                  <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Gastos Ordinarios</span>
                          <span className="font-bold">${totalOrdinary.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Gastos Extraordinarios</span>
                          <span className="font-bold">${totalExtraordinary.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t">
                          <span className="text-slate-600">+ Fondo Reserva ({settings.monthlyReserveContributionPercentage}%)</span>
                          <span className="font-bold text-emerald-600">${reserveContribution.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-lg pt-2 border-t border-slate-100 font-bold">
                          <span className="text-slate-800">Total a Prorratear</span>
                          <span className="text-indigo-600">${(totalOrdinary + totalExtraordinary + reserveContribution).toFixed(2)}</span>
                      </div>
                  </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-slate-700 flex items-center gap-2">
                          <CreditCard className="w-5 h-5 text-indigo-500"/> Datos Bancarios
                      </h3>
                      <button onClick={() => setShowBankModal(true)} className="text-xs text-indigo-600 hover:underline flex items-center">
                          <Edit2 className="w-3 h-3 mr-1"/> Editar
                      </button>
                  </div>
                  <div className="text-sm space-y-2 text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      {settings.bankCBU ? (
                          <>
                            <p><span className="font-semibold">Banco:</span> {settings.bankName}</p>
                            <p><span className="font-semibold">CBU:</span> {settings.bankCBU}</p>
                            <p><span className="font-semibold">Alias:</span> {settings.bankAlias}</p>
                          </>
                      ) : (
                          <p className="text-amber-600 italic flex items-center"><AlertCircle className="w-3 h-3 mr-1"/> Sin datos configurados</p>
                      )}
                  </div>
              </div>
          </div>

          {/* COLUMNA 2: Previsualización por Unidad */}
          <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[500px]">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-500"/> Prorrateo Estimado
              </h3>
              <div className="flex-1 overflow-y-auto pr-2">
                  <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500 sticky top-0">
                          <tr>
                              <th className="px-3 py-2 text-left">UF</th>
                              <th className="px-3 py-2 text-left">Propietario</th>
                              <th className="px-3 py-2 text-right">%</th>
                              <th className="px-3 py-2 text-right">Cuota</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {unitDebts.map(u => (
                              <tr key={u.unitId} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 font-bold text-slate-700">{u.unitNumber}</td>
                                  <td className="px-3 py-2 text-slate-600 truncate max-w-[150px]">{u.owner}</td>
                                  <td className="px-3 py-2 text-right text-slate-500">
                                      {units.find(un => un.id === u.unitId)?.proratePercentage}%
                                  </td>
                                  <td className="px-3 py-2 text-right font-bold text-emerald-600">
                                      ${u.total.toFixed(2)}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>

      {/* Modal Edición Banco */}
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