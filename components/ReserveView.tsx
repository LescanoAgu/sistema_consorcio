import { getLocalIsoDate, formatLocalDate } from '../utils/dateUtils';
import React, { useState, useMemo } from 'react';
import { ReserveTransaction, Consortium, ConsortiumSettings, Payment, Unit, SettlementRecord } from '../types';
import { Plus, Download, Trash2, FileSpreadsheet, Vault, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Wrench, RefreshCw } from 'lucide-react';
import { generateReserveLedgerPDF } from '../services/pdfService';
import { reconcileReserveTransactionsBatch, updatePayment } from '../services/firestoreService';
import { analyzePaymentReserve } from '../utils/reserveAccounting';
import * as XLSX from 'xlsx';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
};

interface ReserveViewProps {
  transactions: ReserveTransaction[];
  consortium: Consortium;
  onAddTransaction: (t: Omit<ReserveTransaction, 'id'>) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onRefreshTransactions?: () => Promise<void>;
  settings: ConsortiumSettings;
  payments: Payment[];
  units?: Unit[];
  history?: SettlementRecord[];
}

const ReserveView: React.FC<ReserveViewProps> = ({
  transactions,
  consortium,
  onAddTransaction,
  onDeleteTransaction,
  onRefreshTransactions,
  settings,
  payments,
  units = [],
  history = []
}) => {
  const [showModal, setShowModal] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState(getLocalIsoDate());
  const [type, setType] = useState<'IN' | 'OUT'>('IN');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  // Calcula el saldo arrastrado fila por fila
  const ledgerData = useMemo(() => {
      const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      let runningBalance = 0;
      return sorted.map(t => {
          runningBalance = Number((runningBalance + t.amount).toFixed(2));
          return { ...t, runningBalance };
      }).reverse();
  }, [transactions]);

  const currentBalance = ledgerData.length > 0 ? ledgerData[0].runningBalance : 0;

  // ──────────────────────────────────────────────────
  // AUDITORÍA Y DIAGNÓSTICO CONTABLE DEL FONDO DE RESERVA
  // Excluye intereses por mora, locales libres y gastos extraordinarios
  // ──────────────────────────────────────────────────
  const diagnostic = useMemo(() => {
    const rate = settings.monthlyReserveContributionPercentage;
    if (rate <= 0) return null;

    const approvedPayments = payments.filter(p => p.status === 'APPROVED');
    const breakdowns = approvedPayments.map(p => analyzePaymentReserve(p, units, history, settings));

    const approvedPaymentsTotal = Number(breakdowns.reduce((acc, b) => acc + b.totalPaid, 0).toFixed(2));
    const totalInterestInPayments = Number(breakdowns.reduce((acc, b) => acc + b.interestPaid, 0).toFixed(2));
    const totalFreeUnitsPayments = Number(breakdowns.filter(b => !b.isOccupied).reduce((acc, b) => acc + b.totalPaid, 0).toFixed(2));
    const expectedSystemCredit = Number(breakdowns.reduce((acc, b) => acc + b.expectedReserveContribution, 0).toFixed(2));
    const naiveSystemCredit = Number(breakdowns.reduce((acc, b) => acc + b.naiveReserveContribution, 0).toFixed(2));

    // Movimientos en el libro mayor generados por cobros (SYSTEM de cobros + parches automáticos previos)
    const cobroSystemTxs = transactions.filter(
      t =>
        (t.type === 'SYSTEM' && (t.description.includes('Cobro') || t.amount > 0) && !t.description.includes('Gasto')) ||
        t.description.includes('Corrección automática:')
    );

    const systemCreditTotal = Number(cobroSystemTxs.reduce((acc, t) => acc + t.amount, 0).toFixed(2));
    const discrepancy = Number((systemCreditTotal - expectedSystemCredit).toFixed(2));

    // Verificar si hay transacciones individuales de cobro cuyo monto difiere del esperado sin mora
    let misalignedTxCount = 0;
    breakdowns.forEach(b => {
      const suffix = `(${b.paymentId.slice(-4)})`;
      const tx = transactions.find(
        t => t.paymentId === b.paymentId || (t.type === 'SYSTEM' && t.description.includes(suffix) && t.amount > 0)
      );
      if (tx && Math.abs(tx.amount - b.expectedReserveContribution) > 0.05) {
        misalignedTxCount++;
      } else if (!tx && b.expectedReserveContribution > 0.05) {
        misalignedTxCount++;
      }
    });

    return {
      breakdowns,
      approvedPayments,
      approvedPaymentsTotal,
      totalInterestInPayments,
      totalFreeUnitsPayments,
      systemCreditTotal,
      expectedSystemCredit,
      naiveSystemCredit,
      discrepancy,
      misalignedTxCount,
      isOver: discrepancy > 0.5,
      isUnder: discrepancy < -0.5,
      needsCleanup: Math.abs(discrepancy) > 0.5 || misalignedTxCount > 0
    };
  }, [transactions, payments, units, history, settings]);

  /**
   * Acomoda y corrige por código todas las transacciones de cobro en el Libro Mayor:
   * 1. Recalcula cada cobro aprobado descontando los intereses por mora, gastos extraordinarios y locales libres.
   * 2. Actualiza directamente cada movimiento "Aporte Reserva de Cobro" en Firestore con su monto exacto sin mora.
   * 3. Elimina acreditaciones erróneas de locales desocupados o parches manuales duplicados.
   */
  const handleReconcileReserveByCode = async () => {
    if (!diagnostic) return;

    const msgLines = [
      '¿Ejecutar la corrección y saneamiento automático de la Caja de Reserva?',
      '',
      `• Total cobros aprobados: ${formatCurrency(diagnostic.approvedPaymentsTotal)}`,
      `• Intereses por mora detectados (NO van a reserva): ${formatCurrency(diagnostic.totalInterestInPayments)}`,
      `• Cobros de locales libres/exentos (NO van a reserva): ${formatCurrency(diagnostic.totalFreeUnitsPayments)}`,
      `• Acreditado actualmente en caja por cobros: ${formatCurrency(diagnostic.systemCreditTotal)}`,
      `• Aporte real exacto que corresponde a Reserva: ${formatCurrency(diagnostic.expectedSystemCredit)}`,
      `• Diferencia a acomodar: ${formatCurrency(diagnostic.discrepancy)}`,
      '',
      'El sistema actualizará los asientos de cobro en el Libro Mayor para que reflejen únicamente el porcentaje sobre expensas ordinarias sin mora.'
    ];

    if (!confirm(msgLines.join('\n'))) return;

    setIsReconciling(true);
    try {
      const updates: { id: string; amount: number; description?: string }[] = [];
      const toDeleteIds: string[] = [];
      const toAddList: Omit<ReserveTransaction, 'id'>[] = [];
      const matchedTxIds = new Set<string>();

      // 1. Eliminar parches viejos de "Corrección automática" para dejar el Libro Mayor limpio asiento por asiento
      transactions.forEach(t => {
        if (t.description.includes('Corrección automática:')) {
          toDeleteIds.push(t.id);
          matchedTxIds.add(t.id);
        }
      });

      // 2. Alinear cada cobro aprobado con su asiento en reserve_transactions
      for (const b of diagnostic.breakdowns) {
        const payment = diagnostic.approvedPayments.find(p => p.id === b.paymentId);
        const suffix = `(${b.paymentId.slice(-4)})`;

        // Buscar todas las transacciones SYSTEM positivas asociadas a este cobro
        const matchingTxs = transactions.filter(
          t =>
            !matchedTxIds.has(t.id) &&
            t.type === 'SYSTEM' &&
            t.amount > 0 &&
            (t.paymentId === b.paymentId || t.description.includes(suffix))
        );

        if (b.expectedReserveContribution <= 0.01) {
          // Local libre o cobro sin base ordinaria -> no debe existir acreditación en reserva
          matchingTxs.forEach(t => {
            toDeleteIds.push(t.id);
            matchedTxIds.add(t.id);
          });
        } else if (matchingTxs.length > 0) {
          const primaryTx = matchingTxs[0];
          matchedTxIds.add(primaryTx.id);
          const cleanDesc = b.interestPaid > 0
            ? `Aporte Reserva UF ${b.unitNumber} ${suffix} (Sin Mora)`
            : `Aporte Reserva UF ${b.unitNumber} ${suffix}`;

          if (Math.abs(primaryTx.amount - b.expectedReserveContribution) > 0.01 || primaryTx.description !== cleanDesc) {
            updates.push({
              id: primaryTx.id,
              amount: b.expectedReserveContribution,
              description: cleanDesc
            });
          }

          // Si había duplicados del mismo cobro, eliminarlos
          matchingTxs.slice(1).forEach(dup => {
            toDeleteIds.push(dup.id);
            matchedTxIds.add(dup.id);
          });
        } else {
          // Faltaba el asiento de este cobro aprobado
          const cleanDesc = b.interestPaid > 0
            ? `Aporte Reserva UF ${b.unitNumber} ${suffix} (Sin Mora)`
            : `Aporte Reserva UF ${b.unitNumber} ${suffix}`;
          toAddList.push({
            date: payment?.date || getLocalIsoDate(),
            amount: b.expectedReserveContribution,
            description: cleanDesc,
            type: 'SYSTEM',
            paymentId: b.paymentId
          });
        }

        // Actualizar también el campo informativo reserveContribution en el documento Payment si difiere
        if (payment && Math.abs((payment.reserveContribution ?? -1) - b.expectedReserveContribution) > 0.01) {
          try {
            await updatePayment(consortium.id, payment.id, { reserveContribution: b.expectedReserveContribution });
          } catch {
            // Ignorar si falla actualización individual de metadata
          }
        }
      }

      // 3. Revisar si quedaron transacciones SYSTEM de cobros huérfanas (de pagos borrados o reversiones viejas)
      const orphanSystemCobroTxs = transactions.filter(
        t =>
          !matchedTxIds.has(t.id) &&
          t.type === 'SYSTEM' &&
          (t.description.includes('Aporte Reserva de Cobro') || t.description.includes('Reversión de Cobro'))
      );
      orphanSystemCobroTxs.forEach(t => {
        toDeleteIds.push(t.id);
      });

      await reconcileReserveTransactionsBatch(consortium.id, updates, toDeleteIds, toAddList);

      if (onRefreshTransactions) {
        await onRefreshTransactions();
      }

      alert(
        `¡Caja de Fondo de Reserva corregida y acomodada exitosamente!\n\n` +
        `• Asientos corregidos (mora descontada): ${updates.length}\n` +
        `• Asientos excedentes/locales libres depurados: ${toDeleteIds.length}\n` +
        `• Asientos faltantes generados: ${toAddList.length}`
      );
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error al acomodar la caja de reserva.');
    } finally {
      setIsReconciling(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newDesc || !newAmount) return;
      setIsSubmitting(true);
      try {
          let finalAmount = Math.abs(parseFloat(newAmount));
          if (type === 'OUT') finalAmount = -finalAmount;
          await onAddTransaction({ date: newDate, description: newDesc, amount: finalAmount, type: 'MANUAL' });
          setShowModal(false);
          setNewDesc(''); setNewAmount('');
      } catch { alert('Error al registrar el movimiento.'); }
      finally { setIsSubmitting(false); }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!confirm("Se importarán movimientos históricos al Fondo de Reserva. Columnas: 'Fecha', 'Concepto', 'Ingreso', 'Egreso'.")) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const bstr = evt.target?.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
              let count = 0;
              for (const row of (data as any[])) {
                  const desc = row['Concepto'] || row['Descripcion'];
                  const ingreso = parseFloat(row['Ingreso'] || 0);
                  const egreso = parseFloat(row['Egreso'] || 0);
                  const date = row['Fecha'] ? getLocalIsoDate(new Date(row['Fecha'])) : getLocalIsoDate();
                  if (desc && (ingreso > 0 || egreso > 0)) {
                      await onAddTransaction({ date, description: String(desc), amount: ingreso > 0 ? ingreso : -egreso, type: 'INITIAL' });
                      count++;
                  }
              }
              alert('Importacion exitosa! ' + count + ' movimientos cargados.');
          } catch { alert('Error al procesar el Excel.'); }
          finally { e.target.value = ''; }
      };
      reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <Vault className="w-6 h-6 text-amber-500" /> Libro Mayor: Fondo de Reserva
              </h2>
              <p className="text-slate-500">Historial completo de ingresos y egresos de la caja de ahorro (sin intereses por mora ni locales libres).</p>
          </div>
          <div className="flex items-center gap-3">
              <div className="text-right bg-white px-6 py-3 rounded-xl shadow-sm border border-amber-100">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Saldo Actual Disponible</p>
                  <p className={`text-2xl font-black ${currentBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(currentBalance)}
                  </p>
              </div>
          </div>
      </div>

      {/* ── PANEL DE RESUMEN Y REPARACIÓN DE COBROS CON MORA / LOCALES LIBRES ── */}
      {diagnostic && (
        <div className={`rounded-xl border-2 p-5 ${diagnostic.needsCleanup ? 'border-amber-300 bg-amber-50/80' : 'border-emerald-200 bg-emerald-50/70'}`}>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
            <div className="flex items-start gap-3">
              {diagnostic.needsCleanup ? (
                <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5 text-amber-600" />
              ) : (
                <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5 text-emerald-600" />
              )}
              <div>
                <h3 className={`font-black text-lg ${diagnostic.needsCleanup ? 'text-amber-900' : 'text-emerald-900'}`}>
                  {diagnostic.needsCleanup
                    ? 'Ajuste Pendiente en Cobros con Mora / Unidades Exentas'
                    : 'Caja de Reserva Alineada (Libre de Intereses por Mora)'}
                </h3>
                <p className="text-sm text-slate-600 mt-0.5">
                  El Fondo de Reserva ({settings.monthlyReserveContributionPercentage}%) se calcula exclusivamente sobre las expensas ordinarias cobradas de unidades ocupadas, excluyendo intereses por mora y locales libres.
                </p>
              </div>
            </div>

            <button
              onClick={handleReconcileReserveByCode}
              disabled={isReconciling}
              className={`flex items-center gap-2 px-5 py-2.5 font-bold rounded-xl transition-all text-white shadow-md whitespace-nowrap disabled:opacity-50 ${
                diagnostic.needsCleanup
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
              }`}
            >
              {isReconciling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
              {isReconciling
                ? 'Acomodando Caja...'
                : 'Corregir Cobros con Mora y Acomodar Caja'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <p className="text-[11px] text-slate-500 uppercase font-bold">Total Cobros Aprobados</p>
              <p className="text-lg font-black text-slate-800">{formatCurrency(diagnostic.approvedPaymentsTotal)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{diagnostic.approvedPayments.length} cobros registrados</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <p className="text-[11px] text-amber-700 uppercase font-bold">Mora + Locales Libres Excluidos</p>
              <p className="text-lg font-black text-amber-600">
                {formatCurrency(diagnostic.totalInterestInPayments + diagnostic.totalFreeUnitsPayments)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Mora: {formatCurrency(diagnostic.totalInterestInPayments)} | Libres: {formatCurrency(diagnostic.totalFreeUnitsPayments)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <p className="text-[11px] text-slate-500 uppercase font-bold">Acreditado en Caja (Cobros)</p>
              <p className="text-lg font-black text-indigo-700">{formatCurrency(diagnostic.systemCreditTotal)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Suma actual de asientos de cobro</p>
            </div>
            <div className={`rounded-lg p-3 border ${diagnostic.needsCleanup ? 'bg-amber-100/80 border-amber-300' : 'bg-emerald-100/70 border-emerald-300'}`}>
              <p className="text-[11px] uppercase font-bold text-slate-700">Reserva Exacta Correspondiente</p>
              <p className="text-lg font-black text-emerald-700">{formatCurrency(diagnostic.expectedSystemCredit)}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">
                {Math.abs(diagnostic.discrepancy) > 0.05
                  ? `Diferencia a ajustar: ${formatCurrency(diagnostic.discrepancy)}`
                  : 'Sin diferencias pendientes'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center bg-slate-50 gap-3">
              <div className="flex gap-2 flex-wrap">
                  <button onClick={() => generateReserveLedgerPDF(ledgerData, consortium)} className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors shadow-sm">
                      <Download className="w-4 h-4"/> Exportar PDF
                  </button>
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-bold hover:bg-emerald-100 transition-colors shadow-sm">
                      <FileSpreadsheet className="w-4 h-4"/> Importar Histórico
                      <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} />
                  </label>
              </div>
              <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 transition-colors shadow-sm shadow-amber-200">
                  <Plus className="w-4 h-4"/> Ajuste Manual
              </button>
          </div>

          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                      <tr>
                          <th className="px-6 py-4">Fecha</th>
                          <th className="px-6 py-4">Concepto</th>
                          <th className="px-6 py-4 text-right">Ingreso (+)</th>
                          <th className="px-6 py-4 text-right">Egreso (-)</th>
                          <th className="px-6 py-4 text-right">Saldo</th>
                          <th className="px-4 py-4 text-center">Acción</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {ledgerData.length === 0 && (
                          <tr><td colSpan={6} className="text-center py-12 text-slate-400">No hay movimientos registrados en el fondo de reserva.</td></tr>
                      )}
                      {ledgerData.map(t => (
                          <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-3 text-slate-500 font-medium w-32">{formatLocalDate(t.date)}</td>
                              <td className="px-6 py-3 font-bold text-slate-700">
                                  <div className="flex items-center gap-2">
                                      {t.type === 'SYSTEM' && <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded uppercase flex-shrink-0">Sistema</span>}
                                      {t.type === 'MANUAL' && <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded uppercase flex-shrink-0">Manual</span>}
                                      {t.type === 'INITIAL' && <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded uppercase flex-shrink-0">Histórico</span>}
                                      <span>{t.description}</span>
                                  </div>
                              </td>
                              <td className="px-6 py-3 text-right font-bold text-emerald-600">
                                  {t.amount > 0 ? formatCurrency(t.amount) : '-'}
                              </td>
                              <td className="px-6 py-3 text-right font-bold text-red-600">
                                  {t.amount < 0 ? formatCurrency(Math.abs(t.amount)) : '-'}
                              </td>
                              <td className="px-6 py-3 text-right font-black text-slate-800 bg-slate-50">
                                  {formatCurrency(t.runningBalance)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                  <button onClick={() => { if(confirm('Eliminar este registro? Alterará el saldo actual.')) onDeleteTransaction(t.id); }} className="text-slate-400 hover:text-red-500 p-1 transition-colors">
                                      <Trash2 className="w-4 h-4"/>
                                  </button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>

      {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                  <div className="bg-amber-500 p-4 text-white">
                      <h3 className="font-bold flex items-center gap-2"><Vault className="w-5 h-5"/> Ajuste Manual de Reserva</h3>
                  </div>
                  <form onSubmit={handleManualAdd} className="p-6 space-y-4">
                      <div className="flex gap-2 p-1 bg-slate-100 rounded-lg mb-4">
                          <button type="button" onClick={() => setType('IN')} className={`flex-1 py-2 flex items-center justify-center gap-2 text-sm font-bold rounded-md transition-all ${type === 'IN' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>
                              <TrendingUp className="w-4 h-4"/> Ingreso
                          </button>
                          <button type="button" onClick={() => setType('OUT')} className={`flex-1 py-2 flex items-center justify-center gap-2 text-sm font-bold rounded-md transition-all ${type === 'OUT' ? 'bg-white shadow text-red-600' : 'text-slate-500 hover:text-slate-700'}`}>
                              <TrendingDown className="w-4 h-4"/> Egreso
                          </button>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Concepto / Descripción</label>
                          <input type="text" className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-amber-500" placeholder="Ej: Saldo Inicial / Ajuste de caja" value={newDesc} onChange={e => setNewDesc(e.target.value)} required />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Monto ($)</label>
                              <input type="number" step="0.01" className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-amber-500 font-bold" placeholder="0.00" value={newAmount} onChange={e => setNewAmount(e.target.value)} required />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                              <input type="date" className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-amber-500" value={newDate} onChange={e => setNewDate(e.target.value)} required />
                          </div>
                      </div>
                      <div className="flex gap-3 pt-4 border-t border-slate-100 mt-2">
                          <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                          <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 shadow-lg shadow-amber-200 transition-colors">Guardar</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default ReserveView;
