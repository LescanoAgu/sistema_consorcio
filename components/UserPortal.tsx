import { getLocalIsoDate, formatLocalDate } from '../utils/dateUtils';
import React, { useMemo, useState, useEffect } from 'react';
import { Unit, Expense, SettlementRecord, Payment, ConsortiumSettings, Announcement, Booking, MaintenanceRequest, ConsortiumDocument, Consortium } from '../types';
import { CheckCircle, AlertCircle, Download, Building, Building2, Upload, X, Megaphone, Calendar, FileText, Loader2, Copy, Check, Clock, XCircle, ExternalLink, Receipt } from 'lucide-react';
import { generateSettlementPDF, generateIndividualCouponPDF, generateDebtDetailPDF, isCurrentPeriodDebt } from '../services/pdfService';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
};

const convertImgToBase64 = async (url: string): Promise<string | null> => {
  if (!url) return null;
  try {
    const data = await fetch(url);
    const blob = await data.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => resolve(reader.result as string);
    });
  } catch {
    return null;
  }
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
    myBookings = [], documents = [], onReportPayment 
}) => {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<'CBU' | 'ALIAS' | null>(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  const normalizedUserEmail = (userEmail || '').trim().toLowerCase();

  const myUnits = useMemo(() => {
      return units.filter(u =>
          (u.authorizedEmails || []).some(em => em.trim().toLowerCase() === normalizedUserEmail)
      );
  }, [units, normalizedUserEmail]);

  const [selectedUnitId, setSelectedUnitId] = useState<string>('');

  useEffect(() => {
      if (myUnits.length > 0 && (!selectedUnitId || !myUnits.some(u => u.id === selectedUnitId))) {
          setSelectedUnitId(myUnits[0].id);
      }
  }, [myUnits, selectedUnitId]);

  const currentUnit = useMemo(() => myUnits.find(u => u.id === selectedUnitId) || myUnits[0], [selectedUnitId, myUnits]);

  // Ordenar historial del más reciente al más antiguo para identificar siempre el último cierre real
  const sortedHistory = useMemo(() => {
      return [...history].sort((a, b) => new Date(b.dateClosed).getTime() - new Date(a.dateClosed).getTime());
  }, [history]);

  // Estado de cuenta exacto basado en unit.debts + unit.initialBalance (sin duplicar ni revivir meses ya saldados)
  const currentUnitDebt = useMemo(() => {
      if (!currentUnit) return { historical: 0, current: 0, total: 0, pendingPeriod: '' };

      const lastSettlement = sortedHistory.length > 0 ? sortedHistory[0] : null;
      let historical = Number(currentUnit.initialBalance || 0);
      let current = 0;
      let pendingPeriod = '';

      (currentUnit.debts || []).forEach(d => {
          if (lastSettlement && isCurrentPeriodDebt(d.period, lastSettlement.month)) {
              current = Number((current + (d.total || 0)).toFixed(2));
              pendingPeriod = d.period;
          } else {
              historical = Number((historical + (d.total || 0)).toFixed(2));
          }
      });

      const total = Number((historical + current).toFixed(2));
      return { historical, current, total, pendingPeriod };
  }, [currentUnit, sortedHistory]);

  // Pagos de la unidad seleccionada (ordenados del más reciente al más antiguo)
  const unitPayments = useMemo(() => {
      if (!currentUnit) return [];
      return payments
          .filter(p => p.unitId === currentUnit.id)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, currentUnit]);

  const pendingUnitPayments = useMemo(() => {
      return unitPayments.filter(p => p.status === 'PENDING');
  }, [unitPayments]);

  const pendingAmountSum = useMemo(() => {
      return pendingUnitPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [pendingUnitPayments]);

  const todayIso = getLocalIsoDate();
  const unitBookings = useMemo(() => {
      if (!currentUnit) return [];
      return myBookings
          .filter(b => b.unitId === currentUnit.id && b.date >= todayIso)
          .sort((a, b) => a.date.localeCompare(b.date));
  }, [myBookings, currentUnit, todayIso]);

  const recentDocs = useMemo(() => documents.slice(0, 4), [documents]);

  // Estados del formulario de Informar Pago
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getLocalIsoDate());
  const [method, setMethod] = useState<'Transferencia' | 'Efectivo' | 'Cheque'>('Transferencia');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');

  const handleOpenPaymentModal = () => {
      if (currentUnitDebt.total > 1 && !amount) {
          setAmount(currentUnitDebt.total.toFixed(2));
      }
      setDate(getLocalIsoDate());
      setFileError('');
      setShowPaymentModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setFileError('');
      const selected = e.target.files?.[0] || null;
      if (!selected) {
          setFile(null);
          return;
      }
      if (selected.size > 10 * 1024 * 1024) {
          setFileError('El archivo supera el límite máximo de 10 MB.');
          e.target.value = '';
          setFile(null);
          return;
      }
      const isValidType = selected.type.startsWith('image/') || selected.type === 'application/pdf';
      if (!isValidType) {
          setFileError('Formato no permitido. Subí una imagen (JPG/PNG) o un PDF.');
          e.target.value = '';
          setFile(null);
          return;
      }
      setFile(selected);
  };

  const handleCopy = async (text: string, field: 'CBU' | 'ALIAS') => {
      try {
          await navigator.clipboard.writeText(text);
          setCopiedField(field);
          setTimeout(() => setCopiedField(null), 2000);
      } catch {
          // Fallback silencioso
      }
  };

  const buildConsortiumForPDF = async (): Promise<Consortium> => {
      let logoBase64 = consortium.image || undefined;
      if (!logoBase64 && settings.logoUrl) {
          const converted = await convertImgToBase64(settings.logoUrl);
          if (converted) logoBase64 = converted;
      }
      return {
          ...consortium,
          address: settings.address || consortium.address || '',
          cuit: settings.cuit || consortium.cuit || '',
          image: logoBase64
      };
  };

  const handleDownloadMyCoupon = async (rec: SettlementRecord) => {
      if (!currentUnit) return;
      setDownloadingPdfId(`coupon_${rec.id}`);
      try {
          const pdfConsortium = await buildConsortiumForPDF();
          generateIndividualCouponPDF(rec, currentUnit, pdfConsortium, settings, units);
      } finally {
          setDownloadingPdfId(null);
      }
  };

  const handleDownloadGeneralSettlement = async (rec: SettlementRecord) => {
      setDownloadingPdfId(`general_${rec.id}`);
      try {
          const pdfConsortium = await buildConsortiumForPDF();
          generateSettlementPDF(rec, pdfConsortium, units);
      } finally {
          setDownloadingPdfId(null);
      }
  };

  const handleDownloadDebtSummary = async () => {
      if (!currentUnit) return;
      setDownloadingPdfId('debt_summary');
      try {
          const pdfConsortium = await buildConsortiumForPDF();
          generateDebtDetailPDF(currentUnit, pdfConsortium);
      } finally {
          setDownloadingPdfId(null);
      }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
      e.preventDefault();
      const parsedAmount = parseFloat(amount);
      if (!parsedAmount || parsedAmount <= 0 || !currentUnit) return;
      setIsSubmitting(true);
      try {
          await onReportPayment({
              unitId: currentUnit.id,
              amount: Number(parsedAmount.toFixed(2)),
              date,
              method,
              notes: notes.trim(),
              file
          });
          setShowPaymentModal(false);
          setAmount('');
          setNotes('');
          setFile(null);
          setFileError('');
          alert("¡Pago informado correctamente! Quedó en revisión por la administración.");
      } catch (error) {
          console.error(error);
          alert("Hubo un error al enviar el informe de pago. Verificá tu conexión o el archivo adjunto.");
      } finally {
          setIsSubmitting(false);
      }
  };

  if (!currentUnit) return (
      <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <Building2 className="w-16 h-16 mx-auto text-slate-300 mb-4"/>
          <h2 className="text-xl font-bold text-slate-700">Aún no tienes unidades asignadas</h2>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">
              El administrador debe vincular tu correo (<strong className="text-slate-700">{userEmail}</strong>) a tu departamento o local para visualizar tus expensas.
          </p>
      </div>
  );

  const showBankTransferBox = settings.showBankDetailsOnCoupon !== false && Boolean(settings.bankCBU || settings.bankAlias);

  return (
    <div className="space-y-6 relative animate-fade-in">
      {/* ENCABEZADO DEL PROPIETARIO */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl p-6 md:p-8 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-3xl opacity-10 -translate-y-1/2 translate-x-1/4"></div>
          
          <div className="relative z-10 flex-1 w-full">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-200 mb-1">Portal de Autogestión</h2>
            <h1 className="text-2xl md:text-3xl font-black mb-4 truncate">{currentUnit.ownerName}</h1>
            
            {myUnits.length > 1 ? (
                <div>
                    <p className="text-xs text-indigo-200 mb-2 font-semibold">Seleccioná tu unidad funcional ({myUnits.length} vinculadas):</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {myUnits.map(u => (
                            <button 
                                key={u.id} 
                                onClick={() => setSelectedUnitId(u.id)}
                                className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all shadow-sm ${selectedUnitId === u.id ? 'bg-white text-indigo-700 ring-2 ring-white/50' : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'}`}
                            >
                                UF {u.unitNumber}{u.block ? ` • ${u.block}` : ''}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <p className="text-base font-medium text-indigo-100 bg-white/10 inline-block px-4 py-1.5 rounded-lg border border-white/20">
                    Unidad: <strong>{currentUnit.unitNumber}</strong>{currentUnit.block ? ` (${currentUnit.block})` : ''}
                </p>
            )}
          </div>
          
          <button
            onClick={handleOpenPaymentModal}
            className="bg-emerald-500 text-white border border-emerald-400 px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-emerald-900/20 hover:bg-emerald-400 transition-colors flex items-center gap-2 relative z-10 w-full md:w-auto justify-center cursor-pointer"
          >
              <Upload className="w-5 h-5" /> Informar Pago
          </button>
      </div>
      
      {/* NOVEDADES RECIENTES */}
      {announcements.length > 0 && (
          <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-l-indigo-500 border border-slate-200">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3"><Megaphone className="w-5 h-5 text-indigo-600"/> Novedades del Consorcio</h3>
              <div className="grid md:grid-cols-2 gap-4">
                  {announcements.slice(0, 2).map(ann => (
                      <div key={ann.id} className={`p-3 rounded-lg border ${ann.priority === 'HIGH' ? 'bg-rose-50/60 border-rose-200' : 'bg-slate-50 border-slate-100'}`}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-bold text-slate-800 text-sm">{ann.title}</span>
                              {ann.priority === 'HIGH' && <span className="text-[10px] font-black uppercase bg-rose-100 text-rose-700 px-2 py-0.5 rounded">Urgente</span>}
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-2">{ann.content}</p>
                      </div>
                  ))}
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
              
              {/* ESTADO DE CUENTA ACTUAL */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                      <h3 className="text-lg font-bold text-slate-800">Estado de Cuenta Actual</h3>
                      {currentUnitDebt.historical > 0 && (
                          <button
                              onClick={handleDownloadDebtSummary}
                              disabled={downloadingPdfId === 'debt_summary'}
                              className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                          >
                              <Download className="w-3.5 h-3.5" />
                              {downloadingPdfId === 'debt_summary' ? 'Generando...' : 'Detalle de Deuda PDF'}
                          </button>
                      )}
                  </div>

                  <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                      <div className="w-full md:w-auto">
                          <p className="text-slate-500 mb-1 text-sm font-medium">Saldo Total a Pagar</p>
                          <p className={`text-4xl sm:text-5xl font-black tracking-tight ${currentUnitDebt.total > 1 ? 'text-red-600' : 'text-emerald-500'}`}>
                              {formatCurrency(currentUnitDebt.total)}
                          </p>
                          {currentUnitDebt.total > 1 ? (
                              <div className="mt-3 inline-flex items-center px-4 py-1.5 bg-red-50 border border-red-100 text-red-700 rounded-full text-xs font-bold shadow-sm">
                                  <AlertCircle className="w-4 h-4 mr-1.5" /> Saldo Pendiente de Pago
                              </div>
                          ) : (
                              <div className="mt-3 inline-flex items-center px-4 py-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-full text-xs font-bold shadow-sm">
                                  <CheckCircle className="w-4 h-4 mr-1.5" /> ¡Estás al día! Muchas gracias
                              </div>
                          )}
                      </div>
                      
                      {/* DATOS DE PAGO / CBU CON BOTÓN COPIAR */}
                      <div className="w-full md:w-auto md:min-w-[280px]">
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
                              {showBankTransferBox ? (
                                <>
                                  <p className="font-bold text-slate-700 mb-2.5 text-xs uppercase tracking-wider">Datos para Transferencia</p>
                                  {settings.bankName && (
                                      <div className="flex justify-between gap-4 mb-1.5 text-xs">
                                          <span className="text-slate-500">Banco:</span>
                                          <span className="font-semibold text-slate-700 text-right">{settings.bankName}</span>
                                      </div>
                                  )}
                                  {settings.bankHolder && (
                                      <div className="flex justify-between gap-4 mb-2 text-xs">
                                          <span className="text-slate-500">Titular:</span>
                                          <span className="font-semibold text-slate-700 text-right truncate max-w-[180px]">{settings.bankHolder}</span>
                                      </div>
                                  )}
                                  {settings.bankCBU && (
                                      <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 mb-2">
                                          <div className="min-w-0">
                                              <span className="text-[10px] font-bold text-slate-400 uppercase block">CBU / CVU</span>
                                              <span className="font-mono font-bold text-xs text-slate-800 break-all">{settings.bankCBU}</span>
                                          </div>
                                          <button
                                              type="button"
                                              onClick={() => handleCopy(settings.bankCBU, 'CBU')}
                                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors shrink-0"
                                              title="Copiar CBU"
                                          >
                                              {copiedField === 'CBU' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                                          </button>
                                      </div>
                                  )}
                                  {settings.bankAlias && (
                                      <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200">
                                          <div className="min-w-0">
                                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Alias</span>
                                              <span className="font-mono font-bold text-xs text-indigo-600 uppercase break-all">{settings.bankAlias}</span>
                                          </div>
                                          <button
                                              type="button"
                                              onClick={() => handleCopy(settings.bankAlias, 'ALIAS')}
                                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors shrink-0"
                                              title="Copiar Alias"
                                          >
                                              {copiedField === 'ALIAS' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                                          </button>
                                      </div>
                                  )}
                                </>
                              ) : settings.showBankDetailsOnCoupon === false ? (
                                <div>
                                  <p className="font-bold text-slate-700 mb-1">Modalidad de Pago</p>
                                  <p className="text-slate-600 text-xs">Abono presencial en efectivo en Administración del Consorcio.</p>
                                </div>
                              ) : (
                                <p className="text-amber-600 italic text-xs">Consultá los medios de pago con la administración.</p>
                              )}
                          </div>
                      </div>
                  </div>
                  
                  {/* DESGLOSE DE SALDOS (Expensa del Mes vs Deuda Anterior vs Saldo a Favor) */}
                  {(currentUnitDebt.total > 1 || (currentUnit.creditBalance || 0) > 0) && (
                      <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-3">
                          {currentUnitDebt.current > 0 && (
                              <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-200">
                                  Expensa {currentUnitDebt.pendingPeriod}: {formatCurrency(currentUnitDebt.current)}
                              </span>
                          )}
                          {currentUnitDebt.historical > 0 && (
                              <span className="text-xs font-bold bg-red-50 text-red-700 px-3 py-1.5 rounded-lg border border-red-200">
                                  Deuda Anterior / Mora: {formatCurrency(currentUnitDebt.historical)}
                              </span>
                          )}
                          {(currentUnit.creditBalance || 0) > 0 && (
                              <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200">
                                  Saldo a Favor disponible: {formatCurrency(currentUnit.creditBalance || 0)}
                              </span>
                          )}
                      </div>
                  )}

                  {/* AVISO DE PAGOS EN REVISIÓN PARA EVITAR ENVÍOS DUPLICADOS */}
                  {pendingUnitPayments.length > 0 && (
                      <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-900">
                          <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                              <p className="font-bold">
                                  Tenés {pendingUnitPayments.length === 1 ? '1 pago informado' : `${pendingUnitPayments.length} pagos informados`} en revisión ({formatCurrency(pendingAmountSum)})
                              </p>
                              <p className="text-amber-700 mt-0.5">
                                  Tu saldo se actualizará automáticamente apenas el administrador verifique e impute el comprobante.
                              </p>
                          </div>
                      </div>
                  )}
              </div>

              {/* LIQUIDACIONES / EXPENSAS DEL DEPARTAMENTO */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800">Mis Liquidaciones y Cupones</h3>
                      <span className="text-xs text-slate-400 font-medium">Últimos períodos</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                      {sortedHistory.length > 0 ? sortedHistory.slice(0, 12).map(rec => {
                          const detail = rec.unitDetails?.find(d => d.unitId === currentUnit.id);
                          if (!detail) return null;
                          
                          return (
                              <div key={rec.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 transition-colors gap-4">
                                  <div className="flex items-center gap-4">
                                      <div className="bg-white border border-slate-200 shadow-sm text-indigo-500 p-3 rounded-xl"><Building className="w-5 h-5"/></div>
                                      <div>
                                          <p className="font-bold text-slate-800 capitalize">{rec.month}</p>
                                          <p className="text-xs text-slate-500 font-medium">
                                              Cierre: {formatLocalDate(rec.dateClosed)}
                                              {rec.firstExpirationDate ? ` • 1° Vto: ${formatLocalDate(rec.firstExpirationDate)}` : ''}
                                          </p>
                                      </div>
                                  </div>
                                  
                                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-between sm:justify-end w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                                      <div className="text-left sm:text-right mr-2">
                                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Cuota del Mes</span>
                                          <span className="font-black text-slate-800 text-base">{formatCurrency(detail.totalToPay)}</span>
                                      </div>
                                      
                                      <div className="flex items-center gap-2">
                                          <button 
                                            onClick={() => handleDownloadGeneralSettlement(rec)}
                                            disabled={downloadingPdfId === `general_${rec.id}`}
                                            className="text-slate-600 hover:text-indigo-600 text-xs font-bold bg-white border border-slate-200 hover:border-indigo-300 px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                                            title="Descargar Expensa General del Edificio"
                                          >
                                              <FileText className="w-3.5 h-3.5"/> General
                                          </button>
                                          
                                          <button 
                                            onClick={() => handleDownloadMyCoupon(rec)}
                                            disabled={downloadingPdfId === `coupon_${rec.id}`}
                                            className="bg-indigo-600 text-white hover:bg-indigo-700 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                                            title="Descargar Mi Cupón Individual Detallado"
                                          >
                                              <Download className="w-3.5 h-3.5"/> Mi Cupón
                                          </button>
                                      </div>
                                  </div>
                              </div>
                          );
                      }) : <div className="p-8 text-center text-slate-400 font-medium">No hay liquidaciones cerradas todavía.</div>}
                  </div>
              </div>

              {/* MIS PAGOS Y COMPROBANTES INFORMADOS */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-indigo-600" /> Mis Pagos Informados
                      </h3>
                      <span className="text-xs text-slate-400 font-medium">UF {currentUnit.unitNumber}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                      {unitPayments.length > 0 ? unitPayments.slice(0, 10).map(p => (
                          <div key={p.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                              <div>
                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                      <span className="font-black text-slate-800 text-base">{formatCurrency(p.amount)}</span>
                                      {p.status === 'PENDING' && (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                              <Clock className="w-3 h-3" /> En Revisión
                                          </span>
                                      )}
                                      {p.status === 'APPROVED' && (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                              <CheckCircle className="w-3 h-3" /> Aprobado
                                          </span>
                                      )}
                                      {p.status === 'REJECTED' && (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                              <XCircle className="w-3 h-3" /> Rechazado
                                          </span>
                                      )}
                                  </div>
                                  <p className="text-xs text-slate-500 font-medium">
                                      Fecha de pago: {formatLocalDate(p.date)} • {p.method}
                                  </p>
                                  {p.notes && <p className="text-xs text-slate-400 mt-1 italic">"{p.notes}"</p>}
                              </div>

                              {p.attachmentUrl && (
                                  <a
                                      href={p.attachmentUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors w-fit"
                                  >
                                      <ExternalLink className="w-3.5 h-3.5" /> Ver Comprobante
                                  </a>
                              )}
                          </div>
                      )) : (
                          <div className="p-8 text-center text-slate-400 text-sm font-medium">
                              Aún no registraste pagos para esta unidad.
                          </div>
                      )}
                  </div>
              </div>
          </div>

          {/* COLUMNA DERECHA: RESERVAS Y DOCUMENTOS */}
          <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Calendar className="w-4 h-4 text-emerald-500"/> Mis Reservas Próximas</h3></div>
                  <div className="p-4">
                      {unitBookings.length > 0 ? unitBookings.slice(0, 4).map(b => (
                          <div key={b.id} className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-3 last:mb-0">
                              <div className="flex justify-between items-center mb-1">
                                  <p className="text-emerald-800 font-bold text-sm">{formatLocalDate(b.date)}</p>
                                  {b.date === todayIso && <span className="text-[10px] font-black uppercase bg-emerald-600 text-white px-2 py-0.5 rounded">Hoy</span>}
                              </div>
                              <div className="inline-block bg-white text-emerald-600 font-bold text-xs px-2 py-1 rounded shadow-sm">{b.timeSlot}</div>
                          </div>
                      )) : <p className="text-slate-400 text-sm text-center py-4">No tienes reservas activas.</p>}
                  </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100"><h3 className="font-bold text-slate-800 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500"/> Documentos del Edificio</h3></div>
                  <div className="p-4 space-y-2">
                      {recentDocs.length > 0 ? recentDocs.map(d => (
                          <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="flex items-center justify-between group cursor-pointer p-3 border border-slate-100 hover:border-blue-200 hover:bg-blue-50 rounded-xl transition-all">
                              <div className="min-w-0 mr-2">
                                  <span className="text-sm font-semibold text-slate-700 truncate block">{d.title}</span>
                                  <span className="text-[10px] font-bold uppercase text-slate-400">{d.category}</span>
                              </div>
                              <Download className="w-4 h-4 text-slate-300 group-hover:text-blue-600 flex-shrink-0"/>
                          </a>
                      )) : <p className="text-slate-400 text-sm text-center py-4">No hay documentos cargados.</p>}
                  </div>
              </div>
          </div>
      </div>

      {/* MODAL INFORMAR PAGO CON SUBIDA DE COMPROBANTE */}
      {showPaymentModal && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden my-8">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div>
                          <h3 className="font-black text-lg text-slate-800">Informar Pago</h3>
                          <p className="text-xs text-slate-500 font-medium">Unidad: <strong>{currentUnit.unitNumber}</strong> ({currentUnit.ownerName})</p>
                      </div>
                      <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500"/></button>
                  </div>
                  <form onSubmit={handleSubmitPayment} className="p-6 space-y-4">
                      <div>
                          <div className="flex justify-between items-center mb-1.5">
                              <label className="block text-sm font-bold text-slate-700">Monto Abonado ($) *</label>
                              {currentUnitDebt.total > 1 && (
                                  <button
                                      type="button"
                                      onClick={() => setAmount(currentUnitDebt.total.toFixed(2))}
                                      className="text-xs font-bold text-indigo-600 hover:underline"
                                  >
                                      Usar saldo ({formatCurrency(currentUnitDebt.total)})
                                  </button>
                              )}
                          </div>
                          <input
                              required
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={amount}
                              onChange={e => setAmount(e.target.value)}
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-lg font-bold text-indigo-700 transition-all"
                              placeholder="0.00"
                          />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1.5">Fecha del Pago *</label>
                              <input
                                  required
                                  type="date"
                                  value={date}
                                  onChange={e => setDate(e.target.value)}
                                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium text-slate-700 text-sm"
                              />
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1.5">Medio de Pago *</label>
                              <select
                                  value={method}
                                  onChange={e => setMethod(e.target.value as 'Transferencia' | 'Efectivo' | 'Cheque')}
                                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-bold text-slate-700 text-sm"
                              >
                                  <option value="Transferencia">Transferencia</option>
                                  <option value="Efectivo">Efectivo</option>
                                  <option value="Cheque">Cheque / Depósito</option>
                              </select>
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">Comprobante (Foto o PDF)</label>
                          <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-4 text-center bg-slate-50/70 transition-colors relative cursor-pointer">
                              <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  onChange={handleFileChange}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              />
                              {file ? (
                                  <div className="flex items-center justify-between gap-2 text-left">
                                      <div className="flex items-center gap-2 min-w-0">
                                          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                                          <div className="min-w-0">
                                              <p className="text-xs font-bold text-emerald-700 truncate">{file.name}</p>
                                              <p className="text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                          </div>
                                      </div>
                                      <button
                                          type="button"
                                          onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); setFile(null); }}
                                          className="text-xs font-bold text-rose-600 hover:underline relative z-10 px-2 py-1"
                                      >
                                          Quitar
                                      </button>
                                  </div>
                              ) : (
                                  <div className="flex flex-col items-center py-1 text-slate-500">
                                      <Upload className="w-6 h-6 text-indigo-500 mb-1" />
                                      <span className="text-xs font-bold text-slate-700">Tocá para adjuntar captura o PDF</span>
                                      <span className="text-[11px] text-slate-400 mt-0.5">JPG, PNG o PDF (máx. 10 MB)</span>
                                  </div>
                              )}
                          </div>
                          {fileError && <p className="text-xs text-rose-600 font-semibold mt-1.5">{fileError}</p>}
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">Aclaraciones (Opcional)</label>
                          <textarea
                              value={notes}
                              onChange={e => setNotes(e.target.value)}
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
                              placeholder="Ej: Transferencia enviada desde cuenta de María Gómez..."
                              rows={2}
                          />
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                          <button
                              disabled={isSubmitting || !!fileError}
                              type="submit"
                              className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md flex justify-center items-center gap-2"
                          >
                              {isSubmitting ? (
                                  <>
                                      <Loader2 className="w-5 h-5 animate-spin"/>
                                      <span>Subiendo e informando...</span>
                                  </>
                              ) : (
                                  <span>Enviar Informe de Pago</span>
                              )}
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
