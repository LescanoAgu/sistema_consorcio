import React, { useMemo, useState, useEffect } from 'react';
import { Unit, Expense, SettlementRecord, Payment, ConsortiumSettings, Announcement, DebtAdjustment, Booking, MaintenanceRequest, ConsortiumDocument } from '../types';
import { CheckCircle, AlertCircle, TrendingUp, Download, Building, Users, Upload, X, Paperclip, Megaphone, Calendar, Wrench, FileText, ChevronDown } from 'lucide-react';
import { generateSettlementPDF, generateIndividualCouponPDF } from '../services/pdfService';

interface UserPortalProps {
  userEmail: string;
  consortiumName: string;
  units: Unit[];
  expenses: Expense[];
  history: SettlementRecord[];
  payments: Payment[];
  settings: ConsortiumSettings;
  announcements: Announcement[];
  debtAdjustments?: DebtAdjustment[];
  myBookings?: Booking[]; 
  myTickets?: MaintenanceRequest[];
  documents?: ConsortiumDocument[];
  onReportPayment: (data: any) => Promise<void>;
}

const UserPortal: React.FC<UserPortalProps> = ({ 
    userEmail, consortiumName, units, expenses, history, payments, settings, announcements, debtAdjustments = [], 
    myBookings = [], myTickets = [], documents = [], onReportPayment 
}) => {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // LOGICA MULTI-UNIDAD
  // 1. Encontrar todas las unidades del usuario
  const myUnits = useMemo(() => {
      const owned = units.filter(u => u.linkedEmail === userEmail);
      if (owned.length > 0) return owned;
      // Fallback para demo
      return units.filter(u => u.ownerName === 'Usuario Demo');
  }, [units, userEmail]);

  // 2. Estado para la unidad seleccionada actualmente (por defecto la primera)
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');

  useEffect(() => {
      if (myUnits.length > 0 && !selectedUnitId) {
          setSelectedUnitId(myUnits[0].id);
      }
  }, [myUnits]);

  // 3. Obtener el objeto completo de la unidad seleccionada
  const currentUnit = useMemo(() => 
      myUnits.find(u => u.id === selectedUnitId) || myUnits[0], 
  [selectedUnitId, myUnits]);

  // --- FILTROS BASADOS EN LA UNIDAD SELECCIONADA ---
  const unitBookings = useMemo(() => myBookings.filter(b => b.unitId === currentUnit?.id && new Date(b.date) >= new Date()).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [myBookings, currentUnit]);
  const unitTickets = useMemo(() => myTickets.filter(t => t.unitId === currentUnit?.id && t.status !== 'DONE'), [myTickets, currentUnit]);
  const recentDocs = useMemo(() => documents.slice(0, 3), [documents]);

  const status = useMemo(() => {
    if (!currentUnit) return null;
    const initial = currentUnit.initialBalance || 0;
    
    const totalSettled = history.reduce((acc, record) => {
        const detail = record.unitDetails?.find(d => d.unitId === currentUnit.id);
        return acc + (detail ? detail.totalToPay : 0);
    }, 0);

    const totalAdjustments = debtAdjustments.filter(a => a.unitId === currentUnit.id).reduce((acc, a) => acc + a.amount, 0);
    const totalPaid = payments.filter(p => p.unitId === currentUnit.id && p.status === 'APPROVED').reduce((acc, p) => acc + p.amount, 0);
    
    return { balance: (initial + totalSettled + totalAdjustments) - totalPaid };
  }, [currentUnit, history, payments, debtAdjustments]);

  // ESTADO DE FORMULARIO PAGO
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const handleSubmitPayment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!amount || !currentUnit) return;
      setIsSubmitting(true);
      try {
          await onReportPayment({ 
              unitId: currentUnit.id, // IMPORTANTE: Enviar ID de la unidad seleccionada
              amount: parseFloat(amount), date, method: 'Transferencia', notes, file 
          });
          setShowPaymentModal(false);
          setAmount(''); setNotes(''); setFile(null);
          alert("Pago informado.");
      } catch (error) { alert("Error al informar."); } finally { setIsSubmitting(false); }
  };

  if (!currentUnit) return <div className="text-center p-10">No tienes unidades asignadas.</div>;

  return (
    <div className="space-y-6 relative">
      {/* HEADER CON SELECTOR MULTI-UNIDAD */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-1">Hola, {currentUnit.ownerName}</h2>
            
            {myUnits.length > 1 ? (
                <div className="relative inline-block mt-1">
                    <select 
                        className="appearance-none bg-white/20 border border-white/30 text-white py-1 pl-3 pr-8 rounded-lg font-bold outline-none cursor-pointer hover:bg-white/30 transition-colors"
                        value={selectedUnitId}
                        onChange={(e) => setSelectedUnitId(e.target.value)}
                    >
                        {myUnits.map(u => (
                            <option key={u.id} value={u.id} className="text-slate-800">
                                UF {u.unitNumber}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-2 top-2 pointer-events-none text-white/80"/>
                </div>
            ) : (
                <p className="opacity-90 font-medium">Unidad: <strong>{currentUnit.unitNumber}</strong></p>
            )}
          </div>
          
          <button onClick={() => setShowPaymentModal(true)} className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-bold shadow hover:bg-indigo-50 transition-colors flex items-center gap-2">
              <Upload className="w-5 h-5" /> Informar Pago
          </button>
      </div>

      {/* ... (RESTO DEL CÓDIGO IGUAL QUE ANTES: Anuncios, Estado de Cuenta, Historial...) ... */}
      {/* Solo nos aseguramos que use 'currentUnit' y 'status' que ya definimos arriba */}
      
      {announcements.length > 0 && (
          <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-l-indigo-500 border border-slate-200">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2"><Megaphone className="w-4 h-4 text-indigo-600"/> Novedades</h3>
              <div className="grid md:grid-cols-2 gap-4">
                  {announcements.slice(0,2).map(ann => (
                      <div key={ann.id} className="text-sm">
                          <span className="font-bold text-slate-700">{ann.title}</span>
                          <p className="text-slate-500 line-clamp-1">{ann.content}</p>
                      </div>
                  ))}
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
              
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-700 mb-6">Estado de Cuenta (UF {currentUnit.unitNumber})</h3>
                  <div className="flex flex-col md:flex-row gap-8 items-center justify-between">
                      <div className="text-center md:text-left">
                          <p className="text-slate-500 mb-1">Saldo a Pagar</p>
                          <p className={`text-4xl font-bold ${status?.balance && status.balance > 1 ? 'text-red-600' : 'text-emerald-500'}`}>
                              ${status?.balance.toFixed(2) || '0.00'}
                          </p>
                          {status?.balance && status.balance > 1 ? (
                              <div className="mt-2 inline-flex items-center px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold"><AlertCircle className="w-3 h-3 mr-1" /> Pendiente</div>
                          ) : (
                              <div className="mt-2 inline-flex items-center px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold"><CheckCircle className="w-3 h-3 mr-1" /> Al día</div>
                          )}
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
                          {settings.bankCBU ? (
                            <>
                              <p className="text-slate-700 flex gap-4"><span>CBU:</span> <span className="font-mono font-bold">{settings.bankCBU}</span></p>
                              <p className="text-slate-700 flex gap-4 mt-1"><span>Alias:</span> <span className="font-mono font-bold uppercase">{settings.bankAlias}</span></p>
                            </>
                          ) : <p className="text-amber-600 italic">Sin datos bancarios.</p>}
                      </div>
                  </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <h3 className="font-semibold text-slate-700">Historial de Expensas</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                      {history.length > 0 ? history.slice(0, 5).map(rec => {
                          const myShare = rec.unitDetails?.find(d => d.unitId === currentUnit.id)?.totalToPay || 0;
                          return (
                              <div key={rec.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 transition-colors gap-4">
                                  <div className="flex items-center gap-3">
                                      <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg"><Building className="w-4 h-4"/></div>
                                      <div>
                                          <p className="font-bold text-slate-800 text-sm">{rec.month}</p>
                                          <p className="text-xs text-slate-500">Cierre: {new Date(rec.dateClosed).toLocaleDateString()}</p>
                                      </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-4 justify-end">
                                      <div className="text-right mr-2">
                                          <span className="text-xs text-slate-400 block uppercase">Tu cuota</span>
                                          <span className="font-bold text-slate-700 text-sm">${myShare.toFixed(2)}</span>
                                      </div>
                                      
                                      <button 
                                        onClick={() => generateSettlementPDF(rec, consortiumName, units, settings)}
                                        className="text-slate-600 hover:text-indigo-600 text-xs border border-slate-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                                      >
                                          <FileText className="w-3 h-3"/> General
                                      </button>
                                      
                                      <button 
                                        onClick={() => generateIndividualCouponPDF(rec, currentUnit.id, consortiumName, units, settings)}
                                        className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                      >
                                          <Download className="w-3 h-3"/> Mi Cupón
                                      </button>
                                  </div>
                              </div>
                          )
                      }) : <div className="p-6 text-center text-slate-400 text-sm">Sin historial disponible.</div>}
                  </div>
              </div>
          </div>

          <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100"><h3 className="font-bold text-slate-700 flex items-center gap-2"><Calendar className="w-4 h-4 text-emerald-500"/> Mis Reservas</h3></div>
                  <div className="p-4">
                      {unitBookings.length > 0 ? unitBookings.slice(0,2).map(b => (
                          <div key={b.id} className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 mb-2 last:mb-0">
                              <p className="text-emerald-800 font-bold text-sm">{new Date(b.date).toLocaleDateString()}</p>
                              <p className="text-emerald-600 text-xs">{b.timeSlot}</p>
                          </div>
                      )) : <p className="text-slate-400 text-sm text-center">Sin reservas próximas.</p>}
                  </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100"><h3 className="font-bold text-slate-700 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500"/> Documentos</h3></div>
                  <div className="p-4 space-y-2">
                      {recentDocs.length > 0 ? recentDocs.map(d => (
                          <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="flex items-center justify-between group cursor-pointer p-2 hover:bg-slate-50 rounded-lg">
                              <span className="text-sm text-slate-600 truncate">{d.title}</span>
                              <Download className="w-4 h-4 text-slate-300 group-hover:text-blue-500"/>
                          </a>
                      )) : <p className="text-slate-400 text-sm text-center">Sin documentos.</p>}
                  </div>
              </div>
          </div>
      </div>

      {showPaymentModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                      <h3 className="font-bold text-slate-700">Informar Pago (UF {currentUnit.unitNumber})</h3>
                      <button onClick={() => setShowPaymentModal(false)}><X className="w-6 h-6 text-slate-400"/></button>
                  </div>
                  <form onSubmit={handleSubmitPayment} className="p-6 space-y-4">
                      <input required type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-2 border rounded" placeholder="Monto" />
                      <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded" />
                      <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2 border rounded" placeholder="Notas..." />
                      <button disabled={isSubmitting} type="submit" className="w-full py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700">{isSubmitting ? 'Enviando...' : 'Enviar'}</button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default UserPortal;