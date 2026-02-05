import React, { useMemo, useState } from 'react';
import { Unit, Expense, SettlementRecord, Payment, ConsortiumSettings, Announcement, DebtAdjustment, Booking, MaintenanceRequest, ConsortiumDocument } from '../types';
import { CheckCircle, AlertCircle, TrendingUp, Download, Building, Users, Upload, X, Paperclip, Megaphone, Calendar, Wrench, FileText, ArrowRight } from 'lucide-react';

interface UserPortalProps {
  userEmail: string;
  units: Unit[];
  expenses: Expense[];
  history: SettlementRecord[];
  payments: Payment[];
  settings: ConsortiumSettings;
  announcements: Announcement[];
  debtAdjustments?: DebtAdjustment[];
  // NUEVAS PROPS PARA EL RESUMEN
  myBookings?: Booking[]; 
  myTickets?: MaintenanceRequest[];
  documents?: ConsortiumDocument[];
  onReportPayment: (paymentData: { amount: number, date: string, method: 'Transferencia' | 'Efectivo' | 'Cheque', notes: string, file: File | null }) => Promise<void>;
}

const UserPortal: React.FC<UserPortalProps> = ({ 
    userEmail, units, expenses, history, payments, settings, announcements, debtAdjustments = [], 
    myBookings = [], myTickets = [], documents = [], onReportPayment 
}) => {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const myUnit = useMemo(() => {
    return units.find(u => u.linkedEmail === userEmail) || units.find(u => u.ownerName === 'Usuario Demo') || units[0];
  }, [units, userEmail]);

  // Filtrar datos específicos de la unidad
  const unitBookings = useMemo(() => myBookings.filter(b => b.unitId === myUnit?.id && new Date(b.date) >= new Date()).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [myBookings, myUnit]);
  const unitTickets = useMemo(() => myTickets.filter(t => t.unitId === myUnit?.id && t.status !== 'DONE'), [myTickets, myUnit]);
  const recentDocs = useMemo(() => documents.slice(0, 3), [documents]);

  const status = useMemo(() => {
    if (!myUnit) return null;
    const initial = myUnit.initialBalance || 0;
    
    const totalSettled = history.reduce((acc, record) => {
        const detail = record.unitDetails?.find(d => d.unitId === myUnit.id);
        return acc + (detail ? detail.totalToPay : 0);
    }, 0);

    const totalAdjustments = debtAdjustments.filter(a => a.unitId === myUnit.id).reduce((acc, a) => acc + a.amount, 0);
    const validPayments = payments.filter(p => p.unitId === myUnit.id && p.status === 'APPROVED');
    const totalPaid = validPayments.reduce((acc, p) => acc + p.amount, 0);
    
    const balance = (initial + totalSettled + totalAdjustments) - totalPaid;
    return { balance, totalPaid };
  }, [myUnit, history, payments, debtAdjustments]);

  const myPendingPayments = useMemo(() => {
      if(!myUnit) return [];
      return payments.filter(p => p.unitId === myUnit.id && p.status === 'PENDING');
  }, [payments, myUnit]);

  const allDebtors = useMemo(() => {
      const processedUnits = new Set();
      return units.map(unit => {
        if (processedUnits.has(unit.unitNumber)) return null;
        processedUnits.add(unit.unitNumber);

        const initial = unit.initialBalance || 0;
        const totalSettled = history.reduce((acc, record) => {
            const detail = record.unitDetails?.find(d => d.unitId === unit.id);
            return acc + (detail ? detail.totalToPay : 0);
        }, 0);
        
        const unitAdjustments = debtAdjustments.filter(a => a.unitId === unit.id).reduce((acc, a) => acc + a.amount, 0);
        const totalPaid = payments.filter(p => p.unitId === unit.id && p.status === 'APPROVED').reduce((acc, p) => acc + p.amount, 0);
        const balance = (initial + totalSettled + unitAdjustments) - totalPaid;
        return { ...unit, balance };
      })
      .filter(u => u !== null && u.balance > 100)
      .sort((a, b) => (b?.balance || 0) - (a?.balance || 0)) as any[];
  }, [units, history, payments, debtAdjustments]);

  const handleSubmitPayment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!amount) return;
      setIsSubmitting(true);
      try {
          await onReportPayment({ amount: parseFloat(amount), date, method: 'Transferencia', notes, file });
          setShowPaymentModal(false);
          setAmount(''); setNotes(''); setFile(null);
          alert("Pago informado exitosamente.");
      } catch (error) { alert("Error al informar el pago."); } finally { setIsSubmitting(false); }
  };

  if (!myUnit) return <div className="text-center p-10">No se encontró unidad asociada a {userEmail}</div>;

  return (
    <div className="space-y-6 relative">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">Hola, {myUnit.ownerName}</h2>
            <p className="opacity-90">Unidad: <strong>{myUnit.unitNumber}</strong></p>
          </div>
          <button onClick={() => setShowPaymentModal(true)} className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-bold shadow hover:bg-indigo-50 transition-colors flex items-center gap-2">
              <Upload className="w-5 h-5" /> Informar Pago
          </button>
      </div>

      {/* ANUNCIOS IMPORTANTES */}
      {announcements.length > 0 && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-l-indigo-500 border-slate-200">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <Megaphone className="w-4 h-4 text-indigo-600"/> Novedades Recientes
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                  {announcements.slice(0,2).map(ann => (
                      <div key={ann.id} className="text-sm">
                          <span className={`font-bold ${ann.priority === 'HIGH' ? 'text-red-600' : 'text-slate-700'}`}>{ann.title}</span>
                          <p className="text-slate-500 line-clamp-1">{ann.content}</p>
                      </div>
                  ))}
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* COLUMNA 1: FINANZAS (Principal) */}
          <div className="lg:col-span-2 space-y-6">
              {/* Estado de Cuenta */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-700 mb-6">Estado de Cuenta</h3>
                  <div className="flex flex-col md:flex-row gap-8 items-center justify-between">
                      <div className="text-center md:text-left">
                          <p className="text-slate-500 mb-1">Saldo a Pagar</p>
                          <p className={`text-4xl font-bold ${status?.balance && status.balance > 1 ? 'text-red-600' : 'text-emerald-500'}`}>
                              ${status?.balance.toFixed(2) || '0.00'}
                          </p>
                          {status?.balance && status.balance > 1 ? (
                              <div className="mt-2 inline-flex items-center px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold"><AlertCircle className="w-3 h-3 mr-1" /> Vencido / Pendiente</div>
                          ) : (
                              <div className="mt-2 inline-flex items-center px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold"><CheckCircle className="w-3 h-3 mr-1" /> Al día</div>
                          )}
                      </div>
                      
                      <div className="w-full md:w-auto bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
                          {settings.bankCBU ? (
                            <>
                              <p className="text-slate-700 flex justify-between gap-4"><span>CBU:</span> <span className="font-mono font-bold select-all">{settings.bankCBU}</span></p>
                              <p className="text-slate-700 flex justify-between gap-4 mt-1"><span>Alias:</span> <span className="font-mono font-bold uppercase select-all">{settings.bankAlias}</span></p>
                              <p className="text-slate-500 mt-2 text-right text-xs">Banco {settings.bankName}</p>
                            </>
                          ) : <p className="text-amber-600 italic">Datos bancarios no configurados.</p>}
                      </div>
                  </div>
              </div>

              {/* Pagos Pendientes Alert */}
              {myPendingPayments.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div>
                          <h4 className="font-bold text-amber-800 text-sm">Pagos en revisión</h4>
                          <p className="text-xs text-amber-700">Tienes {myPendingPayments.length} pagos informados esperando aprobación del administrador.</p>
                      </div>
                  </div>
              )}

              {/* Historial Breve */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <h3 className="font-semibold text-slate-700">Últimas Liquidaciones</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                      {history.slice(0, 3).map(rec => {
                          const myShare = rec.unitDetails?.find(d => d.unitId === myUnit.id)?.totalToPay || 0;
                          return (
                              <div key={rec.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                  <div className="flex items-center gap-3">
                                      <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg"><Building className="w-4 h-4"/></div>
                                      <div>
                                          <p className="font-bold text-slate-800 text-sm">{rec.month}</p>
                                          <p className="text-xs text-slate-500">{new Date(rec.dateClosed).toLocaleDateString()}</p>
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      <span className="font-bold text-slate-700 text-sm block">${myShare.toFixed(2)}</span>
                                      <button className="text-indigo-600 text-xs hover:underline flex items-center justify-end gap-1"><Download className="w-3 h-3"/> PDF</button>
                                  </div>
                              </div>
                          )
                      })}
                      {history.length === 0 && <div className="p-6 text-center text-slate-400 text-sm">Sin historial aún.</div>}
                  </div>
              </div>
          </div>

          {/* COLUMNA 2: VIDA SOCIAL Y GESTIÓN */}
          <div className="space-y-6">
              
              {/* WIDGET RESERVAS */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-700 flex items-center gap-2"><Calendar className="w-4 h-4 text-emerald-500"/> Mis Reservas</h3>
                  </div>
                  <div className="p-4">
                      {unitBookings.length > 0 ? (
                          <div className="space-y-3">
                              {unitBookings.slice(0,2).map(b => (
                                  <div key={b.id} className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                                      <p className="text-emerald-800 font-bold text-sm">{new Date(b.date).toLocaleDateString()}</p>
                                      <p className="text-emerald-600 text-xs">{b.timeSlot}</p>
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <p className="text-slate-400 text-sm text-center py-2">No tienes reservas próximas.</p>
                      )}
                  </div>
              </div>

              {/* WIDGET RECLAMOS */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-700 flex items-center gap-2"><Wrench className="w-4 h-4 text-orange-500"/> Mis Reclamos</h3>
                  </div>
                  <div className="p-4">
                      {unitTickets.length > 0 ? (
                          <div className="space-y-2">
                              {unitTickets.map(t => (
                                  <div key={t.id} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                                      <span className="text-slate-700 truncate max-w-[150px]">{t.title}</span>
                                      <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">{t.status === 'PENDING' ? 'Pendiente' : 'En Proceso'}</span>
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <p className="text-slate-400 text-sm text-center py-2">Todo funciona correctamente.</p>
                      )}
                  </div>
              </div>

              {/* WIDGET DOCUMENTOS */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-700 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500"/> Documentos</h3>
                  </div>
                  <div className="p-4 space-y-2">
                      {recentDocs.length > 0 ? recentDocs.map(d => (
                          <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="flex items-center justify-between group cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition-colors">
                              <span className="text-sm text-slate-600 group-hover:text-blue-600 truncate">{d.title}</span>
                              <Download className="w-4 h-4 text-slate-300 group-hover:text-blue-500"/>
                          </a>
                      )) : <p className="text-slate-400 text-sm text-center py-2">Sin documentos.</p>}
                  </div>
              </div>

              {/* MOROSOS (Transparencia) */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                   <div className="p-3 border-b border-slate-200 flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      <h3 className="font-semibold text-slate-600 text-xs uppercase">Morosidad General</h3>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto p-2">
                      <table className="w-full text-xs text-left">
                          <tbody className="divide-y divide-slate-200">
                              {allDebtors.length > 0 ? allDebtors.map(d => (
                                  <tr key={d.id}>
                                      <td className="py-2 px-1 font-bold text-slate-600">UF {d.unitNumber}</td>
                                      <td className="py-2 px-1 text-right font-bold text-red-500">${d.balance.toFixed(0)}</td>
                                  </tr>
                              )) : <tr><td className="p-4 text-center text-slate-400">Sin deudores.</td></tr>}
                          </tbody>
                      </table>
                  </div>
              </div>

          </div>
      </div>

      {/* MODAL DE PAGO (Mismo de antes) */}
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
                                  {file ? <><CheckCircle className="w-8 h-8 text-emerald-500" /><span className="text-sm font-medium text-emerald-600">{file.name}</span></> : <><Paperclip className="w-8 h-8" /><span className="text-sm">Toca para subir comprobante</span></>}
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
    </div>
  );
};

export default UserPortal;