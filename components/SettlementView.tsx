import React, { useMemo, useState } from 'react';
import { Unit, Expense, AppSettings, ExpenseDistributionType, SettlementRecord } from '../types';
import { Archive, Loader2, AlertTriangle, FileText, AlertCircle } from 'lucide-react';
// Importamos el servicio de guardado
import { saveSettlement } from '../services/firestoreService';

interface SettlementViewProps {
  units: Unit[];
  expenses: Expense[];
  settings: AppSettings;
  updateReserveBalance: (newBalance: number) => void;
  consortiumId: string; // ✅
  onSettlementSuccess: () => void; // ✅
}

const SettlementView: React.FC<SettlementViewProps> = ({ units, expenses, settings, updateReserveBalance, consortiumId, onSettlementSuccess }) => {
  const [generatingReport, setGeneratingReport] = useState(false);
  const [aiReport, setAiReport] = useState('');

  // Validaciones
  const totalPercentage = units.reduce((acc, u) => acc + u.proratePercentage, 0);
  const isPercentageValid = Math.abs(totalPercentage - 100) < 0.1;

  // Cálculos (Simplificado para el ejemplo, usa tu lógica completa si la tienes)
  const totalOrdinary = expenses.filter(e => e.category === 'Ordinary').reduce((sum, e) => sum + e.amount, 0);
  const totalExtraordinary = expenses.filter(e => e.category === 'Extraordinary').reduce((sum, e) => sum + e.amount, 0);
  
  // Prorrateo básico
  const settlementData = useMemo(() => {
     return units.map(unit => {
         const ordShare = totalOrdinary * (unit.proratePercentage / 100);
         const extraShare = totalExtraordinary * (unit.proratePercentage / 100);
         return { ...unit, totalToPay: ordShare + extraShare, ordShare };
     });
  }, [units, totalOrdinary, totalExtraordinary]);
  
  const totalToCollect = settlementData.reduce((acc, u) => acc + u.totalToPay, 0);

  const handleConfirmSettlement = async () => {
      if(!isPercentageValid) return alert("Los porcentajes deben sumar 100%");
      if(expenses.length === 0) return alert("No hay gastos para liquidar");
      
      if(confirm("¿Cerrar liquidación? Esto archivará los gastos actuales y generará el histórico.")) {
          setGeneratingReport(true);
          try {
              const record: SettlementRecord = {
                  id: '', // Se genera en BD
                  month: new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' }),
                  dateClosed: new Date().toISOString(),
                  totalExpenses: totalOrdinary + totalExtraordinary,
                  totalCollected: totalToCollect,
                  reserveBalanceAtClose: settings.reserveFundBalance,
                  snapshotExpenses: expenses,
                  unitDetails: settlementData.map(d => ({ unitId: d.id, totalToPay: d.totalToPay })),
                  aiReportSummary: aiReport
              };

              // ✅ Guardamos en Firestore
              await saveSettlement(consortiumId, record, expenses.map(e => e.id));
              
              alert("Liquidación cerrada correctamente.");
              onSettlementSuccess(); // Avisamos a App para recargar
          } catch (e) {
              console.error(e);
              alert("Error al cerrar liquidación");
          } finally {
              setGeneratingReport(false);
          }
      }
  }

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
           <h2 className="text-2xl font-bold text-slate-800">Liquidación</h2>
           <button 
                onClick={handleConfirmSettlement} 
                disabled={generatingReport || !isPercentageValid || expenses.length === 0}
                className={`flex items-center px-4 py-2 rounded-lg text-white font-bold ${isPercentageValid ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-400 cursor-not-allowed'}`}
           >
               {generatingReport ? <Loader2 className="animate-spin mr-2"/> : <Archive className="mr-2"/>}
               Cerrar Mes y Archivar
           </button>
       </div>

       {!isPercentageValid && (
           <div className="bg-red-50 text-red-700 p-4 rounded border border-red-200 flex items-center">
               <AlertTriangle className="mr-2"/> Error: Los porcentajes suman {totalPercentage.toFixed(2)}% (Debe ser 100%)
           </div>
       )}

       {/* Resumen */}
       <div className="grid grid-cols-3 gap-4">
           <div className="bg-white p-4 rounded shadow border">
               <div className="text-slate-500 text-xs uppercase">Gastos Totales</div>
               <div className="text-2xl font-bold">${(totalOrdinary + totalExtraordinary).toFixed(2)}</div>
           </div>
           <div className="bg-white p-4 rounded shadow border">
               <div className="text-slate-500 text-xs uppercase">A Recaudar</div>
               <div className="text-2xl font-bold text-indigo-600">${totalToCollect.toFixed(2)}</div>
           </div>
       </div>

       {/* Tabla Detalle */}
       <div className="bg-white rounded-xl shadow border overflow-hidden">
           <table className="w-full text-left text-sm">
               <thead className="bg-slate-50">
                   <tr><th>Unidad</th><th>Propietario</th><th className="text-right">Total a Pagar</th></tr>
               </thead>
               <tbody>
                   {settlementData.map(u => (
                       <tr key={u.id} className="border-b">
                           <td className="px-6 py-3 font-bold">{u.unitNumber}</td>
                           <td className="px-6 py-3">{u.ownerName}</td>
                           <td className="px-6 py-3 text-right font-bold text-indigo-700">${u.totalToPay.toFixed(2)}</td>
                       </tr>
                   ))}
               </tbody>
           </table>
       </div>
    </div>
  );
};
export default SettlementView;