import React, { useMemo, useState } from 'react';
import { Unit, Expense, SettlementRecord, Payment, ConsortiumSettings } from '../types';
import { CheckCircle, AlertCircle, TrendingUp, Download, Building, Users, Upload, X, Paperclip } from 'lucide-react';

interface UserPortalProps {
  userEmail: string;
  units: Unit[];
  expenses: Expense[];
  history: SettlementRecord[];
  payments: Payment[];
  settings: ConsortiumSettings;
  onReportPayment: (paymentData: { amount: number, date: string, method: 'Transferencia' | 'Efectivo' | 'Cheque', notes: string, file: File | null }) => Promise<void>;
}

const UserPortal: React.FC<UserPortalProps> = ({ userEmail, units, expenses, history, payments, settings, onReportPayment }) => {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // 1. Identify User's Unit
  const myUnit = useMemo(() => {
    return units.find(u => u.linkedEmail === userEmail) || units.find(u => u.ownerName === 'Usuario Demo') || units[0];
  }, [units, userEmail]);

  // 2. Calculate Financial Status
  const status = useMemo(() => {
    if (!myUnit) return null;
    const initial = myUnit.initialBalance || 0;
    const totalSettled = history.reduce((acc, record) => {
        const detail = record.unitDetails?.find(d => d.unitId === myUnit.id);
        return acc + (detail ? detail.totalToPay : 0);
    }, 0);
    // Solo restamos pagos aprobados para el saldo real
    const validPayments = payments.filter(p => p.unitId === myUnit.id && p.status === 'APPROVED');
    const totalPaid = validPayments.reduce((acc, p) => acc + p.amount, 0);
    
    const balance = (initial + totalSettled) - totalPaid;
    return { balance, totalPaid };
  }, [myUnit, history, payments]);

  // 3. Pending Payments
  const myPendingPayments = useMemo(() => {
      if(!myUnit) return [];
      return payments.filter(p => p.unitId === myUnit.id && p.status === 'PENDING');
  }, [payments, myUnit]);

  // 4. All Debtors (Solo pagos aprobados cuentan para reducir deuda pública)
  const allDebtors = useMemo(() => {
      return units.map(unit => {
        const initial = unit.initialBalance || 0;
        const totalSettled = history.reduce((acc, record) => {
            const detail = record.unitDetails?.find(d => d.unitId === unit.id);
            return acc + (detail ? detail.totalToPay : 0);
        }, 0);
        const totalPaid = payments.filter(p => p.unitId === unit.id && p.status === 'APPROVED').reduce((acc, p) => acc + p.amount, 0);
        const balance = (initial + totalSettled) - totalPaid;
        return { ...unit, balance };
      }).filter(u => u.balance > 100).sort((a, b) => b.balance - a.balance);
  }, [units, history, payments]);

  const handleSubmitPayment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!amount) return;
      setIsSubmitting(true);
      try {
          await onReportPayment({
              amount: parseFloat(amount),
              date,
              method: 'Transferencia',
              notes,
              file
          });
          setShowPaymentModal(false);
          setAmount('');
          setNotes('');
          setFile(null);
          alert("Pago informado exitosamente. Quedará pendiente de aprobación.");
      } catch (error) {
          console.error(error);
          alert("Error al informar el pago.");
      } finally {
          setIsSubmitting(false);
      }
  };

  if (!myUnit) return <div className="text-center p-10">No se encontró unidad asociada a {userEmail}</div>;

  return (
    <div className="space-y-6 relative">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">Hola, {myUnit.ownerName}</h2>
            <p className="opacity-90">Unidad: <strong>{myUnit.unitNumber}</strong></p>
          </div>
          <button 
            onClick={() => setShowPaymentModal(true)}
            className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-bold shadow hover:bg-indigo-50 transition-colors flex items-center gap-2"
          >
              <Upload className="w-5 h-5" />
              Informar Pago
          </button>
      </div>

      {/* MODAL DE PAGO */}
      {showPaymentModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                      <h3 className="font-bold text-slate-700">Informar Nuevo Pago</h3>
                      <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6"/></button>
                  </div>
                  <form onSubmit={handleSubmitPayment} className="p-6 space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Monto Abonado ($)</label>
                          <input required type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0.00" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Transferencia</label>
                          <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Comprobante (Imagen/PDF)</label>
                          <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:bg-slate-50 transition-colors relative">
                              <input 
                                type="file" 
                                accept="image/*,application/pdf"
                                onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              />
                              <div className="flex flex-col items-center gap-2 text-slate-500">
                                  {file ? (
                                      <>
                                        <CheckCircle className="w-8 h-8 text-emerald-500" />
                                        <span className="text-sm font-medium text-emerald-600">{file.name}</span>
                                      </>
                                  ) : (
                                      <>
                                        <Paperclip className="w-8 h-8" />
                                        <span className="text-sm">Toca para subir comprobante</span>
                                      </>
                                  )}
                              </div>
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Notas Adicionales</label>
                          <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" rows={2} placeholder="Ej: Pago de expensas Enero..." />
                      </div>
                      <button disabled={isSubmitting} type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                          {isSubmitting ? 'Enviando...' : 'Enviar Informe de Pago'}
                      </button>
                  </form>
              </div>
          </div>
      )}

      {/* Pending Payments Alert */}
      {myPendingPayments.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                  <h4 className="font-bold text-amber-800">Pagos Pendientes de Aprobación</h4>
                  <p className="text-sm text-amber-700 mb-2">Has informado los siguientes pagos que aún no han sido verificados por la administración:</p>
                  <ul className="space-y-1">
                      {myPendingPayments.map(p => (
                          <li key={p.id} className="text-sm font-mono text-amber-900 bg-amber-100/50 px-2 py-1 rounded inline-block mr-2">
                              ${p.amount} ({new Date(p.date).toLocaleDateString()})
                          </li>
                      ))}
                  </ul>
              </div>
          </div>
      )}

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
                      {settings.bankCBU ? (
                        <>
                          <p className="text-sm text-slate-700 font-medium flex justify-between gap-4">
                              <span>CBU:</span> <span className="font-mono select-all">{settings.bankCBU}</span>
                          </p>
                          <p className="text-sm text-slate-700 font-medium flex justify-between gap-4 mt-1">
                              <span>Alias:</span> <span className="font-mono uppercase select-all">{settings.bankAlias}</span>
                          </p>
                          <p className="text-sm text-slate-700 font-medium flex justify-between gap-4 mt-1">
                              <span>Banco:</span> <span>{settings.bankName}</span>
                          </p>
                          <p className="text-xs text-slate-500 mt-2 text-right">Titular: {settings.bankHolder}</p>
                        </>
                      ) : (
                        <p className="text-sm text-amber-600 italic">Datos bancarios no configurados.</p>
                      )}
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
                  <span className="text-slate-800 font-bold">Tu Parte</span>
                  <span className="font-bold text-blue-600 text-xl">~${(expenses.reduce((a,c) => a+c.amount, 0) * (myUnit.proratePercentage / 100)).toFixed(2)}</span>
              </div>
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