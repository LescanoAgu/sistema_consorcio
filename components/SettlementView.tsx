import React, { useMemo, useState, useEffect } from 'react';
import { Unit, Expense, AppSettings, ExpenseDistributionType, SettlementRecord } from '../types';
import { Archive, AlertTriangle, AlertCircle, Edit2, Check } from 'lucide-react';

// Eliminada la importación de geminiService

interface SettlementViewProps {
  units: Unit[];
  expenses: Expense[];
  settings: AppSettings;
  updateReserveBalance?: (newBalance: number) => void; 
  onCloseMonth: (record: SettlementRecord) => void;
}

const SettlementView: React.FC<SettlementViewProps> = ({ units, expenses, settings, updateReserveBalance, onCloseMonth }) => {
  const [isEditingReserve, setIsEditingReserve] = useState(false);
  const [manualReserveBalance, setManualReserveBalance] = useState(settings.reserveFundBalance || 0);

  // Sincronización segura
  useEffect(() => {
    if (!isEditingReserve) {
        setManualReserveBalance(settings.reserveFundBalance || 0);
    }
  }, [settings.reserveFundBalance, isEditingReserve]);

  const totalPercentage = units.reduce((acc, u) => acc + (u.proratePercentage || 0), 0);
  const isPercentageValid = Math.abs(totalPercentage - 100) < 0.1;

  // CÁLCULO DE GASTOS
  const { totalOrdinary, totalExtraordinary, totalFromReserve, expensesProrated, expensesEqual } = useMemo(() => {
    let ord = 0, extra = 0, reserve = 0;
    const prorated: Expense[] = [];
    const equal: Expense[] = [];

    expenses.forEach(e => {
      const amount = e.amount || 0; 
      if (e.distributionType === ExpenseDistributionType.FROM_RESERVE) {
        reserve += amount;
      } else {
        if (e.category === 'Ordinary') ord += amount;
        else extra += amount;

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

  // Saldo Final = Inicial (Manual) - Gastos
  const projectedReserveBalance = manualReserveBalance - totalFromReserve;
  
  const monthlyReserveContributionAmount = (totalOrdinary * (settings.monthlyReserveContributionPercentage || 0)) / 100;

  // Prorrateo
  const settlementData = useMemo(() => {
    return units.map(unit => {
      const percentage = unit.proratePercentage || 0;
      const proratedShare = expensesProrated.reduce((acc, exp) => acc + (exp.amount || 0), 0) * (percentage / 100);
      const equalShare = expensesEqual.reduce((acc, exp) => acc + (exp.amount || 0), 0) / (units.length || 1);
      const reserveContributionShare = monthlyReserveContributionAmount * (percentage / 100);
      
      return {
        ...unit,
        totalToPay: proratedShare + equalShare + reserveContributionShare,
        proratedShare, equalShare, reserveContributionShare
      };
    });
  }, [units, expensesProrated, expensesEqual, monthlyReserveContributionAmount]);

  const totalToCollect = settlementData.reduce((acc, curr) => acc + curr.totalToPay, 0);

  // --- HANDLERS ---
  const handleSaveReserve = () => {
      if (updateReserveBalance) {
          updateReserveBalance(manualReserveBalance);
      }
      setIsEditingReserve(false);
  };

  const handleConfirmSettlement = () => {
      if(!isPercentageValid) return alert(`Los porcentajes suman ${totalPercentage.toFixed(2)}%. Deben sumar 100%.`);
      
      if(confirm("¿Cerrar liquidación y generar PDF?")) {
          const record: SettlementRecord = {
              id: crypto.randomUUID(),
              month: new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' }),
              dateClosed: new Date().toISOString(),
              totalExpenses: totalOrdinary + totalExtraordinary + totalFromReserve,
              totalCollected: totalToCollect,
              
              // Datos del fondo
              reserveBalanceStart: manualReserveBalance,
              reserveExpense: totalFromReserve,
              reserveBalanceAtClose: projectedReserveBalance, 
              reserveContribution: monthlyReserveContributionAmount,
              
              snapshotExpenses: [...expenses],
              aiReportSummary: "Resumen IA desactivado temporalmente.",
              unitDetails: settlementData.map(d => ({ unitId: d.id, totalToPay: d.totalToPay }))
          };
          
          onCloseMonth(record);
      }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Liquidación</h2>
           <p className="text-slate-500 text-sm">Cierre mensual de expensas</p>
        </div>
        <div className="flex gap-2">
             <button onClick={handleConfirmSettlement} disabled={!isPercentageValid} className={`px-4 py-2 rounded-lg flex items-center text-white font-medium shadow-sm ${!isPercentageValid ? 'bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                <Archive className="w-4 h-4 mr-2"/> Liquidar Mes
            </button>
        </div>
      </div>

      {!isPercentageValid && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex gap-3 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              <p>Error crítico: Los porcentajes suman {totalPercentage.toFixed(2)}%. Ajuste en "Unidades".</p>
          </div>
      )}

      {/* TARJETA DEL FONDO DE RESERVA */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
         <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
             <h3 className="font-bold text-slate-700 flex items-center gap-2 text-lg">
                 <AlertCircle className="w-6 h-6 text-emerald-500"/>
                 Caja Fondo de Reserva
             </h3>
             <div className="bg-emerald-100 text-emerald-800 px-4 py-1.5 rounded-full font-bold shadow-sm">
                 Disponible Final: ${projectedReserveBalance.toLocaleString()}
             </div>
         </div>

         <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-sm">
             {/* EDITABLE: Saldo Inicial */}
             <div className="flex flex-col gap-1 w-full md:w-auto">
                 <span className="text-slate-500 font-medium ml-1">Saldo Inicial (Caja)</span>
                 <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                     {isEditingReserve ? (
                         <>
                             <span className="text-slate-400 font-bold ml-2">$</span>
                             <input 
                                type="number" 
                                className="w-28 p-1 bg-white border rounded text-right font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={manualReserveBalance}
                                onChange={(e) => setManualReserveBalance(parseFloat(e.target.value) || 0)}
                             />
                             <button onClick={handleSaveReserve} className="p-1.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors shadow-sm" title="Guardar cambio">
                                 <Check className="w-4 h-4"/>
                             </button>
                         </>
                     ) : (
                         <>
                             <strong className="text-xl text-slate-700 ml-2">${manualReserveBalance.toLocaleString()}</strong>
                             <button onClick={() => setIsEditingReserve(true)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Corregir manualmente">
                                 <Edit2 className="w-4 h-4"/>
                             </button>
                         </>
                     )}
                 </div>
             </div>

             <div className="text-slate-300 font-bold text-2xl hidden md:block">-</div>

             <div className="flex flex-col items-center">
                 <span className="text-slate-500 mb-1 font-medium">Gastos (Pagados c/ Caja)</span>
                 <strong className="text-red-500 text-xl">-${totalFromReserve.toLocaleString()}</strong>
             </div>
             
             <div className="text-slate-300 font-bold text-2xl hidden md:block">=</div>

             <div className="flex flex-col items-center p-4 bg-emerald-50 rounded-xl border border-emerald-100 w-full md:w-auto">
                 <span className="text-emerald-800 text-xs uppercase font-bold mb-1">Saldo Final Real</span>
                 <strong className="text-emerald-700 text-2xl">${projectedReserveBalance.toLocaleString()}</strong>
             </div>
         </div>
      </div>
      
      {/* Resumen de Cálculos Detallado */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
             <h4 className="font-bold text-slate-700 uppercase text-xs tracking-wider">Detalle de Prorrateo</h4>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
            <thead>
                <tr className="bg-white text-slate-500 border-b border-slate-100">
                    <th className="px-6 py-3 font-medium">Unidad</th>
                    <th className="px-6 py-3 font-medium text-right">Cuota Gastos</th>
                    <th className="px-6 py-3 font-medium text-right">Aporte Fondo (Futuro)</th>
                    <th className="px-6 py-3 font-bold text-right bg-indigo-50/50 text-indigo-900">Total a Pagar</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {settlementData.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-700">
                        <span className="font-bold">{row.unitNumber}</span> <span className="text-slate-400 mx-1">|</span> {row.ownerName}
                    </td>
                    <td className="px-6 py-3 text-right text-slate-600">${(row.proratedShare + row.equalShare).toLocaleString()}</td>
                    <td className="px-6 py-3 text-right text-emerald-600">+${row.reserveContributionShare.toLocaleString()}</td>
                    <td className="px-6 py-3 text-right font-bold text-indigo-700 bg-indigo-50/30">${row.totalToPay.toLocaleString()}</td>
                </tr>
                ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-700">
                <tr>
                    <td className="px-6 py-3 text-right">TOTALES</td>
                    <td className="px-6 py-3 text-right">${(settlementData.reduce((a,b) => a + b.proratedShare + b.equalShare, 0)).toLocaleString()}</td>
                    <td className="px-6 py-3 text-right text-emerald-600">${(settlementData.reduce((a,b) => a + b.reserveContributionShare, 0)).toLocaleString()}</td>
                    <td className="px-6 py-3 text-right text-indigo-700 bg-indigo-50/30">${totalToCollect.toLocaleString()}</td>
                </tr>
            </tfoot>
            </table>
        </div>
      </div>
    </div>
  );
};

export default SettlementView;