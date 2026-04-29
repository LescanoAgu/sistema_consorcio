import React, { useMemo, useState, useEffect } from 'react';
import { Unit, Expense, SettlementRecord, Payment, ConsortiumSettings, Announcement, Booking, MaintenanceRequest, ConsortiumDocument, Consortium } from '../types';
import { CheckCircle, AlertCircle, Download, Building, Building2, Upload, X, Megaphone, Calendar, FileText, Loader2 } from 'lucide-react';
import { generateSettlementPDF, generateIndividualCouponPDF } from '../services/pdfService';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
};

interface UserPortalProps {
  userEmail: string;
  consortium: Consortium; 
  units: Unit[];
  expenses: Expense[];
  history: SettlementRecord[];
  payments: Payment[];
  settings: ConsortiumSettings;
  announcements: Announcement[];
  myBookings?: Booking[]; 
  myTickets?: MaintenanceRequest[];
  documents?: ConsortiumDocument[];
  onReportPayment: (data: any) => Promise<void>;
}

const UserPortal: React.FC<UserPortalProps> = ({ 
    userEmail, consortium, units, history, payments, settings, announcements, 
    myBookings = [], myTickets = [], documents = [], onReportPayment 
}) => {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const myUnits = useMemo(() => {
      const owned = units.filter(u => u.authorizedEmails?.includes(userEmail));
      return owned.length > 0 ? owned : units.filter(u => u.ownerName === 'Usuario Demo'); 
  }, [units, userEmail]);

  const [selectedUnitId, setSelectedUnitId] = useState<string>('');

  useEffect(() => {
      if (myUnits.length > 0 && !selectedUnitId) {
          setSelectedUnitId(myUnits[0].id);
      }
  }, [myUnits]);

  const currentUnit = useMemo(() => myUnits.find(u => u.id === selectedUnitId) || myUnits[0], [selectedUnitId, myUnits]);

  const currentUnitDebt = useMemo(() => {
      if (!currentUnit) return { historical: 0, current: 0, total: 0, pendingPeriod: '' };

      const historical = (currentUnit.debts || []).reduce((acc, d) => acc + d.total, 0) + (currentUnit.initialBalance || 0);
      let current = 0;
      let pendingPeriod = '';
      
      if (history.length > 0) {
          const lastSettlement = history[0]; 
          const unitDetail = lastSettlement.unitDetails?.find(d => d.unitId === currentUnit.id);
          
          if (unitDetail) {
              const isAlreadyInDebts = (currentUnit.debts || []).some(d => d.period === lastSettlement.month);
              if (!isAlreadyInDebts) {
                  const settlementDate = new Date(lastSettlement.dateClosed).getTime();
                  const paidSinceThen = payments
                      .filter(p => p.unitId === currentUnit.id && p.status === 'APPROVED' && new Date(p.date).getTime() >= settlementDate)
                      .reduce((sum, p) => sum + p.amount, 0);
                  
                  const amountOwed = unitDetail.totalToPay - paidSinceThen;
                  if (amountOwed > 1) { 
                      current = amountOwed;
                      pendingPeriod = lastSettlement.month;
                  }
              }
          }
      }

      return { historical, current, total: historical + current, pendingPeriod };
  }, [currentUnit, history, payments]);

  const unitBookings = useMemo(() => myBookings.filter(b => b.unitId === currentUnit?.id && new Date(b.date) >= new Date()).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [myBookings, currentUnit]);
  const recentDocs = useMemo(() => documents.slice(0, 3), [documents]);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const handleSubmitPayment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!amount || !currentUnit) return;
      setIsSubmitting(true);
      try {
          await onReportPayment({ unitId: currentUnit.id, amount: parseFloat(amount), date, method: 'Transferencia', notes, file });
          setShowPaymentModal(false);
          setAmount(''); setNotes(''); setFile(null);
          alert("¡Pago informado! Aguardá la confirmación del administrador.");
      } catch (error) { alert("Error al informar."); } finally { setIsSubmitting(false); }
  };

  if (!currentUnit) return (
      <div className="text-center py-20">
          <Building2 className="w-16 h-16 mx-auto text-slate-300 mb-4"/>
          <h2 className="text-xl font-bold text-slate-700">Aún no tienes unidades asignadas.</h2>
          <p className="text-slate-500 mt-2">El administrador debe aprobar tu solicitud y asignarte a tu propiedad.</p>
      </div>
  );

  return (
    <div className="space-y-6 relative animate-fade-in">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl p-8 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-3xl opacity-10 -translate-y-1/2 translate-x-1/4"></div>
          
          <div className="relative z-10 flex-1 w-full">
            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-200 mb-1">Panel del Propietario</h2>
            <h1 className="text-3xl font-black mb-4 truncate">{currentUnit.ownerName}</h1>
            
            {myUnits.length > 1 ? (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {myUnits.map(u => (
                        <button 
                            key={u.id} 
                            onClick={() => setSelectedUnitId(u.id)}
                            className={`px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all shadow-sm ${selectedUnitId === u.id ? 'bg-white text-indigo-700 ring-2 ring-white/50' : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'}`}
                        >
                            {u.unitNumber}
                        </button>
                    ))}
                </div>
            ) : (
                <p className="text-lg font-medium text-indigo-100 bg-white/10 inline-block px-4 py-1.5 rounded-lg border border-white/20">
                    Unidad: <strong>{currentUnit.unitNumber}</strong>
                </p>
            )}
          </div>
          
          <button onClick={() => setShowPaymentModal(true)} className="bg-emerald-500 text-white border border-emerald-400 px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-900/20 hover:bg-emerald-400 transition-colors flex items-center gap-2 relative z-10 w-full md:w-auto justify-center">
              <Upload className="w-5 h-5" /> Informar Pago
          </button>
      </div>
      
      {announcements.length > 0 && (
          <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-l-indigo-500 border border-slate-200">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3"><Megaphone className="w-5 h-5 text-indigo-600"/> Novedades Importantes</h3>
              <div className="grid md:grid-cols-2 gap-4">
                  {announcements.slice(0,2).map(ann => (
                      <div key={ann.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <span className="font-bold text-slate-700 block mb-1">{ann.title}</span>
                          <p className="text-sm text-slate-500 line-clamp-2">{ann.content}</p>
                      </div>
                  ))}
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
              
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">Estado de Cuenta Actual</h3>
                  <div className="flex flex-col md:flex-row gap-8 items-center justify-between">
                      <div className="text-center md:text-left w-full md:w-auto">
                          <p className="text-slate-500 mb-1 font-medium">Saldo Total a Pagar</p>
                          <p className={`text-5xl font-black tracking-tight ${currentUnitDebt.total > 1 ? 'text-red-600' : 'text-emerald-500'}`}>
                              {formatCurrency(currentUnitDebt.total)}
                          </p>
                          {currentUnitDebt.total > 1 ? (
                              <div className="mt-3 inline-flex items-center px-4 py-1.5 bg-red-50 border border-red-100 text-red-700 rounded-full text-xs font-bold shadow-sm">
                                  <AlertCircle className="w-4 h-4 mr-1.5" /> Saldo Pendiente
                              </div>
                          ) : (
                              <div className="mt-3 inline-flex items-center px-4 py-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-full text-xs font-bold shadow-sm">
                                  <CheckCircle className="w-4 h-4 mr-1.5" /> Al día. ¡Gracias!
                              </div>
                          )}
                      </div>
                      
                      <div className="w-full md:w-auto">
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
                              <p className="font-bold text-slate-700 mb-2">Datos para Transferencia:</p>
                              {settings.bankCBU ? (
                                <>
                                  <div className="flex justify-between gap-6 mb-1"><span className="text-slate-500">CBU/CVU:</span> <span className="font-mono font-bold text-slate-800">{settings.bankCBU}</span></div>
                                  <div className="flex justify-between gap-6"><span className="text-slate-500">Alias:</span> <span className="font-mono font-bold text-indigo-600 uppercase">{settings.bankAlias}</span></div>
                                </>
                              ) : <p className="text-amber-600 italic">Sin datos bancarios registrados.</p>}
                          </div>
                      </div>
                  </div>
                  
                  {currentUnitDebt.total > 1 && (
                      <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-4">
                          {currentUnitDebt.historical > 0 && <span className="text-xs font-bold bg-red-50 text-red-700 px-3 py-1 rounded-lg border border-red-100">Deuda Anterior: {formatCurrency(currentUnitDebt.historical)}</span>}
                          {currentUnitDebt.current > 0 && <span className="text-xs font-bold bg-amber-50 text-amber-700 px-3 py-1 rounded-lg border border-amber-100">Mes {currentUnitDebt.pendingPeriod}: {formatCurrency(currentUnitDebt.current)}</span>}
                      </div>
                  )}
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-5 bg-slate-50 border-b border-slate-200">
                      <h3 className="font-bold text-slate-800">Tus Expensas Anteriores</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                      {history.length > 0 ? history.slice(0, 5).map(rec => {
                          const detail = rec.unitDetails?.find(d => d.unitId === currentUnit.id);
                          if (!detail) return null;
                          
                          return (
                              <div key={rec.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 transition-colors gap-4">
                                  <div className="flex items-center gap-4">
                                      <div className="bg-white border border-slate-200 shadow-sm text-slate-400 p-3 rounded-xl"><Building className="w-5 h-5"/></div>
                                      <div>
                                          <p className="font-bold text-slate-800">{rec.month}</p>
                                          <p className="text-xs text-slate-500 font-medium">Cierre: {new Date(rec.dateClosed).toLocaleDateString()}</p>
                                      </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-4 justify-end">
                                      <div className="text-right mr-2 hidden sm:block">
                                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tu total liquidado</span>
                                          <span className="font-black text-slate-700 text-base">{formatCurrency(detail.totalToPay)}</span>
                                      </div>
                                      
                                      <button 
                                        onClick={() => generateSettlementPDF(rec, consortium, units)}
                                        className="text-slate-600 hover:text-indigo-600 text-xs font-bold bg-white border border-slate-200 hover:border-indigo-300 px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
                                        title="Descargar Expensa General del Edificio"
                                      >
                                          <FileText className="w-3 h-3"/> General
                                      </button>
                                      
                                      <button 
                                        onClick={() => generateIndividualCouponPDF(rec, currentUnit, consortium)}
                                        className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                                        title="Descargar Mi Cupón Detallado"
                                      >
                                          <Download className="w-3 h-3"/> Mi Cupón
                                      </button>
                                  </div>
                              </div>
                          )
                      }) : <div className="p-8 text-center text-slate-400 font-medium">No hay historial de expensas todavía.</div>}
                  </div>
              </div>
          </div>

          <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Calendar className="w-4 h-4 text-emerald-500"/> Mis Reservas Próximas</h3></div>
                  <div className="p-4">
                      {unitBookings.length > 0 ? unitBookings.slice(0,3).map(b => (
                          <div key={b.id} className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-3 last:mb-0">
                              <p className="text-emerald-800 font-bold text-sm mb-1">{new Date(b.date).toLocaleDateString()}</p>
                              <div className="inline-block bg-white text-emerald-600 font-bold text-xs px-2 py-1 rounded shadow-sm">{b.timeSlot}</div>
                          </div>
                      )) : <p className="text-slate-400 text-sm text-center py-4">No tienes reservas activas.</p>}
                  </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100"><h3 className="font-bold text-slate-800 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500"/> Documentos Útiles</h3></div>
                  <div className="p-4 space-y-2">
                      {recentDocs.length > 0 ? recentDocs.map(d => (
                          <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="flex items-center justify-between group cursor-pointer p-3 border border-slate-100 hover:border-blue-200 hover:bg-blue-50 rounded-xl transition-all">
                              <span className="text-sm font-medium text-slate-700 truncate mr-2">{d.title}</span>
                              <Download className="w-4 h-4 text-slate-300 group-hover:text-blue-600 flex-shrink-0"/>
                          </a>
                      )) : <p className="text-slate-400 text-sm text-center py-4">No hay documentos cargados.</p>}
                  </div>
              </div>
          </div>
      </div>

      {showPaymentModal && (
          <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div>
                          <h3 className="font-black text-lg text-slate-800">Informar Pago</h3>
                          <p className="text-xs text-slate-500 font-medium">Unidad: {currentUnit.unitNumber}</p>
                      </div>
                      <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500"/></button>
                  </div>
                  <form onSubmit={handleSubmitPayment} className="p-6 space-y-5">
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">Monto Abonado ($)</label>
                          <input required type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-lg font-bold text-indigo-700 transition-all" placeholder="0.00" />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">Fecha del Pago</label>
                          <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium text-slate-700" />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">Aclaraciones (Opcional)</label>
                          <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm" placeholder="Ej: Transferencia desde cuenta de Banco Galicia..." rows={2} />
                      </div>
                      <div className="pt-2 border-t border-slate-100">
                          <button disabled={isSubmitting} type="submit" className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md flex justify-center items-center">
                              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Enviar Comprobante'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default UserPortal;