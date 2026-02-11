import React, { useMemo, useState } from 'react';
import { Unit, Expense, ExpenseDistributionType, SettlementRecord, ConsortiumSettings, ViewState, Consortium } from '../types';
import { Archive, FileText, Calculator, Calendar, User, Download } from 'lucide-react';
import { generateSettlementPDF, generateIndividualCouponPDF } from '../services/pdfService';
import { sendSettlementEmail } from '../services/emailService';

// --- FUNCIÓN AUXILIAR PARA EL LOGO ---
const convertImgToBase64 = async (url: string): Promise<string | null> => {
  if (!url) return null;
  try {
    const data = await fetch(url);
    const blob = await data.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64data = reader.result;
        resolve(base64data as string);
      };
    });
  } catch (e) {
    console.error("Error convirtiendo imagen", e);
    return null;
  }
};

interface SettlementViewProps {
  units: Unit[];
  expenses: Expense[];
  settings: ConsortiumSettings;
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  consortiumId: string;
  consortiumName: string;
  updateReserveBalance: (newBalance: number) => void;
  onUpdateBankSettings: (settings: Partial<ConsortiumSettings>) => void;
  onCloseMonth: (record: SettlementRecord) => void;
  onChangeView: (view: ViewState) => void;
}

const SettlementView: React.FC<SettlementViewProps> = ({ units, expenses, settings, setExpenses, consortiumId, consortiumName, updateReserveBalance, onUpdateBankSettings, onCloseMonth, onChangeView }) => {
  const [couponMessage, setCouponMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 10);
  const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 20);
  const [firstDate, setFirstDate] = useState(nextMonth.toISOString().split('T')[0]);
  const [secondDate, setSecondDate] = useState(nextMonthEnd.toISOString().split('T')[0]);

  // CÁLCULOS
  const totalOrdinary = expenses.filter(e => e.category === 'Ordinary' && e.distributionType !== ExpenseDistributionType.FROM_RESERVE).reduce((a, b) => a + b.amount, 0);
  const totalExtraordinary = expenses.filter(e => e.category === 'Extraordinary' && e.distributionType !== ExpenseDistributionType.FROM_RESERVE).reduce((a, b) => a + b.amount, 0);
  const totalReserveSpent = expenses.filter(e => e.distributionType === ExpenseDistributionType.FROM_RESERVE).reduce((a, b) => a + b.amount, 0);
  
  const reserveContribution = (totalOrdinary * settings.monthlyReserveContributionPercentage) / 100;
  const newReserveBalance = settings.reserveFundBalance - totalReserveSpent + reserveContribution;

  const unitDebts = useMemo(() => {
      const totalToDistribute = totalOrdinary + totalExtraordinary + reserveContribution;
      const uniqueUnitsMap = new Map();
      units.forEach(u => {
          const key = u.unitNumber.trim().toUpperCase();
          if (!uniqueUnitsMap.has(key)) uniqueUnitsMap.set(key, u);
      });
      const uniqueUnits = Array.from(uniqueUnitsMap.values()) as Unit[];

      return uniqueUnits.map(u => {
          const share = totalToDistribute * (u.proratePercentage / 100);
          return { unitId: u.id, unitNumber: u.unitNumber, owner: u.ownerName, total: share };
      }).sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }));
  }, [units, totalOrdinary, totalExtraordinary, reserveContribution]);

  // --- PREPARAR DATOS COMUNES ---
  const preparePDFData = async () => {
      let logoBase64 = null;
      if (settings.logoUrl) {
          logoBase64 = await convertImgToBase64(settings.logoUrl);
      }

      const consortiumData: any = {
          id: consortiumId,
          name: consortiumName,
          address: settings.address || '',
          cuit: settings.cuit,
          image: logoBase64,
          bankName: settings.bankName,
          bankCBU: settings.bankCBU,
          bankAlias: settings.bankAlias,
          bankHolder: settings.bankHolder,
          adminIds: []
      };

      const dummyRecord: SettlementRecord = {
          id: 'preview',
          month: 'BORRADOR / VISTA PREVIA',
          dateClosed: new Date().toISOString(),
          totalExpenses: totalOrdinary + totalExtraordinary,
          totalCollected: 0,
          reserveBalanceStart: settings.reserveFundBalance,
          reserveContribution,
          reserveExpense: totalReserveSpent,
          reserveBalanceAtClose: newReserveBalance,
          firstExpirationDate: firstDate,
          secondExpirationDate: secondDate,
          snapshotExpenses: expenses,
          couponMessage,
          unitDetails: unitDebts.map(u => ({ unitId: u.unitId, totalToPay: u.total }))
      };

      return { consortiumData, dummyRecord };
  };

  const handlePreviewPDF = async () => {
      setIsProcessing(true);
      const { consortiumData, dummyRecord } = await preparePDFData();
      generateSettlementPDF(dummyRecord, consortiumData, units);
      setIsProcessing(false);
  };

  // --- FUNCIÓN DE PRUEBA ---
  const handleTestCoupons = async () => {
      if (!confirm("Esto descargará los primeros 3 cupones individuales. ¿Continuar?")) return;
      
      setIsProcessing(true);
      const { consortiumData, dummyRecord } = await preparePDFData();

      const validTestUnits = unitDebts.filter(u => u.total > 0 && u.unitNumber).slice(0, 3);

      if (validTestUnits.length === 0) {
          alert("No hay unidades con deuda calculada para probar.");
          setIsProcessing(false);
          return;
      }

      validTestUnits.forEach(debtItem => {
          const rawUnit = units.find(u => u.id === debtItem.unitId);
          
          const safeUnit: Unit = {
              id: debtItem.unitId,
              unitNumber: debtItem.unitNumber || '?',
              ownerName: debtItem.owner || '?',
              proratePercentage: Number(rawUnit?.proratePercentage || 0),
              initialBalance: rawUnit?.initialBalance || 0,
              authorizedEmails: rawUnit?.authorizedEmails || []
          };
          
          generateIndividualCouponPDF(dummyRecord, safeUnit, consortiumData);
      });

      setIsProcessing(false);
  };

  // --- CIERRE DEFINITIVO (CORREGIDO PARA DESCARGAR TODO BIEN) ---
  const handleClose = async () => {
      if(!confirm("¿CONFIRMAR CIERRE DEFINITIVO?\n\n1. Se guardará el historial.\n2. Se actualizará la caja.\n3. Se DESCARGARÁN todos los cupones a tu PC.")) return;
      
      setIsProcessing(true);
      
      // 1. Preparamos los datos RICOS (con Banco y Logo)
      const { consortiumData } = await preparePDFData();

      const record: SettlementRecord = {
          id: '', 
          month: new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' }),
          dateClosed: new Date().toISOString(),
          totalExpenses: totalOrdinary + totalExtraordinary,
          totalCollected: 0, 
          reserveBalanceStart: settings.reserveFundBalance,
          reserveContribution,
          reserveExpense: totalReserveSpent,
          reserveBalanceAtClose: newReserveBalance,
          firstExpirationDate: firstDate,
          secondExpirationDate: secondDate,
          snapshotExpenses: expenses,
          couponMessage,
          unitDetails: unitDebts.map(u => ({ unitId: u.unitId, totalToPay: u.total }))
      };

      // Sobreescribimos el record del PDF para que tenga los datos finales
      const finalRecordForPDF = { ...record };

      try {
          // 2. Guardar en Base de Datos
          onCloseMonth(record);

          // 3. DESCARGA MASIVA DE CUPONES (Reemplaza al email)
          // Filtramos unidades con deuda > 0
          const unitsToPrint = unitDebts.filter(u => u.total > 0);
          
          console.log("Generando PDFs para", unitsToPrint.length, "unidades...");

          // Usamos un retraso pequeño entre descargas para no bloquear el navegador
          let delay = 0;
          unitsToPrint.forEach((debtItem) => {
              setTimeout(() => {
                  const rawUnit = units.find(u => u.id === debtItem.unitId);
                  // Construimos la unidad SEGURA (igual que en Test)
                  const safeUnit: Unit = {
                      id: debtItem.unitId,
                      unitNumber: debtItem.unitNumber || '?',
                      ownerName: debtItem.owner || '?',
                      proratePercentage: Number(rawUnit?.proratePercentage || 0),
                      initialBalance: rawUnit?.initialBalance || 0,
                      authorizedEmails: rawUnit?.authorizedEmails || []
                  };
                  // Generar y Descargar
                  generateIndividualCouponPDF(finalRecordForPDF, safeUnit, consortiumData);
              }, delay);
              delay += 500; // 0.5 segundos entre cada descarga
          });

          alert(`Liquidación Cerrada Exitosamente.\n\nSe están descargando ${unitsToPrint.length} cupones de pago.`);

      } catch (error) {
          console.error(error);
          alert("Error al cerrar el mes.");
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Cierre de Liquidación</h2>
            <p className="text-slate-500">Revise los números y fechas antes de emitir.</p>
          </div>
          <div className="flex gap-2">
              <button onClick={handleTestCoupons} disabled={isProcessing} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold rounded-lg hover:bg-emerald-100 shadow-sm disabled:opacity-50">
                  <Download className="w-4 h-4" /> Probar Cupones
              </button>
              <button onClick={handlePreviewPDF} disabled={isProcessing} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 shadow-sm disabled:opacity-50">
                  {isProcessing ? 'Generando...' : <><FileText className="w-4 h-4" /> Expensa Global</>}
              </button>
              <button onClick={handleClose} disabled={isProcessing} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50">
                  {isProcessing ? 'Procesando...' : <><Archive className="w-4 h-4" /> Cerrar Mes</>}
              </button>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-6">
              {/* TOTALES */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Calculator className="w-5 h-5 text-indigo-500"/> Resumen Financiero</h3>
                  <div className="space-y-3">
                      <div className="flex justify-between text-sm"><span className="text-slate-600">Gastos Ordinarios</span><span className="font-bold">${totalOrdinary.toFixed(2)}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-600">Gastos Extraordinarios</span><span className="font-bold">${totalExtraordinary.toFixed(2)}</span></div>
                      <div className="flex justify-between text-sm pt-2 border-t"><span className="text-slate-600">+ Fondo Reserva (Aporte)</span><span className="font-bold text-emerald-600">${reserveContribution.toFixed(2)}</span></div>
                      <div className="flex justify-between text-lg pt-2 border-t border-slate-100 font-bold"><span className="text-slate-800">Total a Prorratear</span><span className="text-indigo-600">${(totalOrdinary + totalExtraordinary + reserveContribution).toFixed(2)}</span></div>
                  </div>
              </div>

              {/* FECHAS DE VENCIMIENTO */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-indigo-500"/> Vencimientos</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">1° Vencimiento</label>
                          <input type="date" className="w-full p-2 border rounded font-bold text-slate-700" value={firstDate} onChange={e => setFirstDate(e.target.value)} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">2° Vencimiento</label>
                          <input type="date" className="w-full p-2 border rounded font-bold text-slate-700" value={secondDate} onChange={e => setSecondDate(e.target.value)} />
                      </div>
                  </div>
              </div>

              {/* MENSAJE EN CUPON */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-700 mb-2 text-sm">Mensaje en Liquidación</h3>
                  <textarea 
                    className="w-full p-2 border rounded-lg text-sm" 
                    rows={3} 
                    placeholder="Ej: Se recuerda que..." 
                    value={couponMessage}
                    onChange={e => setCouponMessage(e.target.value)}
                  />
              </div>
          </div>

          {/* TABLA DE PRORRATEO */}
          <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[600px]">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><User className="w-5 h-5 text-indigo-500"/> Distribución por Unidad</h3>
              <div className="flex-1 overflow-y-auto pr-2">
                  <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500 sticky top-0">
                          <tr><th className="px-3 py-2 text-left">UF</th><th className="px-3 py-2 text-left">Propietario</th><th className="px-3 py-2 text-right">%</th><th className="px-3 py-2 text-right">Cuota</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {unitDebts.map(u => (
                              <tr key={u.unitId} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 font-bold text-slate-700">{u.unitNumber}</td>
                                  <td className="px-3 py-2 text-slate-600 truncate max-w-[150px]">{u.owner}</td>
                                  <td className="px-3 py-2 text-right text-slate-500">{units.find(un => un.id === u.unitId)?.proratePercentage}%</td>
                                  <td className="px-3 py-2 text-right font-bold text-emerald-600">${u.total.toFixed(2)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
    </div>
  );
};

export default SettlementView;