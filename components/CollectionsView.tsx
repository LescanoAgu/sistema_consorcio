import { getLocalIsoDate, formatLocalDate } from '../utils/dateUtils';
import React, { useState, useMemo } from 'react';
import { Payment, Unit, SettlementRecord, ConsortiumSettings } from '../types';
import { Search, CheckCircle, Square, DollarSign, X, Calendar, Clock, ExternalLink, XCircle, Sparkles, Building2 } from 'lucide-react';
import { calculateReserveForPeriodBase, doesUnitContributeToReserve } from '../utils/reserveAccounting';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
};

interface CollectionsViewProps {
  payments: Payment[];
  units: Unit[];
  history: SettlementRecord[];
  settings?: ConsortiumSettings;
  onAddPayment: (p: Omit<Payment, 'id'>) => Promise<void>;
  onUpdateStatus: (id: string, s: 'APPROVED' | 'REJECTED', approvalPayload?: Partial<Payment>) => Promise<void>;
  onUpdateUnit?: (unitId: string, updates: Partial<Unit>) => Promise<void>; 
  onDeletePayment?: (id: string) => Promise<void>;
}

const CollectionsView: React.FC<CollectionsViewProps> = ({
  payments,
  units,
  history,
  settings,
  onAddPayment,
  onUpdateStatus,
  onUpdateUnit,
  onDeletePayment
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'cobrar' | 'pendientes' | 'historial'>('cobrar');
  const [showPayModal, setShowPayModal] = useState<Unit | null>(null);
  const [approvingPayment, setApprovingPayment] = useState<Payment | null>(null);
  
  const [payAmount, setPayAmount] = useState(0);
  const [payDate, setPayDate] = useState(getLocalIsoDate());
  const [payMethod, setPayMethod] = useState<'Transferencia' | 'Efectivo' | 'Cheque'>('Transferencia');
  const [payNotes, setPayNotes] = useState('');
  const [selectedDebtIds, setSelectedDebtIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const pendingPayments = useMemo(
    () => payments.filter(p => p.status === 'PENDING').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [payments]
  );

  const approvedPayments = useMemo(
    () => payments.filter(p => p.status === 'APPROVED').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [payments]
  );

  const getUnitDebtInfo = (unit: Unit) => {
      const total = Number(((unit.debts || []).reduce((acc, d) => acc + d.total, 0) + (unit.initialBalance || 0)).toFixed(2));
      const credit = Number((unit.creditBalance || 0).toFixed(2));
      return { historical: total, current: 0, total, credit, pendingPeriod: '' };
  };

  const filteredUnits = units.filter(u => 
    u.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.ownerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenPayModal = (unit: Unit, pendingToApprove?: Payment) => {
      setShowPayModal(unit);
      if (pendingToApprove) {
          setApprovingPayment(pendingToApprove);
          setPayAmount(Number(pendingToApprove.amount || 0));
          setPayDate(pendingToApprove.date ? pendingToApprove.date.split('T')[0] : getLocalIsoDate());
          setPayMethod(pendingToApprove.method || 'Transferencia');
          setPayNotes(pendingToApprove.notes || '');
          setSelectedDebtIds([]);
      } else {
          setApprovingPayment(null);
          setSelectedDebtIds([]);
          setPayAmount(0);
          setPayDate(getLocalIsoDate());
          setPayMethod('Transferencia');
          setPayNotes('');
      }
  };

  const toggleDebtSelection = (debtId: string, amount: number) => {
      if (selectedDebtIds.includes(debtId)) {
          const next = selectedDebtIds.filter(id => id !== debtId);
          setSelectedDebtIds(next);
          if (!approvingPayment) {
              setPayAmount(prev => Number(Math.max(0, prev - amount).toFixed(2)));
          }
      } else {
          const next = [...selectedDebtIds, debtId];
          setSelectedDebtIds(next);
          if (!approvingPayment) {
              setPayAmount(prev => Number((prev + amount).toFixed(2)));
          }
      }
  };

  // Cálculo en vivo de vista previa de imputación (Mora vs Capital vs Reserva vs Saldo a Favor)
  const allocationPreview = useMemo(() => {
      if (!showPayModal || payAmount <= 0) {
          return { totalDebtAvailable: 0, interestToPay: 0, baseToPay: 0, reserveToCredit: 0, surplusCredit: 0 };
      }
      const unit = showPayModal;
      const effectiveSettings: ConsortiumSettings = settings || {
          reserveFundBalance: 0, monthlyReserveContributionPercentage: 5, interestRate: 0,
          bankName: '', bankCBU: '', bankAlias: '', bankHolder: '', bankCuit: ''
      };

      let remaining = payAmount;
      let interestSum = 0;
      let baseSum = 0;
      let reserveSum = 0;

      const parsePeriodSortKey = (periodStr: string): number => {
          if (!periodStr) return 0;
          const clean = periodStr.toLowerCase().trim();
          if (clean.includes('inicial') || clean.includes('previa')) return -1;
          const monthMap: { [key: string]: number } = {
              enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
              julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
              noviembre: 11, diciembre: 12
          };
          let m = 0;
          for (const [name, num] of Object.entries(monthMap)) {
              if (clean.includes(name)) { m = num; break; }
          }
          const yMatch = clean.match(/\b(20\d\d)\b/);
          const y = yMatch ? parseInt(yMatch[1], 10) : 2000;
          return y * 100 + m;
      };

      let debtsList = [...(unit.debts || [])].sort((a, b) => parsePeriodSortKey(a.period) - parsePeriodSortKey(b.period));
      if (selectedDebtIds.length > 0) {
          debtsList = debtsList.filter(d => selectedDebtIds.includes(d.id || d.period));
      }

      const initBal = Number(unit.initialBalance || 0);
      if (initBal > 0 && (selectedDebtIds.length === 0 || selectedDebtIds.includes('initial-balance'))) {
          const applyInit = Math.min(initBal, remaining);
          if (applyInit > 0) {
              baseSum += applyInit;
              const { reserveAmount } = calculateReserveForPeriodBase(applyInit, 'initial-balance', unit, history, effectiveSettings);
              reserveSum += reserveAmount;
              remaining -= applyInit;
          }
      }

      for (const d of debtsList) {
          if (remaining <= 0) break;
          const apply = Math.min(d.total, remaining);
          if (apply > 0) {
              const curInt = Number(d.interestAmount) || 0;
              const payInt = Math.min(curInt, apply);
              const payBase = apply - payInt;
              interestSum += payInt;
              baseSum += payBase;
              const { reserveAmount } = calculateReserveForPeriodBase(payBase, d.period, unit, history, effectiveSettings, d);
              reserveSum += reserveAmount;
              remaining -= apply;
          }
      }

      const totalDebtAvailable = Number((initBal + (unit.debts || []).reduce((acc, d) => acc + d.total, 0)).toFixed(2));
      return {
          totalDebtAvailable,
          interestToPay: Number(interestSum.toFixed(2)),
          baseToPay: Number(baseSum.toFixed(2)),
          reserveToCredit: Number(reserveSum.toFixed(2)),
          surplusCredit: Number(Math.max(0, remaining).toFixed(2))
      };
  }, [showPayModal, payAmount, selectedDebtIds, history, settings]);

  const handleConfirmPayment = async () => {
      if (!showPayModal || payAmount <= 0 || isProcessing) return;
      setIsProcessing(true);

      try {
          const effectiveSettings: ConsortiumSettings = settings || {
              reserveFundBalance: 0, monthlyReserveContributionPercentage: 5, interestRate: 0,
              bankName: '', bankCBU: '', bankAlias: '', bankHolder: '', bankCuit: ''
          };

          let remainingToAllocate = Number(payAmount.toFixed(2));
          let updatedDebts = JSON.parse(JSON.stringify(showPayModal.debts || []));
          let allocations: { period: string; amount: number; basePaid: number; interestPaid: number; reservePaid: number }[] = [];
          let updatedInitialBalance = Number((showPayModal.initialBalance || 0).toFixed(2));
          let totalReserveContribution = 0;

          const parsePeriodSortKey = (periodStr: string): number => {
              if (!periodStr) return 0;
              const clean = periodStr.toLowerCase().trim();
              if (clean.includes('inicial') || clean.includes('previa')) return -1;
              const monthMap: { [key: string]: number } = {
                  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
                  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
                  noviembre: 11, diciembre: 12
              };
              let m = 0;
              for (const [name, num] of Object.entries(monthMap)) {
                  if (clean.includes(name)) { m = num; break; }
              }
              const yMatch = clean.match(/\b(20\d\d)\b/);
              const y = yMatch ? parseInt(yMatch[1], 10) : 2000;
              return y * 100 + m;
          };

          let debtsToProcess = updatedDebts.sort((a: any, b: any) => parsePeriodSortKey(a.period) - parsePeriodSortKey(b.period));

          if (selectedDebtIds.length > 0) {
              debtsToProcess = debtsToProcess.filter((d: any) => selectedDebtIds.includes(d.id || d.period));
          }

          if (updatedInitialBalance > 0 && (selectedDebtIds.length === 0 || selectedDebtIds.includes('initial-balance'))) {
              const applyToInitial = Number(Math.min(updatedInitialBalance, remainingToAllocate).toFixed(2));
              if (applyToInitial > 0) {
                  const { reserveAmount } = calculateReserveForPeriodBase(
                      applyToInitial,
                      'initial-balance',
                      showPayModal,
                      history,
                      effectiveSettings
                  );
                  allocations.push({
                      period: 'initial-balance',
                      amount: applyToInitial,
                      basePaid: applyToInitial,
                      interestPaid: 0,
                      reservePaid: reserveAmount
                  });
                  totalReserveContribution = Number((totalReserveContribution + reserveAmount).toFixed(2));
                  updatedInitialBalance = Number((updatedInitialBalance - applyToInitial).toFixed(2));
                  remainingToAllocate = Number((remainingToAllocate - applyToInitial).toFixed(2));
              }
          }

          // Distribuir a las deudas cronológicamente (imputando primero a intereses por mora y luego al capital base)
          // IMPORTANTE: Los intereses por mora NUNCA suman al Fondo de Reserva.
          for (const debt of debtsToProcess) {
              if (remainingToAllocate <= 0) break;
              const amountToApply = Number(Math.min(debt.total, remainingToAllocate).toFixed(2));
              if (amountToApply > 0) {
                  const currentInterest = Number(debt.interestAmount) || 0;
                  const payToInterest = Number(Math.min(currentInterest, amountToApply).toFixed(2));
                  const payToBase = Number((amountToApply - payToInterest).toFixed(2));

                  const { reserveAmount } = calculateReserveForPeriodBase(
                      payToBase,
                      debt.period,
                      showPayModal,
                      history,
                      effectiveSettings,
                      debt
                  );

                  allocations.push({
                      period: debt.period,
                      amount: amountToApply,
                      basePaid: payToBase,
                      interestPaid: payToInterest,
                      reservePaid: reserveAmount
                  });

                  totalReserveContribution = Number((totalReserveContribution + reserveAmount).toFixed(2));

                  debt.interestAmount = Number(Math.max(0, currentInterest - payToInterest).toFixed(2));
                  debt.baseAmount = Number(Math.max(0, (Number(debt.baseAmount) || 0) - payToBase).toFixed(2));
                  debt.total = Number(Math.max(0, debt.baseAmount + debt.interestAmount).toFixed(2));
                  debt.paidAmount = Number(((debt.paidAmount || 0) + amountToApply).toFixed(2));

                  remainingToAllocate = Number((remainingToAllocate - amountToApply).toFixed(2));
              }
          }

          updatedDebts = updatedDebts.filter((d: any) => d.total > 0.01);

          // Si el vecino pagó de más, el excedente queda como Saldo a Favor (creditBalance)
          const creditGenerated = remainingToAllocate > 0.01 ? Number(remainingToAllocate.toFixed(2)) : 0;
          const updatedCreditBalance = Number(((showPayModal.creditBalance || 0) + creditGenerated).toFixed(2));

          if (approvingPayment) {
              await onUpdateStatus(approvingPayment.id, 'APPROVED', {
                  amount: payAmount,
                  date: payDate,
                  method: payMethod,
                  notes: payNotes + (selectedDebtIds.length > 0 ? ` (Cubre períodos seleccionados)` : ''),
                  allocations,
                  reserveContribution: totalReserveContribution,
                  creditGenerated
              });
          } else {
              await onAddPayment({
                  unitId: showPayModal.id,
                  amount: payAmount,
                  date: payDate,
                  method: payMethod,
                  notes: payNotes + (selectedDebtIds.length > 0 ? ` (Cubre períodos seleccionados)` : ''),
                  status: 'APPROVED',
                  allocations,
                  reserveContribution: totalReserveContribution,
                  creditGenerated
              });
          }

          if (onUpdateUnit) {
              await onUpdateUnit(showPayModal.id, { 
                  debts: updatedDebts,
                  initialBalance: updatedInitialBalance,
                  creditBalance: updatedCreditBalance
              });
          }

          alert(
              approvingPayment
                ? `¡Pago aprobado e imputado correctamente!${creditGenerated > 0 ? `\nSe acreditaron ${formatCurrency(creditGenerated)} como Saldo a Favor.` : ''}`
                : `Pago registrado y saldos actualizados.${creditGenerated > 0 ? `\nSe acreditaron ${formatCurrency(creditGenerated)} como Saldo a Favor.` : ''}`
          );
          setShowPayModal(null);
          setApprovingPayment(null);
      } catch (e) {
          alert("Error al procesar el pago.");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleRejectPending = async (payment: Payment) => {
      if (!confirm("¿Rechazar este comprobante informado por el vecino?")) return;
      await onUpdateStatus(payment.id, 'REJECTED');
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ALERTA DE COMPROBANTES INFORMADOS POR VECINOS */}
      {pendingPayments.length > 0 && activeTab !== 'pendientes' && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                  <div className="bg-amber-500 text-white p-2.5 rounded-xl">
                      <Clock className="w-5 h-5" />
                  </div>
                  <div>
                      <h4 className="font-black text-amber-900 text-sm">
                          Tenés {pendingPayments.length} {pendingPayments.length === 1 ? 'pago informado por un vecino' : 'pagos informados por vecinos'} pendiente{pendingPayments.length === 1 ? '' : 's'} de revisión
                      </h4>
                      <p className="text-xs text-amber-700">
                          Revisá el comprobante adjunto y aprobá el cobro para descontar automáticamente su deuda.
                      </p>
                  </div>
              </div>
              <button
                  onClick={() => setActiveTab('pendientes')}
                  className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-colors whitespace-nowrap shadow-sm"
              >
                  Revisar Comprobantes ({pendingPayments.length})
              </button>
          </div>
      )}

      <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('cobrar')}
          className={`px-4 py-3 font-bold text-sm transition-colors whitespace-nowrap ${activeTab === 'cobrar' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Pendientes de Cobro
        </button>
        <button 
          onClick={() => setActiveTab('pendientes')}
          className={`px-4 py-3 font-bold text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'pendientes' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Por Aprobar (Vecinos)
          {pendingPayments.length > 0 && (
              <span className="bg-amber-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full">
                  {pendingPayments.length}
              </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('historial')}
          className={`px-4 py-3 font-bold text-sm transition-colors whitespace-nowrap ${activeTab === 'historial' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
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
              <div className="w-3 h-3 bg-emerald-500 rounded-full"></div> Al día / Saldo a favor
              <div className="w-3 h-3 bg-red-500 rounded-full ml-2"></div> Con Deuda
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUnits.map(unit => {
              const info = getUnitDebtInfo(unit);
              const isOccupied = doesUnitContributeToReserve(unit);
              return (
                  <div key={unit.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between">
                      <div>
                          <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-1.5">
                                  <div className="bg-slate-100 text-slate-700 font-black px-3 py-1 rounded-lg text-sm">
                                      {unit.unitNumber}
                                  </div>
                                  {!isOccupied && (
                                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-200" title="Local Libre / Exento de Fondo de Reserva">
                                          LIBRE
                                      </span>
                                  )}
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                  {info.historical > 0 && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-200">DEUDA</span>}
                                  {info.total <= 0 && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">AL DÍA</span>}
                                  {info.credit > 0 && (
                                      <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                                          A FAVOR: {formatCurrency(info.credit)}
                                      </span>
                                  )}
                              </div>
                          </div>

                          <h3 className="font-bold text-slate-800 truncate mb-1">{unit.ownerName}</h3>
                      </div>
                      
                      <div>
                          <div className="mt-4 pt-4 border-t border-slate-50">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saldo Adeudado</p>
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
                  </div>
              )
          })}
        </div>
      </>
      )}

      {activeTab === 'pendientes' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse">
                  <thead>
                      <tr className="bg-amber-50 text-amber-900 text-xs uppercase tracking-wider border-b border-amber-200">
                          <th className="p-4 font-bold">Fecha</th>
                          <th className="p-4 font-bold">Unidad / Propietario</th>
                          <th className="p-4 font-bold text-right">Monto Informado</th>
                          <th className="p-4 font-bold">Método</th>
                          <th className="p-4 font-bold">Notas / Comprobante</th>
                          <th className="p-4 font-bold text-center">Acciones</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {pendingPayments.map(p => {
                          const unit = units.find(u => u.id === p.unitId);
                          return (
                              <tr key={p.id} className="hover:bg-amber-50/30 transition-colors">
                                  <td className="p-4 text-sm font-medium text-slate-700">{formatLocalDate(p.date)}</td>
                                  <td className="p-4">
                                      <p className="font-bold text-slate-800">{unit?.unitNumber || 'UF ?'}</p>
                                      <p className="text-xs text-slate-500">{unit?.ownerName || '-'}</p>
                                  </td>
                                  <td className="p-4 font-black text-amber-700 text-right">{formatCurrency(p.amount)}</td>
                                  <td className="p-4 text-sm text-slate-600">{p.method}</td>
                                  <td className="p-4 text-xs text-slate-600">
                                      <div className="flex flex-col gap-1">
                                          <span>{p.notes || 'Sin notas'}</span>
                                          {p.attachmentUrl && (
                                              <a
                                                  href={p.attachmentUrl}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="inline-flex items-center gap-1 text-indigo-600 font-bold hover:underline"
                                              >
                                                  <ExternalLink className="w-3.5 h-3.5" /> Ver Comprobante Adjunto
                                              </a>
                                          )}
                                      </div>
                                  </td>
                                  <td className="p-4 text-center">
                                      <div className="flex items-center justify-center gap-2">
                                          <button
                                              onClick={() => {
                                                  if (unit) handleOpenPayModal(unit, p);
                                                  else alert("No se encontró la unidad asociada a este pago.");
                                              }}
                                              className="px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm"
                                          >
                                              <CheckCircle className="w-3.5 h-3.5" /> Aprobar e Imputar
                                          </button>
                                          <button
                                              onClick={() => handleRejectPending(p)}
                                              className="px-3 py-1.5 bg-red-50 text-red-600 font-bold text-xs rounded-lg hover:bg-red-100 transition-colors border border-red-200 flex items-center gap-1"
                                          >
                                              <XCircle className="w-3.5 h-3.5" /> Rechazar
                                          </button>
                                      </div>
                                  </td>
                              </tr>
                          );
                      })}
                      {pendingPayments.length === 0 && (
                          <tr>
                              <td colSpan={6} className="p-10 text-center text-slate-400 font-medium">
                                  No hay pagos pendientes de aprobación.
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      )}

      {activeTab === 'historial' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                        <th className="p-4 font-bold">Fecha</th>
                        <th className="p-4 font-bold">Unidad</th>
                        <th className="p-4 font-bold text-right">Monto</th>
                        <th className="p-4 font-bold text-right">Aporte Reserva</th>
                        <th className="p-4 font-bold">Método</th>
                        <th className="p-4 font-bold">Notas</th>
                        <th className="p-4 font-bold text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {approvedPayments.map(p => {
                        const unit = units.find(u => u.id === p.unitId);
                        const isOccupied = doesUnitContributeToReserve(unit);
                        return (
                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 text-sm font-medium text-slate-700">{formatLocalDate(p.date)}</td>
                                <td className="p-4">
                                    <div className="flex items-center gap-1.5">
                                        <p className="font-bold text-slate-800">{unit?.unitNumber}</p>
                                        {!isOccupied && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">Libre</span>}
                                    </div>
                                    <p className="text-xs text-slate-500">{unit?.ownerName}</p>
                                </td>
                                <td className="p-4 font-black text-indigo-600 text-right">{formatCurrency(p.amount)}</td>
                                <td className="p-4 text-right text-xs font-bold text-emerald-600">
                                    {p.reserveContribution !== undefined
                                        ? (p.reserveContribution > 0 ? formatCurrency(p.reserveContribution) : 'Exento / $0')
                                        : (!isOccupied ? 'Exento ($0)' : '-')}
                                </td>
                                <td className="p-4 text-sm text-slate-600">{p.method}</td>
                                <td className="p-4 text-xs text-slate-500 max-w-[200px] truncate" title={p.notes}>{p.notes || '-'}</td>
                                <td className="p-4 text-center">
                                    <button 
                                        onClick={() => {
                                            if(confirm('ATENCIÓN: Se anulará este cobro.\n\n- Se descontará de los ingresos.\n- Si este pago destinó fondos a la Reserva, se debitarán automáticamente.\n- Se restaurarán las deudas e importes imputados a la unidad.\n\n¿Estás seguro?')) {
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
                    {approvedPayments.length === 0 && (
                        <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">No hay cobros registrados todavía.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      )}

      {showPayModal && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 max-h-[92vh] flex flex-col">
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                      <div>
                          <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest">
                              {approvingPayment ? 'Aprobar e Imputar Pago de Vecino' : 'Registrar Ingreso'}
                          </p>
                          <div className="flex items-center gap-2">
                              <h3 className="text-xl font-black">{showPayModal.unitNumber} - {showPayModal.ownerName}</h3>
                              {!doesUnitContributeToReserve(showPayModal) && (
                                  <span className="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                      Local Libre (Sin Reserva)
                                  </span>
                              )}
                          </div>
                      </div>
                      <button onClick={() => { setShowPayModal(null); setApprovingPayment(null); }} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X/></button>
                  </div>

                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto">
                      <div>
                          <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-indigo-500"/> ¿Qué meses está pagando?
                          </h4>
                          <p className="text-[11px] text-slate-400 mb-3">
                              Si no marcás ninguno, el sistema imputa automáticamente desde la deuda más antigua.
                          </p>
                          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-2 custom-scrollbar">
                              
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
                                              <p className="text-[10px] text-slate-500">
                                                  Base: {formatCurrency(debt.baseAmount)}
                                                  {debt.interestAmount > 0 ? ` + Mora: ${formatCurrency(debt.interestAmount)}` : ''}
                                              </p>
                                          </div>
                                      </div>
                                      <span className="font-bold text-sm">{formatCurrency(debt.total)}</span>
                                  </div>
                              )})}

                              {selectedDebtIds.length === 0 && (showPayModal.initialBalance === 0 && (showPayModal.debts?.length || 0) === 0) && (
                                  <p className="text-center py-8 text-slate-400 text-sm italic">
                                      No registra deudas pendientes. El cobro ingresará como Saldo a Favor.
                                  </p>
                              )}
                          </div>

                          {/* DESGLOSE EN VIVO DE CONTABILIDAD DEL PAGO */}
                          {payAmount > 0 && (
                              <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                                  <p className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">Desglose Contable del Cobro</p>
                                  <div className="flex justify-between text-slate-600">
                                      <span>Capital Expensas cubierto:</span>
                                      <span className="font-bold">{formatCurrency(allocationPreview.baseToPay)}</span>
                                  </div>
                                  {allocationPreview.interestToPay > 0 && (
                                      <div className="flex justify-between text-amber-700">
                                          <span>Intereses por Mora (No va a reserva):</span>
                                          <span className="font-bold">{formatCurrency(allocationPreview.interestToPay)}</span>
                                      </div>
                                  )}
                                  <div className="flex justify-between text-emerald-700 pt-1 border-t border-slate-200">
                                      <span>Aporte a Fondo de Reserva:</span>
                                      <span className="font-black">
                                          {doesUnitContributeToReserve(showPayModal)
                                              ? formatCurrency(allocationPreview.reserveToCredit)
                                              : 'Exento ($0,00)'}
                                      </span>
                                  </div>
                                  {allocationPreview.surplusCredit > 0 && (
                                      <div className="flex justify-between text-indigo-700 bg-indigo-50 p-1.5 rounded-lg border border-indigo-100 mt-1">
                                          <span className="font-bold flex items-center gap-1"><Sparkles className="w-3.5 h-3.5"/> Nuevo Saldo a Favor:</span>
                                          <span className="font-black">+{formatCurrency(allocationPreview.surplusCredit)}</span>
                                      </div>
                                  )}
                              </div>
                          )}
                      </div>

                      <div>
                          <div className="space-y-4">
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto a Cobrar</label>
                                  <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-indigo-600">$</span>
                                      <input 
                                          type="number" 
                                          step="0.01"
                                          className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xl font-black text-indigo-700" 
                                          value={payAmount || ''}
                                          onChange={e => setPayAmount(parseFloat(e.target.value) || 0)}
                                      />
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-1">
                                      Si abona de más, el excedente queda como Saldo a Favor de la unidad.
                                  </p>
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
                                  <textarea className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" rows={2} placeholder="Nro de transacción, quién pagó..." value={payNotes} onChange={e => setPayNotes(e.target.value)} />
                              </div>

                              {approvingPayment?.attachmentUrl && (
                                  <a
                                      href={approvingPayment.attachmentUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center justify-center gap-2 w-full py-2.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 hover:bg-indigo-100 transition-colors"
                                  >
                                      <ExternalLink className="w-4 h-4" /> Ver Comprobante Subido por el Vecino
                                  </a>
                              )}
                          </div>
                      </div>
                  </div>

                  <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                      <button onClick={() => { setShowPayModal(null); setApprovingPayment(null); }} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
                      <button 
                        onClick={handleConfirmPayment}
                        disabled={payAmount <= 0 || isProcessing}
                        className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50"
                      >
                          {isProcessing ? 'Procesando...' : (approvingPayment ? 'Aprobar e Imputar Cobro' : 'Confirmar Cobro')}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default CollectionsView;