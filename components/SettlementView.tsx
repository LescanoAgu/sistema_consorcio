
import React, { useMemo, useState } from 'react';
import { Unit, Expense, AppSettings, ExpenseDistributionType, SettlementRecord } from '../types';
import { generateMonthlyReport } from '../services/geminiService';
import { FileText, Loader2, Archive, AlertCircle, AlertTriangle } from 'lucide-react';

interface SettlementViewProps {
  units: Unit[];
  expenses: Expense[];
  settings: AppSettings;
  updateReserveBalance: (newBalance: number) => void;
  onCloseMonth: (record: SettlementRecord) => void;
}

const SettlementView: React.FC<SettlementViewProps> = ({ units, expenses, settings, updateReserveBalance, onCloseMonth }) => {
  const [generatingReport, setGeneratingReport] = useState(false);
  const [aiReport, setAiReport] = useState<string>('');

  // Validate Percentages
  const totalPercentage = units.reduce((acc, u) => acc + u.proratePercentage, 0);
  const isPercentageValid = Math.abs(totalPercentage - 100) < 0.1;

  // 1. Calculate totals by type
  const { totalOrdinary, totalExtraordinary, totalFromReserve, expensesProrated, expensesEqual } = useMemo(() => {
    let ord = 0;
    let extra = 0;
    let reserve = 0;
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

  // 2. Calculate Reserve Fund Contribution (Money GOING TO reserve)
  const monthlyReserveContributionAmount = (totalOrdinary * settings.monthlyReserveContributionPercentage) / 100;
  
  // 3. New Reserve Balance Calculation (Current + Contribution - Spent)
  const projectedReserveBalance = settings.reserveFundBalance + monthlyReserveContributionAmount - totalFromReserve;

  // 4. Per Unit Calculation
  const settlementData = useMemo(() => {
    return units.map(unit => {
      // A. Expenses distributed by Prorate %
      const proratedShare = expensesProrated.reduce((acc, exp) => acc + exp.amount, 0) * (unit.proratePercentage / 100);
      
      // B. Expenses distributed by Equal Parts
      const equalShare = expensesEqual.reduce((acc, exp) => acc + exp.amount, 0) / units.length;
      
      // C. Contribution TO Reserve (Usually prorated)
      const reserveContributionShare = monthlyReserveContributionAmount * (unit.proratePercentage / 100);

      const totalToPay = proratedShare + equalShare + reserveContributionShare;

      return {
        ...unit,
        proratedShare,
        equalShare,
        reserveContributionShare,
        totalToPay
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
      if(!isPercentageValid) {
          alert(`Error: La suma de los porcentajes de las unidades es ${totalPercentage.toFixed(2)}%. Debe ser exactamente 100% para poder liquidar.`);
          return;
      }

      if(expenses.length === 0) {
          alert("No hay gastos para liquidar.");
          return;
      }

      if(confirm("¿Cerrar liquidación? Esta acción:\n1. Actualizará el fondo de reserva con los movimientos.\n2. Archivará los gastos actuales.\n3. Limpiará la pantalla para el nuevo mes.")) {
          
          // Create snapshot of what each unit pays
          const unitDetails = settlementData.map(d => ({
              unitId: d.id,
              totalToPay: d.totalToPay
          }));

          const record: SettlementRecord = {
              id: crypto.randomUUID(),
              month: new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' }),
              dateClosed: new Date().toISOString(),
              totalExpenses: totalOrdinary + totalExtraordinary + totalFromReserve,
              totalCollected: totalToCollect,
              reserveBalanceAtClose: projectedReserveBalance,
              snapshotExpenses: [...expenses],
              aiReportSummary: aiReport,
              unitDetails: unitDetails 
          };
          
          // Pass logic to App.tsx to handle Reserve Fund History updates
          onCloseMonth(record);
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Liquidación de Expensas</h2>
           <p className="text-slate-500 text-sm">Resumen y cálculo final por unidad</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handleGenerateReport}
                disabled={generatingReport}
                className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-4 py-2 rounded-lg flex items-center shadow-sm transition-colors disabled:opacity-50"
            >
                {generatingReport ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <FileText className="w-4 h-4 mr-2"/>}
                {generatingReport ? 'Generando...' : 'Generar Aviso IA'}
            </button>
             <button 
                onClick={handleConfirmSettlement}
                disabled={!isPercentageValid}
                className={`px-4 py-2 rounded-lg flex items-center shadow-sm transition-colors text-white ${!isPercentageValid ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                title={!isPercentageValid ? "Corrija los porcentajes en Unidades" : "Cerrar Liquidación"}
            >
                <Archive className="w-4 h-4 mr-2"/>
                Cerrar y Archivar Mes
            </button>
        </div>
      </div>

      {!isPercentageValid && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 animate-pulse">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <div>
                  <h4 className="font-bold text-red-800">Imposible Liquidar</h4>
                  <p className="text-sm text-red-700">La suma de porcentajes es <strong>{totalPercentage.toFixed(2)}%</strong>. Por favor, vaya a la sección "Unidades" y ajuste los valores hasta sumar 100%.</p>
              </div>
          </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase">Gastos Ordinarios</p>
            <p className="text-2xl font-bold text-slate-800">${totalOrdinary.toFixed(2)}</p>
        </div>
         <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase">Gastos Extraord.</p>
            <p className="text-2xl font-bold text-slate-800">${totalExtraordinary.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-16 h-16 bg-amber-100 rounded-bl-full opacity-50"></div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Pagado x Fondo</p>
            <p className="text-2xl font-bold text-amber-600">-${totalFromReserve.toFixed(2)}</p>
        </div>
         <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 bg-indigo-50 border-indigo-100">
            <p className="text-xs font-semibold text-indigo-600 uppercase">A Recaudar (Total)</p>
            <p className="text-2xl font-bold text-indigo-700">${totalToCollect.toFixed(2)}</p>
        </div>
      </div>
      
      {/* Reserve Fund Detail */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center text-sm gap-2">
         <div className="flex items-center gap-2">
             <AlertCircle className="w-4 h-4 text-slate-400"/>
             <span className="text-slate-600">Fondo Reserva Inicial: <strong>${settings.reserveFundBalance.toFixed(2)}</strong></span>
         </div>
         <div className="text-slate-600">
             + Aporte del mes ({settings.monthlyReserveContributionPercentage}%): <strong>${monthlyReserveContributionAmount.toFixed(2)}</strong>
         </div>
         <div className="text-slate-600">
             - Gastos cubiertos: <strong>${totalFromReserve.toFixed(2)}</strong>
         </div>
         <div className="bg-emerald-100 px-3 py-1 rounded-full text-emerald-800 font-semibold">
             Final Proyectado: ${projectedReserveBalance.toFixed(2)}
         </div>
      </div>

      {aiReport && (
        <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 animate-fade-in">
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
      
      {/* Expenses Review Table (Collapsible maybe? For now just simple list) */}
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
    </div>
  );
};

export default SettlementView;
