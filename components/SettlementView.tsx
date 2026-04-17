import React, { useMemo, useState } from 'react';
import { Unit, Expense, ExpenseDistributionType, SettlementRecord, ConsortiumSettings, ViewState, Consortium } from '../types';
import { Archive, FileText, Calculator, Calendar, User, Download, CheckSquare } from 'lucide-react';
import { generateSettlementPDF, generateIndividualCouponPDF } from '../services/pdfService';

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
      reader.onloadend = () => {
        const base64data = reader.result;
        resolve(base64data as string);
      };
    });
  } catch (e) {
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
  const [testUnitId, setTestUnitId] = useState<string>(''); // Para elegir la UF de prueba
  
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 10);
  const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 20);
  const [firstDate, setFirstDate] = useState(nextMonth.toISOString().split('T')[0]);
  const [secondDate, setSecondDate] = useState(nextMonthEnd.toISOString().split('T')[0]);

  // CÁLCULO INTELIGENTE UNIDAD POR UNIDAD
  const { totalOrdinary, totalExtraordinary, totalReserveSpent, reserveContribution, newReserveBalance, unitDebts } = useMemo(() => {
      let tOrd = 0;
      let tExt = 0;
      let tRes = 0;

      // Filtramos unidades unicas por las dudas
      const uniqueUnitsMap = new Map();
      units.forEach(u => uniqueUnitsMap.set(u.id, u));
      const uniqueUnits = Array.from(uniqueUnitsMap.values()) as Unit[];

      // Inicializamos el mapa de deudas
      const debtsMap = new Map<string, number>();
      uniqueUnits.forEach(u => debtsMap.set(u.id, 0));

      // Calculamos gasto por gasto
      expenses.forEach(exp => {
          if (exp.distributionType === ExpenseDistributionType.FROM_RESERVE) {
              tRes += exp.amount;
              return; // Lo paga la reserva, no se divide entre UF
          }

          if (exp.category === 'Ordinary') tOrd += exp.amount;
          else if (exp.category === 'Extraordinary') tExt += exp.amount;

          // ¿A quién afecta este gasto?
          let affectedUnits = uniqueUnits;
          if (exp.affectedUnitIds && exp.affectedUnitIds.length > 0) {
              affectedUnits = uniqueUnits.filter(u => exp.affectedUnitIds!.includes(u.id));
          }

          if (affectedUnits.length === 0) return;

          // Distribuimos el monto
          if (exp.distributionType === ExpenseDistributionType.EQUAL_PARTS) {
              const share = exp.amount / affectedUnits.length;
              affectedUnits.forEach(u => debtsMap.set(u.id, debtsMap.get(u.id)! + share));
          } else {
              // PRORATEO: Sumamos los coeficientes de los afectados para hacer la regla de 3
              const totalProrate = affectedUnits.reduce((sum, u) => sum + u.proratePercentage, 0);
              affectedUnits.forEach(u => {
                  const share = exp.amount * (u.proratePercentage / totalProrate);
                  debtsMap.set(u.id, debtsMap.get(u.id)! + share);
              });
          }
      });

      // Cálculo Global de Reserva (El aporte es un % del Total Ordinario)
      const resContribution = (tOrd * settings.monthlyReserveContributionPercentage) / 100;
      
      // Distribuimos la reserva usando el porcentaje de prorrateo original
      const totalGlobalProrate = uniqueUnits.reduce((sum, u) => sum + u.proratePercentage, 0);
      uniqueUnits.forEach(u => {
           const reserveShare = resContribution * (u.proratePercentage / totalGlobalProrate);
           debtsMap.set(u.id, debtsMap.get(u.id)! + reserveShare);
      });

      const resBalance = settings.reserveFundBalance - tRes + resContribution;

      // Armamos el Array final
      const finalUnitDebts = uniqueUnits.map(u => ({
          unitId: u.id, unitNumber: u.unitNumber, owner: u.ownerName, total: debtsMap.get(u.id)!
      })).sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }));

      return {
          totalOrdinary: tOrd,
          totalExtraordinary: tExt,
          totalReserveSpent: tRes,
          reserveContribution: resContribution,
          newReserveBalance: resBalance,
          unitDebts: finalUnitDebts
      };
  }, [units, expenses, settings]);

  const preparePDFData = async () => {
      let logoBase64 = null;
      if (settings.logoUrl) logoBase64 = await convertImgToBase64(settings.logoUrl);

      const consortiumData: any = {
          id: consortiumId, name: consortiumName, address: settings.address || '', cuit: settings.cuit,
          image: logoBase64, bankName: settings.bankName, bankCBU: settings.bankCBU, bankAlias: settings.bankAlias, bankHolder: settings.bankHolder, adminIds: []
      };

      const dummyRecord: SettlementRecord = {
          id: 'preview', month: 'BORRADOR / VISTA PREVIA', dateClosed: new Date().toISOString(),
          totalExpenses: totalOrdinary + totalExtraordinary, totalCollected: 0, reserveBalanceStart: settings.reserveFundBalance,
          reserveContribution, reserveExpense: totalReserveSpent, reserveBalanceAtClose: newReserveBalance,
          firstExpirationDate: firstDate, secondExpirationDate: secondDate, snapshotExpenses: expenses, couponMessage,
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

  const handleTestCoupon = async () => {
      if (!testUnitId) return alert("Selecciona una unidad para probar.");
      setIsProcessing(true);
      const { consortiumData, dummyRecord } = await preparePDFData();
      
      const debtItem = unitDebts.find(u => u.unitId === testUnitId);
      const rawUnit = units.find(u => u.id === testUnitId);
      
      if (!debtItem || !rawUnit) {
          alert("Error encontrando la unidad.");
          setIsProcessing(false);
          return;
      }

      const safeUnit: Unit = {
          id: rawUnit.id, unitNumber: rawUnit.unitNumber || '?', ownerName: rawUnit.ownerName || '?',
          proratePercentage: Number(rawUnit.proratePercentage || 0), initialBalance: rawUnit.initialBalance || 0, 
          authorizedEmails: rawUnit.authorizedEmails || [], debts: rawUnit.debts || []
      };
      
      generateIndividualCouponPDF(dummyRecord, safeUnit, consortiumData);
      setIsProcessing(false);
  };

  const handleClose = async () => {
      if(!confirm("¿CONFIRMAR CIERRE DEFINITIVO?\n\n1. Se guardará el historial.\n2. Se actualizará la caja.\n3. Se DESCARGARÁN todos los cupones a tu PC.")) return;
      setIsProcessing(true);
      
      const { consortiumData } = await preparePDFData();

      const record: SettlementRecord = {
          id: '', month: new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' }), dateClosed: new Date().toISOString(),
          totalExpenses: totalOrdinary + totalExtraordinary, totalCollected: 0, reserveBalanceStart: settings.reserveFundBalance,
          reserveContribution, reserveExpense: totalReserveSpent, reserveBalanceAtClose: newReserveBalance,
          firstExpirationDate: firstDate, secondExpirationDate: secondDate, snapshotExpenses: expenses, couponMessage,
          unitDetails: unitDebts.map(u => ({ unitId: u.unitId, totalToPay: u.total }))
      };

      const finalRecordForPDF = { ...record };

      try {
          onCloseMonth(record);
          const unitsToPrint = unitDebts.filter(u => u.total > 0);
          
          let delay = 0;
          unitsToPrint.forEach((debtItem) => {
              setTimeout(() => {
                  const rawUnit = units.find(u => u.id === debtItem.unitId);
                  const safeUnit: Unit = {
                      id: debtItem.unitId, unitNumber: debtItem.unitNumber || '?', ownerName: debtItem.owner || '?',
                      proratePercentage: Number(rawUnit?.proratePercentage || 0), initialBalance: rawUnit?.initialBalance || 0, 
                      authorizedEmails: rawUnit?.authorizedEmails || [], debts: rawUnit?.debts || []
                  };
                  generateIndividualCouponPDF(finalRecordForPDF, safeUnit, consortiumData);
              }, delay);
              delay += 500;
          });

          alert(`Liquidación Cerrada Exitosamente.\n\nSe están descargando ${unitsToPrint.length} cupones de pago.`);
      } catch (error) {
          alert("Error al cerrar el mes.");
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Cierre de Liquidación</h2>
            <p className="text-slate-500">Revise los números, fechas y cupones de prueba antes de emitir.</p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
              {/* SELECTOR DE CUPÓN DE PRUEBA */}
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                  <select 
                      className="bg-transparent text-sm font-medium outline-none px-2 text-slate-700 w-32" 
                      value={testUnitId} 
                      onChange={e => setTestUnitId(e.target.value)}
                  >
                      <option value="">Elegir UF...</option>
                      {units.map(u => <option key={u.id} value={u.id}>UF {u.unitNumber}</option>)}
                  </select>
                  <button onClick={handleTestCoupon} disabled={isProcessing || !testUnitId} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 font-bold rounded-md hover:bg-indigo-100 disabled:opacity-50 transition-colors">
                      <Download className="w-4 h-4" /> Probar Cupón
                  </button>
              </div>

              <div className="h-8 w-px bg-slate-300 hidden xl:block"></div>

              <button onClick={handlePreviewPDF} disabled={isProcessing} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 shadow-sm disabled:opacity-50">
                  {isProcessing ? 'Generando...' : <><FileText className="w-4 h-4" /> Expensa Global</>}
              </button>
              <button onClick={handleClose} disabled={isProcessing} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50 transition-colors">
                  {isProcessing ? 'Procesando...' : <><Archive className="w-4 h-4" /> Cierre Definitivo</>}
              </button>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Calculator className="w-5 h-5 text-indigo-500"/> Resumen Financiero</h3>
                  <div className="space-y-3">
                      <div className="flex justify-between text-sm"><span className="text-slate-600">Gastos Ordinarios</span><span className="font-bold">{formatCurrency(totalOrdinary)}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-600">Gastos Extraordinarios</span><span className="font-bold">{formatCurrency(totalExtraordinary)}</span></div>
                      <div className="flex justify-between text-sm pt-2 border-t border-slate-100"><span className="text-slate-600">+ Fondo Reserva (Aporte)</span><span className="font-bold text-emerald-600">{formatCurrency(reserveContribution)}</span></div>
                      <div className="flex justify-between text-lg pt-2 border-t border-slate-200 font-bold"><span className="text-slate-800">Total Distribuido</span><span className="text-indigo-600">{formatCurrency(totalOrdinary + totalExtraordinary + reserveContribution)}</span></div>
                  </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-indigo-500"/> Vencimientos</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">1° Vencimiento</label>
                          <input type="date" className="w-full p-2 border rounded font-bold text-slate-700 outline-none focus:border-indigo-500" value={firstDate} onChange={e => setFirstDate(e.target.value)} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">2° Vencimiento</label>
                          <input type="date" className="w-full p-2 border rounded font-bold text-slate-700 outline-none focus:border-indigo-500" value={secondDate} onChange={e => setSecondDate(e.target.value)} />
                      </div>
                  </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-700 mb-2 text-sm flex items-center gap-2"><CheckSquare className="w-4 h-4 text-indigo-500"/> Mensaje en Liquidación</h3>
                  <textarea 
                    className="w-full p-3 border rounded-lg text-sm outline-none focus:border-indigo-500 bg-slate-50" 
                    rows={4} 
                    placeholder="Ej: Se recuerda a los vecinos mantener limpios los espacios comunes..." 
                    value={couponMessage}
                    onChange={e => setCouponMessage(e.target.value)}
                  />
              </div>
          </div>

          <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[700px]">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><User className="w-5 h-5 text-indigo-500"/> Distribución Final por Unidad</h3>
              <p className="text-xs text-slate-500 mb-4">Monto exacto calculado sumando todas las expensas que le corresponden a cada UF (Prorrateo y Partes Iguales).</p>
              <div className="flex-1 overflow-y-auto pr-2">
                  <table className="w-full text-sm">
                      <thead className="bg-slate-100 text-slate-600 sticky top-0 uppercase text-xs">
                          <tr><th className="px-4 py-3 text-left">UF</th><th className="px-4 py-3 text-left">Propietario</th><th className="px-4 py-3 text-right">Cuota Período</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {unitDebts.map(u => (
                              <tr key={u.unitId} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-3 font-bold text-slate-800">{u.unitNumber}</td>
                                  <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">{u.owner}</td>
                                  <td className="px-4 py-3 text-right font-black text-emerald-600">{formatCurrency(u.total)}</td>
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