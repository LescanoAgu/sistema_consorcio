import { getLocalIsoDate, formatLocalDate } from '../utils/dateUtils';
import React, { useState, useMemo } from 'react';
import { ReserveTransaction, Consortium, ConsortiumSettings, Payment } from '../types';
import { Plus, Download, Trash2, FileSpreadsheet, Vault, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Wrench } from 'lucide-react';
import { generateReserveLedgerPDF } from '../services/pdfService';
import * as XLSX from 'xlsx';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
};

interface ReserveViewProps {
  transactions: ReserveTransaction[];
  consortium: Consortium;
  onAddTransaction: (t: Omit<ReserveTransaction, 'id'>) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  settings: ConsortiumSettings;
  payments: Payment[];
}

const ReserveView: React.FC<ReserveViewProps> = ({ transactions, consortium, onAddTransaction, onDeleteTransaction, settings, payments }) => {
  const [showModal, setShowModal] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState(getLocalIsoDate());
  const [type, setType] = useState<'IN' | 'OUT'>('IN');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calcula el saldo arrastrado fila por fila
  const ledgerData = useMemo(() => {
      const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      let runningBalance = 0;
      return sorted.map(t => {
          runningBalance += t.amount;
          return { ...t, runningBalance };
      }).reverse();
  }, [transactions]);

  const currentBalance = ledgerData.length > 0 ? ledgerData[0].runningBalance : 0;

  // ──────────────────────────────────────────────────
  // DIAGNÓSTICO AUTOMÁTICO DE CONSISTENCIA
  // Compara lo que el sistema acreditó automáticamente (tipo SYSTEM)
  // contra lo que DEBERÍA haber acreditado según los cobros reales aprobados.
  // ──────────────────────────────────────────────────
  const diagnostic = useMemo(() => {
    const rate = settings.monthlyReserveContributionPercentage;
    if (rate <= 0) return null;

    // 1. Lo que el sistema acreditó automáticamente (transacciones SYSTEM positivas)
    const systemCreditTotal = transactions
      .filter(t => t.type === 'SYSTEM' && t.amount > 0)
      .reduce((acc, t) => acc + t.amount, 0);

    // 2. Lo que DEBERÍA haber acreditado con la fórmula correcta: pago × rate/(100+rate)
    const approvedPaymentsTotal = payments
      .filter(p => p.status === 'APPROVED')
      .reduce((acc, p) => acc + p.amount, 0);
    const expectedSystemCredit = approvedPaymentsTotal * (rate / (100 + rate));

    // 3. Diferencia (positivo = sobre-acreditado; negativo = sub-acreditado)
    const discrepancy = systemCreditTotal - expectedSystemCredit;

    return {
      systemCreditTotal,
      expectedSystemCredit,
      approvedPaymentsTotal,
      discrepancy,
      isOver: discrepancy > 0.5,
      isUnder: discrepancy < -0.5,
    };
  }, [transactions, payments, settings]);

  const handleApplyCorrection = async () => {
    if (!diagnostic) return;
    const adj = -diagnostic.discrepancy;
    const desc = adj > 0
      ? 'Corrección automática: sub-acreditación histórica'
      : 'Corrección automática: sobre-acreditación histórica';
    if (!confirm(
      'Se registrará un ajuste de ' + formatCurrency(Math.abs(adj)) +
      ' (' + (adj > 0 ? 'INGRESO' : 'EGRESO') + ') para corregir el saldo del fondo de reserva.' +
      '\n\nEsto deja el libro mayor en línea con los cobros reales aprobados.' +
      '\n\n¿Confirmar?'
    )) return;
    setIsSubmitting(true);
    try {
      await onAddTransaction({ date: getLocalIsoDate(), description: desc, amount: adj, type: 'MANUAL' });
    } catch { alert('Error al registrar el ajuste.'); }
    finally { setIsSubmitting(false); }
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
              <p className="text-slate-500">Historial completo de ingresos y egresos de la caja de ahorro.</p>
          </div>
          <div className="text-right bg-white px-6 py-3 rounded-xl shadow-sm border border-amber-100">
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Saldo Actual Disponible</p>
              <p className={`text-2xl font-black ${currentBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(currentBalance)}
              </p>
          </div>
      </div>

      {/* ── PANEL DE DIAGNÓSTICO DE CONSISTENCIA ── */}
      {diagnostic && diagnostic.isOver && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5 text-red-600" />
            <div className="flex-1">
              <h3 className="font-black text-lg text-red-700">
                Fondo Sobre-Acreditado — Exceso histórico detectado
              </h3>
              <p className="text-sm text-slate-600 mt-1 mb-4">
                El sistema detectó que se acreditó más de lo que corresponde según los cobros aprobados.
                Esto ocurre cuando una versión anterior del sistema usaba una fórmula incorrecta
                o acreditaba al cerrar la liquidación además de al cobrar.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-slate-500 uppercase font-bold">Total cobros aprobados</p>
                  <p className="text-lg font-black text-slate-800">{formatCurrency(diagnostic.approvedPaymentsTotal)}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-slate-500 uppercase font-bold">Acreditado por sistema</p>
                  <p className="text-lg font-black text-indigo-700">{formatCurrency(diagnostic.systemCreditTotal)}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Correcto: {formatCurrency(diagnostic.expectedSystemCredit)}</p>
                </div>
                <div className="rounded-lg p-3 border-2 bg-red-100 border-red-300">
                  <p className="text-xs uppercase font-bold text-slate-600">Exceso a corregir</p>
                  <p className="text-lg font-black text-red-700">{formatCurrency(Math.abs(diagnostic.discrepancy))}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{settings.monthlyReserveContributionPercentage}% de cobros reales</p>
                </div>
              </div>
              <button
                onClick={handleApplyCorrection}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 font-bold rounded-lg transition-colors text-white shadow-md bg-red-600 hover:bg-red-700 shadow-red-200 disabled:opacity-50"
              >
                <Wrench className="w-4 h-4" />
                Aplicar Corrección Automática ({formatCurrency(Math.abs(diagnostic.discrepancy))})
              </button>
            </div>
          </div>
        </div>
      )}

      {diagnostic && diagnostic.isUnder && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5 text-amber-600" />
            <div className="flex-1">
              <h3 className="font-black text-lg text-amber-700">Fondo Sub-Acreditado</h3>
              <p className="text-sm text-slate-600 mt-1 mb-4">
                El saldo es menor al esperado según los cobros aprobados. Posiblemente faltaron acreditar algunos cobros.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-slate-500 uppercase font-bold">Total cobros aprobados</p>
                  <p className="text-lg font-black text-slate-800">{formatCurrency(diagnostic.approvedPaymentsTotal)}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-slate-500 uppercase font-bold">Acreditado por sistema</p>
                  <p className="text-lg font-black text-indigo-700">{formatCurrency(diagnostic.systemCreditTotal)}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Esperado: {formatCurrency(diagnostic.expectedSystemCredit)}</p>
                </div>
                <div className="rounded-lg p-3 border-2 bg-amber-100 border-amber-300">
                  <p className="text-xs uppercase font-bold text-slate-600">Faltante a acreditar</p>
                  <p className="text-lg font-black text-amber-700">{formatCurrency(Math.abs(diagnostic.discrepancy))}</p>
                </div>
              </div>
              <button
                onClick={handleApplyCorrection}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 font-bold rounded-lg transition-colors text-white shadow-md bg-amber-500 hover:bg-amber-600 shadow-amber-200 disabled:opacity-50"
              >
                <Wrench className="w-4 h-4" />
                Aplicar Corrección Automática (+{formatCurrency(Math.abs(diagnostic.discrepancy))})
              </button>
            </div>
          </div>
        </div>
      )}

      {diagnostic && !diagnostic.isOver && !diagnostic.isUnder && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-medium text-emerald-800">
            El saldo del fondo es consistente con los cobros aprobados
            ({settings.monthlyReserveContributionPercentage}% sobre {formatCurrency(diagnostic.approvedPaymentsTotal)} cobrados = {formatCurrency(diagnostic.expectedSystemCredit)}).
          </p>
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
