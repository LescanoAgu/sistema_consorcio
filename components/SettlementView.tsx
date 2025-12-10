import React, { useMemo, useState, useEffect } from 'react';
import { Unit, Expense, AppSettings, ExpenseDistributionType, SettlementRecord } from '../types';
import { generateMonthlyReport } from '../services/geminiService';
import { FileText, Loader2, Archive, AlertTriangle, AlertCircle, Edit2, Check } from 'lucide-react';

interface SettlementViewProps {
  units: Unit[];
  expenses: Expense[];
  settings: AppSettings;
  updateReserveBalance: (newBalance: number) => void;
  onCloseMonth: (record: SettlementRecord) => void;
}

const SettlementView: React.FC<SettlementViewProps> = ({ units, expenses, settings, onCloseMonth }) => {
  const [generatingReport, setGeneratingReport] = useState(false);
  const [aiReport, setAiReport] = useState<string>('');
  
  // Estado para editar el saldo inicial manualmente
  const [isEditingReserve, setIsEditingReserve] = useState(false);
  const [manualReserveBalance, setManualReserveBalance] = useState(settings.reserveFundBalance);

  // Sincronizar si cambian los settings externos
  useEffect(() => {
    setManualReserveBalance(settings.reserveFundBalance);
  }, [settings.reserveFundBalance]);

  // Validaciones
  const totalPercentage = units.reduce((acc, u) => acc + u.proratePercentage, 0);
  const isPercentageValid = Math.abs(totalPercentage - 100) < 0.1;

  // 1. Cálculos de Totales
  const { totalOrdinary, totalExtraordinary, totalFromReserve, expensesProrated, expensesEqual } = useMemo(() => {
    let ord = 0, extra = 0, reserve = 0;
    const prorated: Expense[] = [];
    const equal: Expense[] = [];

    expenses.forEach(e => {
      if (e.distributionType === ExpenseDistributionType.FROM_RESERVE) {
        reserve += e.amount;
      } else {
        if (e.category === 'Ordinary') ord += e.amount;
        else extra += e.amount;

        if (e.distributionType === ExpenseDistributionType.PRORATED) prorated.push(e);
        else if (e.distributionType === ExpenseDistributionType.EQUAL_PARTS) equal.push(e);
      }
    });

    return { 
        totalOrdinary: ord, 
        totalExtraordinary: extra, 
        totalFromReserve: reserve, 
        expensesProrated: prorated, 
        expensesEqual: equal 
    };
  }, [expenses]);

  // 2. Cálculo del Fondo (CRITERIO CAJA: Lo que hay - Lo que sale)
  const monthlyReserveContributionAmount = (totalOrdinary * settings.monthlyReserveContributionPercentage) / 100;
  
  // LÓGICA CORREGIDA: Saldo Final = Saldo Inicial - Gastos Pagados con Fondo
  // El aporte se cobra aparte, no entra mágicamente a la caja hoy.
  const projectedReserveBalance = manualReserveBalance - totalFromReserve;

  // 3. Cálculo por Unidad
  const settlementData = useMemo(() => {
    return units.map(unit => {
      const proratedShare = expensesProrated.reduce((acc, exp) => acc + exp.amount, 0) * (unit.proratePercentage / 100);
      const equalShare = expensesEqual.reduce((acc, exp) => acc + exp.amount, 0) / units.length;
      const reserveContributionShare = monthlyReserveContributionAmount * (unit.proratePercentage / 100);
      
      return {
        ...unit,
        proratedShare,
        equalShare,
        reserveContributionShare,
        totalToPay: proratedShare + equalShare + reserveContributionShare
      };
    });
  }, [units, expensesProrated, expensesEqual, monthlyReserveContributionAmount]);

  const totalToCollect = settlementData.reduce((acc, curr) => acc + curr.totalToPay, 0);

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    const monthName = new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    const report = await generateMonthlyReport(monthName, expenses, units, totalToCollect, projectedReserveBalance);
    setAiReport(report);
    setGeneratingReport(false);
  };

  const handleConfirmSettlement = () => {
      if(!isPercentageValid) return alert("Los porcentajes de las unidades no suman 100%.");
      
      if(confirm("¿Cerrar liquidación y generar PDF?")) {
          const record: SettlementRecord = {
              id: crypto.randomUUID(),
              month: new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' }),
              dateClosed: new Date().toISOString(),
              totalExpenses: totalOrdinary + totalExtraordinary + totalFromReserve,
              totalCollected: totalToCollect,
              
              // Datos del fondo corregidos
              reserveBalanceStart: manualReserveBalance,
              reserveContribution: monthlyReserveContributionAmount, // Se guarda para informar cuánto se pidió
              reserveExpense: totalFromReserve,
              reserveBalanceAtClose: projectedReserveBalance, // El saldo real de caja
              
              snapshotExpenses: [...expenses],
              aiReportSummary: aiReport,
              unitDetails: settlementData.map(d => ({ unitId: d.id, totalToPay: d.totalToPay }))
          };
          
          onCloseMonth(record);
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Liquidación de Expensas</h2>
           <p className="text-slate-500 text-sm">Resumen y cierre mensual</p>
        </div>
        <div className="flex gap-2">
            <button onClick={handleGenerateReport} disabled={generatingReport} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-lg flex items-center transition-colors">
                {generatingReport ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <FileText className="w-4 h-4 mr-2"/>}
                Generar Aviso IA
            </button>
             <button onClick={handleConfirmSettlement} disabled={!isPercentageValid} className={`px-4 py-2 rounded-lg flex items-center text-white ${!isPercentageValid ? 'bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                <Archive className="w-4 h-4 mr-2"/> Cerrar Mes
            </button>
        </div>
      </div>

      {!isPercentageValid && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex gap-3 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              <p>Error: Porcentajes suman {totalPercentage.toFixed(2)}%. Ajuste en "Unidades".</p>
          </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500 uppercase font-bold">Ordinarios</p>
            <p className="text-2xl font-bold text-slate-800">${totalOrdinary.toFixed(2)}</p>
        </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500 uppercase font-bold">Extraordinarios</p>
            <p className="text-2xl font-bold text-slate-800">${totalExtraordinary.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 bg-amber-50 border-amber-100">
            <p className="text-xs text-amber-700 uppercase font-bold">Pagado x Fondo</p>
            <p className="text-2xl font-bold text-amber-700">-${totalFromReserve.toFixed(2)}</p>
        </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 bg-indigo-50 border-indigo-100">
            <p className="text-xs text-indigo-700 uppercase font-bold">A Recaudar Total</p>
            <p className="text-2xl font-bold text-indigo-700">${totalToCollect.toFixed(2)}</p>
        </div>
      </div>
      
      {/* SECCIÓN FONDO DE RESERVA EDITABLE - LÓGICA CAJA */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
         <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
             <h3 className="font-bold text-slate-700 flex items-center gap-2">
                 <AlertCircle className="w-5 h-5 text-emerald-500"/>
                 Movimientos del Fondo de Reserva (Caja Real)
             </h3>
             <div className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-bold">
                 Saldo Disponible: ${projectedReserveBalance.toFixed(2)}
             </div>
         </div>

         <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-sm">
             {/* Saldo Inicial Editable */}
             <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 w-full md:w-auto">
                 <span className="text-slate-500 font-medium">Saldo Inicial:</span>
                 {isEditingReserve ? (
                     <div className="flex items-center gap-1">
                         <span className="text-slate-400 font-bold">$</span>
                         <input 
                            type="number" 
                            className="w-24 p-1 border rounded text-right font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={manualReserveBalance}
                            onChange={(e) => setManualReserveBalance(parseFloat(e.target.value) || 0)}
                         />
                         <button onClick={() => setIsEditingReserve(false)} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"><Check className="w-4 h-4"/></button>
                     </div>
                 ) : (
                     <div className="flex items-center gap-2">
                         <strong className="text-lg text-slate-700">${manualReserveBalance.toFixed(2)}</strong>
                         <button onClick={() => setIsEditingReserve(true)} className="text-slate-400 hover:text-indigo-600" title="Corregir Saldo Inicial">
                             <Edit2 className="w-4 h-4"/>
                         </button>
                     </div>
                 )}
             </div>

             {/* Aporte Informativo (Gris, porque no suma) */}
             <div className="flex flex-col items-center opacity-60 grayscale" title="Este monto se cobrará en las expensas, ingresará a la caja el mes que viene">
                 <span className="text-slate-500 mb-1 text-xs">A Recaudar (Futuro)</span>
                 <strong className="text-slate-500 text-sm border border-dashed border-slate-300 px-2 py-0.5 rounded">+${monthlyReserveContributionAmount.toFixed(2)}</strong>
             </div>

             <div className="text-slate-400 font-bold text-xl hidden md:block">-</div>

             <div className="flex flex-col items-center">
                 <span className="text-slate-500 mb-1">Gastos del Fondo</span>
                 <strong className="text-red-500 text-lg">-${totalFromReserve.toFixed(2)}</strong>
             </div>
             
             <div className="text-slate-400 font-bold text-xl hidden md:block">=</div>

             <div className="flex flex-col items-center p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                 <span className="text-emerald-800 text-xs uppercase font-bold mb-1">Saldo Final</span>
                 <strong className="text-emerald-700 text-xl">${projectedReserveBalance.toFixed(2)}</strong>
             </div>
         </div>
      </div>
      
      {/* Expenses Review Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
          <div className="bg-slate-50 px-6 py-2 border-b border-slate-200">
              <h4 className="text-sm font-bold text-slate-700 uppercase">Revisión de Gastos</h4>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
                <tr className="text-slate-500 border-b border-slate-100">
                    <th className="px-6 py-2 font-normal">Descripción</th>
                    <th className="px-6 py-2 font-normal">Rubro</th>
                    <th className="px-6 py-2 font-normal">Tipo</th>
                    <th className="px-6 py-2 font-normal text-right">Monto</th>
                </tr>
            </thead>
            <tbody>
                {expenses.map(e => (
                    <tr key={e.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-6 py-2 text-slate-800">{e.description}</td>
                        <td className="px-6 py-2 text-slate-500">{e.itemCategory || '-'}</td>
                        <td className="px-6 py-2 text-xs">
                             <span className={`px-2 py-0.5 rounded-full ${e.category === 'Ordinary' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                                {e.category === 'Ordinary' ? 'Ord.' : 'Ext.'}
                             </span>
                        </td>
                        <td className="px-6 py-2 text-right font-medium text-slate-700">${e.amount.toFixed(2)}</td>
                    </tr>
                ))}
            </tbody>
          </table>
      </div>

      {/* Calculation Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider">
              <th className="px-6 py-3 font-medium">UF</th>
              <th className="px-6 py-3 font-medium">Propietario</th>
              <th className="px-6 py-3 font-medium text-right">Prorrateo (%)</th>
              <th className="px-6 py-3 font-medium text-right bg-slate-100">Cuota Gastos</th>
              <th className="px-6 py-3 font-medium text-right">Cuota Fijos</th>
              <th className="px-6 py-3 font-medium text-right">Aporte Fondo</th>
              <th className="px-6 py-3 font-bold text-right text-slate-900 bg-indigo-50">Total a Pagar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {settlementData.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium">{row.unitNumber}</td>
                <td className="px-6 py-4">{row.ownerName}</td>
                <td className={`px-6 py-4 text-right ${isPercentageValid ? '' : 'text-red-600 font-bold'}`}>{row.proratePercentage.toFixed(2)}%</td>
                <td className="px-6 py-4 text-right bg-slate-50">${row.proratedShare.toFixed(2)}</td>
                <td className="px-6 py-4 text-right">${row.equalShare.toFixed(2)}</td>
                <td className="px-6 py-4 text-right text-emerald-600">+${row.reserveContributionShare.toFixed(2)}</td>
                <td className="px-6 py-4 text-right font-bold text-indigo-700 bg-indigo-50">
                    ${row.totalToPay.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 font-bold text-slate-700">
              <tr>
                  <td colSpan={3} className="px-6 py-4 text-right">Totales</td>
                  <td className="px-6 py-4 text-right">${settlementData.reduce((a,b) => a + b.proratedShare, 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">${settlementData.reduce((a,b) => a + b.equalShare, 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">${settlementData.reduce((a,b) => a + b.reserveContributionShare, 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right text-indigo-800">${totalToCollect.toFixed(2)}</td>
              </tr>
          </tfoot>
        </table>
      </div>
      
      {aiReport && (
        <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 animate-fade-in mt-6">
            <h3 className="text-indigo-900 font-semibold mb-2 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Resumen Generado por Gemini
            </h3>
            <div className="text-indigo-800 text-sm whitespace-pre-line leading-relaxed font-sans">
                {aiReport}
            </div>
            <div className="mt-4 flex justify-end">
                <button 
                    onClick={() => navigator.clipboard.writeText(aiReport)}
                    className="text-indigo-600 text-xs font-medium hover:underline"
                >
                    Copiar al portapapeles
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default SettlementView;