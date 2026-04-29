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
}

const CollectionsView: React.FC<CollectionsViewProps> = ({ payments, units, history, onAddPayment, onUpdateStatus, onUpdateUnit }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showPayModal, setShowPayModal] = useState<Unit | null>(null);
  
  const [payAmount, setPayAmount] = useState(0);
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState<'Transferencia' | 'Efectivo' | 'Cheque'>('Transferencia');
  const [payNotes, setPayNotes] = useState('');
  const [selectedDebtIds, setSelectedDebtIds] = useState<string[]>([]);

  const getUnitDebtInfo = (unit: Unit) => {
      const historical = (unit.debts || []).reduce((acc, d) => acc + d.total, 0) + (unit.initialBalance || 0);
      let current = 0;
      let pendingPeriod = '';
      
      if (history.length > 0) {
          const lastSettlement = history[0]; 
          const unitDetail = lastSettlement.unitDetails?.find(d => d.unitId === unit.id);
          if (unitDetail) {
              const isAlreadyInDebts = (unit.debts || []).some(d => d.period === lastSettlement.month);
              if (!isAlreadyInDebts) {
                  const settlementDate = new Date(lastSettlement.dateClosed).getTime();
                  const paidSinceThen = payments
                      .filter(p => p.unitId === unit.id && p.status === 'APPROVED' && new Date(p.date).getTime() >= settlementDate)
                      .reduce((sum, p) => sum + p.amount, 0);
                  const owed = unitDetail.totalToPay - paidSinceThen;
                  if (owed > 1) { current = owed; pendingPeriod = lastSettlement.month; }
              }
          }
      }
      return { historical, current, total: historical + current, pendingPeriod };
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
          await onAddPayment({
              unitId: showPayModal.id,
              amount: payAmount,
              date: payDate,
              method: payMethod,
              notes: payNotes + (selectedDebtIds.length > 0 ? ` (Cubre períodos seleccionados)` : ''),
              status: 'APPROVED' 
          });

          if (selectedDebtIds.length > 0 && onUpdateUnit) {
              const remainingDebts = (showPayModal.debts || []).filter(d => !selectedDebtIds.includes(d.id));
              let updates: Partial<Unit> = { debts: remainingDebts };
              
              if (selectedDebtIds.includes('initial-balance')) {
                  updates.initialBalance = 0;
              }

              await onUpdateUnit(showPayModal.id, updates);
          }

          alert("Pago registrado y saldos actualizados.");
          setShowPayModal(null);
      } catch (e) {
          alert("Error al procesar el pago.");
      }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
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

      {showPayModal && (
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

                              {(showPayModal.debts || []).map(debt => (
                                  <div 
                                    key={debt.id}
                                    onClick={() => toggleDebtSelection(debt.id, debt.total)}
                                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex justify-between items-center ${selectedDebtIds.includes(debt.id) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
                                  >
                                      <div className="flex items-center gap-3">
                                          {selectedDebtIds.includes(debt.id) ? <CheckCircle className="text-indigo-600 w-5 h-5"/> : <Square className="text-slate-300 w-5 h-5"/>}
                                          <div>
                                              <p className="text-xs font-bold text-slate-800">{debt.period}</p>
                                              <p className="text-[10px] text-slate-500">Morosidad cargada</p>
                                          </div>
                                      </div>
                                      <span className="font-bold text-sm">{formatCurrency(debt.total)}</span>
                                  </div>
                              ))}

                              {getUnitDebtInfo(showPayModal).current > 0 && (
                                  <div 
                                    onClick={() => toggleDebtSelection('current-month', getUnitDebtInfo(showPayModal).current)}
                                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex justify-between items-center ${selectedDebtIds.includes('current-month') ? 'border-amber-500 bg-amber-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
                                  >
                                      <div className="flex items-center gap-3">
                                          {selectedDebtIds.includes('current-month') ? <CheckCircle className="text-amber-600 w-5 h-5"/> : <Square className="text-slate-300 w-5 h-5"/>}
                                          <div>
                                              <p className="text-xs font-bold text-slate-800">{getUnitDebtInfo(showPayModal).pendingPeriod}</p>
                                              <p className="text-[10px] text-slate-500">Mes en curso</p>
                                          </div>
                                      </div>
                                      <span className="font-bold text-sm">{formatCurrency(getUnitDebtInfo(showPayModal).current)}</span>
                                  </div>
                              )}

                              {selectedDebtIds.length === 0 && (showPayModal.initialBalance === 0 && (showPayModal.debts?.length || 0) === 0 && getUnitDebtInfo(showPayModal).current === 0) && (
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