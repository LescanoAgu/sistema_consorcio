import { getLocalIsoDate, formatLocalDate } from '../utils/dateUtils';
import React, { useState } from 'react';
import { Payment, Unit, SettlementRecord } from '../types';
import { Search, CheckCircle, Square, DollarSign, X, Calendar } from 'lucide-react';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
};

interface CollectionsViewProps {
  payments: Payment[];
  units: Unit[];
  history: SettlementRecord[];
  onAddPayment: (p: Omit<Payment, 'id'>) => Promise<void>;
  onUpdateStatus: (id: string, s: 'APPROVED' | 'REJECTED') => Promise<void>;
  onUpdateUnit?: (unitId: string, updates: Partial<Unit>) => Promise<void>; 
  onDeletePayment?: (id: string) => Promise<void>;
}

const CollectionsView: React.FC<CollectionsViewProps> = ({ payments, units, history, onAddPayment, onUpdateStatus, onUpdateUnit, onDeletePayment }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'cobrar' | 'historial'>('cobrar');
  const [showPayModal, setShowPayModal] = useState<Unit | null>(null);
  
  const [payAmount, setPayAmount] = useState(0);
  const [payDate, setPayDate] = useState(getLocalIsoDate());
  const [payMethod, setPayMethod] = useState<'Transferencia' | 'Efectivo' | 'Cheque'>('Transferencia');
  const [payNotes, setPayNotes] = useState('');
  const [selectedDebtIds, setSelectedDebtIds] = useState<string[]>([]);

  const getUnitDebtInfo = (unit: Unit) => {
      const total = (unit.debts || []).reduce((acc, d) => acc + d.total, 0) + (unit.initialBalance || 0);
      return { historical: total, current: 0, total, pendingPeriod: '' };
  };

  const filteredUnits = units.filter(u => 
    u.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.ownerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenPayModal = (unit: Unit) => {
      setShowPayModal(unit);
      setSelectedDebtIds([]);
      setPayAmount(0);
      setPayNotes('');
  };

  const toggleDebtSelection = (debtId: string, amount: number) => {
      if (selectedDebtIds.includes(debtId)) {
          setSelectedDebtIds(selectedDebtIds.filter(id => id !== debtId));
          setPayAmount(prev => Math.max(0, prev - amount));
      } else {
          setSelectedDebtIds([...selectedDebtIds, debtId]);
          setPayAmount(prev => prev + amount);
      }
  };

  const handleConfirmPayment = async () => {
      if (!showPayModal || payAmount <= 0) return;

      try {
          // Calcular cómo se distribuye el pago
          let remainingToAllocate = payAmount;
          let updatedDebts = JSON.parse(JSON.stringify(showPayModal.debts || []));
          let allocations: { period: string; amount: number }[] = [];
          let updatedInitialBalance = showPayModal.initialBalance || 0;

          // Ordenar deudas: más antiguas primero (asumiendo que period es "YYYY-MM")
          let debtsToProcess = updatedDebts.sort((a: any, b: any) => a.period.localeCompare(b.period));

          // Si el usuario seleccionó deudas específicas, solo afectamos a esas
          if (selectedDebtIds.length > 0) {
              debtsToProcess = debtsToProcess.filter((d: any) => selectedDebtIds.includes(d.id || d.period));
          }

          // Distribuir el pago a initialBalance si fue seleccionado o si es distribución automática
          if (updatedInitialBalance > 0 && (selectedDebtIds.length === 0 || selectedDebtIds.includes('initial-balance'))) {
              const applyToInitial = Math.min(updatedInitialBalance, remainingToAllocate);
              if (applyToInitial > 0) {
                  allocations.push({ period: 'initial-balance', amount: applyToInitial });
                  updatedInitialBalance -= applyToInitial;
                  remainingToAllocate -= applyToInitial;
              }
          }

          // Distribuir a las deudas
          for (const debt of debtsToProcess) {
              if (remainingToAllocate <= 0) break;
              const amountToApply = Math.min(debt.total, remainingToAllocate);
              if (amountToApply > 0) {
                  allocations.push({ period: debt.period, amount: amountToApply });
                  debt.total -= amountToApply;
                  remainingToAllocate -= amountToApply;
              }
          }

          // Filtrar deudas que ya fueron pagadas completamente
          updatedDebts = updatedDebts.filter((d: any) => d.total > 0.01);

          await onAddPayment({
              unitId: showPayModal.id,
              amount: payAmount,
              date: payDate,
              method: payMethod,
              notes: payNotes + (selectedDebtIds.length > 0 ? ` (Cubre períodos seleccionados)` : ''),
              status: 'APPROVED',
              allocations
          });

          if (onUpdateUnit) {
              await onUpdateUnit(showPayModal.id, { 
                  debts: updatedDebts,
                  initialBalance: updatedInitialBalance
              });
          }

          alert("Pago registrado y saldos actualizados.");
          setShowPayModal(null);
      } catch (e) {
          alert("Error al procesar el pago.");
      }
  };

  return (
    <div className="space-y-6 animate-fade-in">

      <div className="flex border-b border-slate-200 mb-6">
        <button 
          onClick={() => setActiveTab('cobrar')}
          className={`px-4 py-3 font-bold text-sm transition-colors ${activeTab === 'cobrar' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Pendientes de Cobro
        </button>
        <button 
          onClick={() => setActiveTab('historial')}
          className={`px-4 py-3 font-bold text-sm transition-colors ${activeTab === 'historial' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Historial de Ingresos
        </button>
      </div>

      {activeTab === 'cobrar' && (
      <>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                  type="text" 
                  placeholder="Buscar unidad o propietario para cobrar..." 
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
              />
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium px-2">
              <div className="w-3 h-3 bg-amber-400 rounded-full"></div> Pendientes
              <div className="w-3 h-3 bg-red-500 rounded-full ml-2"></div> Con Deuda
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUnits.map(unit => {
              const info = getUnitDebtInfo(unit);
              return (
                  <div key={unit.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-4">
                          <div className="bg-slate-100 text-slate-700 font-black px-3 py-1 rounded-lg text-sm">
                              {unit.unitNumber}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                              {info.historical > 0 && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-200">DEUDA</span>}
                              {info.current > 0 && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">PENDIENTE</span>}
                              {info.total <= 0 && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">AL DÍA</span>}
                          </div>
                      </div>

                      <h3 className="font-bold text-slate-800 truncate mb-1">{unit.ownerName}</h3>
                      
                      <div className="mt-4 pt-4 border-t border-slate-50">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saldo Total</p>
                          <p className={`text-2xl font-black ${info.total > 0 ? 'text-slate-800' : 'text-emerald-500'}`}>
                              {formatCurrency(info.total)}
                          </p>
                      </div>

                      <button 
                        onClick={() => handleOpenPayModal(unit)}
                        className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                      >
                          <DollarSign className="w-4 h-4"/> Cobrar
                      </button>
                  </div>
              )
          })}
        </div>
      </>
      )}

      {activeTab === 'historial' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                        <th className="p-4 font-bold">Fecha</th>
                        <th className="p-4 font-bold">Unidad</th>
                        <th className="p-4 font-bold text-right">Monto</th>
                        <th className="p-4 font-bold">Método</th>
                        <th className="p-4 font-bold">Notas</th>
                        <th className="p-4 font-bold text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {payments.filter(p => p.status === 'APPROVED').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(p => {
                        const unit = units.find(u => u.id === p.unitId);
                        return (
                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 text-sm font-medium text-slate-700">{formatLocalDate(p.date)}</td>
                                <td className="p-4">
                                    <p className="font-bold text-slate-800">{unit?.unitNumber}</p>
                                    <p className="text-xs text-slate-500">{unit?.ownerName}</p>
                                </td>
                                <td className="p-4 font-black text-indigo-600 text-right">{formatCurrency(p.amount)}</td>
                                <td className="p-4 text-sm text-slate-600">{p.method}</td>
                                <td className="p-4 text-xs text-slate-500 max-w-[200px] truncate" title={p.notes}>{p.notes || '-'}</td>
                                <td className="p-4 text-center">
                                    <button 
                                        onClick={() => {
                                            if(confirm('ATENCIÓN: Se anulará este cobro.\n\n- Se descontará de los ingresos.\n- Si este pago destinó fondos a la Reserva, se debitarán automáticamente.\n- Si cubría deuda histórica (Morosidad), NO volverá automáticamente; deberás cargarla manual en la vista Morosidad.\n\n¿Estás seguro?')) {
                                                onDeletePayment?.(p.id);
                                            }
                                        }}
                                        className="px-3 py-1.5 bg-red-50 text-red-600 font-bold text-xs rounded hover:bg-red-100 transition-colors border border-red-100"
                                    >
                                        Revertir
                                    </button>
                                </td>
                            </tr>
                        )
                    })}
                    {payments.filter(p => p.status === 'APPROVED').length === 0 && (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">No hay cobros registrados todavía.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      )}

      {showPayModal && activeTab === 'cobrar' && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                      <div>
                          <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest">Registrar Ingreso</p>
                          <h3 className="text-xl font-black">{showPayModal.unitNumber} - {showPayModal.ownerName}</h3>
                      </div>
                      <button onClick={() => setShowPayModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X/></button>
                  </div>

                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                          <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-indigo-500"/> ¿Qué meses está pagando?
                          </h4>
                          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                              
                              {showPayModal.initialBalance > 0 && (
                                  <div 
                                    onClick={() => toggleDebtSelection('initial-balance', showPayModal.initialBalance)}
                                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex justify-between items-center ${selectedDebtIds.includes('initial-balance') ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
                                  >
                                      <div className="flex items-center gap-3">
                                          {selectedDebtIds.includes('initial-balance') ? <CheckCircle className="text-indigo-600 w-5 h-5"/> : <Square className="text-slate-300 w-5 h-5"/>}
                                          <div>
                                              <p className="text-xs font-bold text-slate-800">Saldo Inicial</p>
                                              <p className="text-[10px] text-slate-500">Deuda previa</p>
                                          </div>
                                      </div>
                                      <span className="font-bold text-sm">{formatCurrency(showPayModal.initialBalance)}</span>
                                  </div>
                              )}

                              {(showPayModal.debts || []).map(debt => {
                                  const safeId = debt.id || debt.period;
                                  return (
                                  <div 
                                    key={safeId}
                                    onClick={() => toggleDebtSelection(safeId, debt.total)}
                                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex justify-between items-center ${selectedDebtIds.includes(safeId) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
                                  >
                                      <div className="flex items-center gap-3">
                                          {selectedDebtIds.includes(safeId) ? <CheckCircle className="text-indigo-600 w-5 h-5"/> : <Square className="text-slate-300 w-5 h-5"/>}
                                          <div>
                                              <p className="text-xs font-bold text-slate-800">{debt.period}</p>
                                              <p className="text-[10px] text-slate-500">Morosidad cargada</p>
                                          </div>
                                      </div>
                                      <span className="font-bold text-sm">{formatCurrency(debt.total)}</span>
                                  </div>
                              )})}

                              {selectedDebtIds.length === 0 && (showPayModal.initialBalance === 0 && (showPayModal.debts?.length || 0) === 0) && (
                                  <p className="text-center py-10 text-slate-400 text-sm italic">No registra deudas pendientes.</p>
                              )}
                          </div>
                      </div>

                      <div>
                          <div className="space-y-4">
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto a Cobrar</label>
                                  <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-indigo-600">$</span>
                                      <input 
                                          type="number" 
                                          className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xl font-black text-indigo-700" 
                                          value={payAmount}
                                          onChange={e => setPayAmount(parseFloat(e.target.value) || 0)}
                                      />
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-1">Podés editar el monto si el pago es parcial.</p>
                              </div>

                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Medio de Pago</label>
                                  <select 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700"
                                    value={payMethod}
                                    onChange={e => setPayMethod(e.target.value as any)}
                                  >
                                      <option value="Transferencia">Transferencia</option>
                                      <option value="Efectivo">Efectivo</option>
                                      <option value="Cheque">Cheque</option>
                                  </select>
                              </div>

                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha</label>
                                  <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700" value={payDate} onChange={e => setPayDate(e.target.value)} />
                              </div>

                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notas / Referencia</label>
                                  <textarea className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" rows={2} placeholder="Nro de transaccion, quien pagó..." value={payNotes} onChange={e => setPayNotes(e.target.value)} />
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                      <button onClick={() => setShowPayModal(null)} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
                      <button 
                        onClick={handleConfirmPayment}
                        disabled={payAmount <= 0}
                        className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50"
                      >
                          Confirmar Cobro
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default CollectionsView;