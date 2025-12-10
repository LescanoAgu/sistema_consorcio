
import React, { useMemo, useState } from 'react';
import { Unit, Payment, SettlementRecord, DebtAdjustment } from '../types';
import { AlertTriangle, TrendingUp, Plus, Filter, X, Calculator, History, ChevronUp, FileText, Wallet, Mail, Calendar, Percent } from 'lucide-react';

interface DebtorsViewProps {
  units: Unit[];
  payments: Payment[];
  history: SettlementRecord[];
  debtAdjustments: DebtAdjustment[];
  setDebtAdjustments: React.Dispatch<React.SetStateAction<DebtAdjustment[]>>;
}

const DebtorsView: React.FC<DebtorsViewProps> = ({ units, payments, history, debtAdjustments, setDebtAdjustments }) => {
  const [minDebtThreshold, setMinDebtThreshold] = useState<number>(100); 
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  
  // Modal State
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null);
  const [targetPeriod, setTargetPeriod] = useState<string>('TOTAL'); // 'TOTAL' or SettlementID
  const [customRate, setCustomRate] = useState<number>(0);
  
  const debtorsData = useMemo(() => {
    return units.map(unit => {
        // 1. Initial Debt
        const initial = unit.initialBalance || 0;

        // 2. Total Owed from Settlements (History)
        const totalSettled = history.reduce((acc, record) => {
            const detail = record.unitDetails?.find(d => d.unitId === unit.id);
            return acc + (detail ? detail.totalToPay : 0);
        }, 0);

        // 3. Debt Adjustments (Interest/Penalties)
        const totalAdjustments = debtAdjustments.filter(d => d.unitId === unit.id).reduce((acc, d) => acc + d.amount, 0);

        // 4. Total Paid
        const totalPaid = payments.filter(p => p.unitId === unit.id).reduce((acc, p) => acc + p.amount, 0);

        // 5. Current Balance
        const balance = (initial + totalSettled + totalAdjustments) - totalPaid;

        return {
            ...unit,
            totalSettled,
            totalPaid,
            totalAdjustments,
            balance
        };
    })
    .sort((a, b) => b.balance - a.balance); // Sort by highest debt
  }, [units, payments, history, debtAdjustments]);

  // Apply Filter
  const filteredDebtors = useMemo(() => {
      return debtorsData.filter(d => d.balance >= minDebtThreshold);
  }, [debtorsData, minDebtThreshold]);

  const totalDebt = debtorsData.filter(d => d.balance > 0).reduce((acc, d) => acc + d.balance, 0);

  const selectedDebtorData = useMemo(() => {
      if(!selectedDebtorId) return null;
      return debtorsData.find(d => d.id === selectedDebtorId);
  }, [selectedDebtorId, debtorsData]);

  // Helper to get combined history for a specific unit
  const getUnitMovements = (unitId: string) => {
      const movements = [];

      // A. Settlements (Charges)
      history.forEach(rec => {
          const detail = rec.unitDetails?.find(u => u.unitId === unitId);
          if (detail) {
              movements.push({
                  id: `settlement-${rec.id}`,
                  date: rec.dateClosed,
                  type: 'CHARGE',
                  category: 'Liquidación',
                  description: `Expensas ${rec.month}`,
                  amount: detail.totalToPay
              });
          }
      });

      // B. Adjustments (Charges)
      debtAdjustments.filter(a => a.unitId === unitId).forEach(adj => {
          movements.push({
              id: `adj-${adj.id}`,
              date: adj.date,
              type: 'CHARGE', // Still a charge, but distinct category
              category: 'Ajuste',
              description: adj.description,
              amount: adj.amount
          });
      });

      // C. Payments (Credits)
      payments.filter(p => p.unitId === unitId).forEach(pay => {
           movements.push({
              id: `pay-${pay.id}`,
              date: pay.date,
              type: 'PAYMENT',
              category: 'Pago',
              description: `Pago (${pay.method})`,
              amount: pay.amount
          });
      });

      // Sort descending by date
      return movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const handleConfirmInterest = () => {
      if (!selectedDebtorData) return;

      let baseAmount = 0;
      let description = '';

      // Determine Base Amount
      if (targetPeriod === 'TOTAL') {
          baseAmount = selectedDebtorData.balance;
          description = `Interés sobre Saldo Total (${customRate}%)`;
      } else {
          // Find specific settlement
          const record = history.find(h => h.id === targetPeriod);
          const detail = record?.unitDetails.find(u => u.unitId === selectedDebtorData.id);
          if (detail && record) {
              baseAmount = detail.totalToPay;
              description = `Interés ${record.month} (${customRate}%)`;
          }
      }

      const amount = baseAmount * (customRate / 100);

      if (amount <= 0) return;

      const adjustment: DebtAdjustment = {
          id: crypto.randomUUID(),
          unitId: selectedDebtorData.id,
          date: new Date().toISOString().split('T')[0],
          amount: amount,
          description: description
      };
      
      setDebtAdjustments(prev => [...prev, adjustment]);
      setSelectedDebtorId(null); // Close modal
      setCustomRate(0);
      setTargetPeriod('TOTAL');
  };

  const handleNotifyDebt = (unit: typeof debtorsData[0]) => {
    if (!unit.linkedEmail) return;

    const subject = `Aviso de Deuda - Unidad ${unit.unitNumber}`;
    const body = `Estimado ${unit.ownerName},\n\n` +
                 `Le informamos que al día de la fecha, su unidad funcional (${unit.unitNumber}) registra una deuda total de $${unit.balance.toFixed(2)}.\n\n` +
                 `Resumen de cuenta:\n` +
                 `--------------------------------\n` +
                 `Saldo Inicial: $${unit.initialBalance?.toFixed(2) || '0.00'}\n` +
                 `Expensas/Liquidaciones: $${unit.totalSettled.toFixed(2)}\n` +
                 `Intereses/Ajustes: $${unit.totalAdjustments.toFixed(2)}\n` +
                 `Pagos Realizados: -$${unit.totalPaid.toFixed(2)}\n` +
                 `--------------------------------\n` +
                 `TOTAL ADEUDADO: $${unit.balance.toFixed(2)}\n\n` +
                 `Por favor, regularice su situación a la brevedad.\n\n` +
                 `Atentamente,\nLa Administración.`;
    
    window.location.href = `mailto:${unit.linkedEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Helper to calculate preview in modal
  const calculatePreview = () => {
      if (!selectedDebtorData) return 0;
      let base = 0;
      if (targetPeriod === 'TOTAL') {
          base = selectedDebtorData.balance;
      } else {
          const record = history.find(h => h.id === targetPeriod);
          const detail = record?.unitDetails.find(u => u.unitId === selectedDebtorData.id);
          base = detail ? detail.totalToPay : 0;
      }
      return base * (customRate / 100);
  };

  return (
    <div className="space-y-6 relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Estado de Deudores</h2>
                <p className="text-slate-500 text-sm">Monitor de morosidad y cálculo de intereses</p>
            </div>
            <div className="bg-red-50 border border-red-100 px-4 py-2 rounded-lg flex items-center">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                <span className="text-red-800 font-bold text-lg">${totalDebt.toFixed(2)}</span>
                <span className="text-red-600 text-xs ml-2 uppercase font-semibold">Deuda Total Acumulada</span>
            </div>
        </div>
        
        {/* Controls Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center gap-6 shadow-sm">
            
            {/* Filter Control */}
            <div className="flex items-center gap-3 w-full md:w-auto">
                <Filter className="w-5 h-5 text-slate-400" />
                <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Ocultar Deudas Menores a</span>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">$</span>
                        <input 
                            type="number" 
                            value={minDebtThreshold} 
                            onChange={(e) => setMinDebtThreshold(Number(e.target.value))}
                            className="w-24 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm"
                        />
                    </div>
                </div>
            </div>
            
            <div className="text-xs text-slate-400 italic ml-auto hidden md:block">
                * Seleccione una unidad para aplicar punitorios
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDebtors.map(unit => {
                const isDebtor = unit.balance > 1; // Tolerance of $1
                const isExpanded = expandedHistoryId === unit.id;
                const movements = isExpanded ? getUnitMovements(unit.id) : [];

                return (
                    <div key={unit.id} className={`rounded-xl border shadow-sm relative overflow-hidden transition-all duration-200 ${isDebtor ? 'bg-white border-red-100' : 'bg-white border-slate-200'}`}>
                        {isDebtor && <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full -mr-8 -mt-8 pointer-events-none"></div>}
                        
                        <div className="p-4">
                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">{unit.unitNumber}</h3>
                                    <p className="text-sm text-slate-500 truncate max-w-[150px]">{unit.ownerName}</p>
                                </div>
                                <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${isDebtor ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                    {isDebtor ? 'Moroso' : 'Al día'}
                                </div>
                            </div>

                            <div className="space-y-2 text-sm relative z-10">
                                <div className="flex justify-between text-slate-500">
                                    <span>Saldo Inicial:</span>
                                    <span>${unit.initialBalance?.toFixed(2) || '0.00'}</span>
                                </div>
                                <div className="flex justify-between text-slate-500">
                                    <span>Expensas Históricas:</span>
                                    <span>+${unit.totalSettled.toFixed(2)}</span>
                                </div>
                                {unit.totalAdjustments > 0 && (
                                    <div className="flex justify-between text-orange-600 font-medium">
                                        <span>Intereses/Notas Débito:</span>
                                        <span>+${unit.totalAdjustments.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-emerald-600">
                                    <span>Pagos Realizados:</span>
                                    <span>-${unit.totalPaid.toFixed(2)}</span>
                                </div>
                                <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-lg">
                                    <span className="text-slate-700">Saldo Actual:</span>
                                    <span className={unit.balance > 0 ? 'text-red-600' : 'text-green-600'}>
                                        ${unit.balance.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Collapsible History Section */}
                        {isExpanded && (
                            <div className="bg-slate-50 border-t border-slate-200 animate-fade-in max-h-60 overflow-y-auto">
                                <div className="p-2 bg-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 z-20 flex justify-between px-4">
                                    <span>Historial Detallado</span>
                                    <span>Movimientos</span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {movements.map(mov => (
                                        <div key={mov.id} className="p-3 hover:bg-white transition-colors flex items-center gap-3">
                                            {/* Icon Indicator */}
                                            <div className={`p-2 rounded-full shrink-0 
                                                ${mov.category === 'Pago' ? 'bg-emerald-100 text-emerald-600' : 
                                                  mov.category === 'Ajuste' ? 'bg-orange-100 text-orange-600' : 
                                                  'bg-indigo-100 text-indigo-600'}`
                                            }>
                                                {mov.category === 'Pago' && <Wallet className="w-4 h-4" />}
                                                {mov.category === 'Ajuste' && <TrendingUp className="w-4 h-4" />}
                                                {mov.category === 'Liquidación' && <FileText className="w-4 h-4" />}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded border 
                                                        ${mov.category === 'Pago' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                                          mov.category === 'Ajuste' ? 'bg-orange-50 text-orange-700 border-orange-100' : 
                                                          'bg-indigo-50 text-indigo-700 border-indigo-100'}`
                                                    }>
                                                        {mov.category}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">{new Date(mov.date).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-xs text-slate-600 truncate">{mov.description}</p>
                                            </div>

                                            <div className={`text-sm font-bold whitespace-nowrap ${mov.type === 'CHARGE' ? 'text-slate-700' : 'text-emerald-600'}`}>
                                                {mov.type === 'CHARGE' ? '-' : '+'}${mov.amount.toFixed(2)}
                                            </div>
                                        </div>
                                    ))}
                                    {movements.length === 0 && (
                                        <div className="p-4 text-center text-slate-400 text-xs italic">
                                            Sin movimientos registrados
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                         <div className="p-2 border-t border-slate-100 bg-white flex gap-2">
                             <button 
                                onClick={() => setExpandedHistoryId(isExpanded ? null : unit.id)}
                                className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg flex items-center justify-center transition-colors ${isExpanded ? 'bg-slate-100 text-slate-700' : 'hover:bg-slate-50 text-slate-600 border border-slate-100'}`}
                             >
                                 {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <History className="w-3 h-3 mr-1" />}
                                 {isExpanded ? 'Ocultar' : 'Historial'}
                             </button>

                            {isDebtor && (
                                <>
                                    <button 
                                        onClick={() => handleNotifyDebt(unit)}
                                        disabled={!unit.linkedEmail}
                                        className={`flex-1 py-2 px-3 border text-xs font-medium rounded-lg flex items-center justify-center transition-colors shadow-sm ${
                                            !unit.linkedEmail 
                                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                                                : 'bg-white hover:bg-blue-50 border-blue-200 text-blue-600'
                                        }`}
                                        title={unit.linkedEmail ? `Enviar reclamo a ${unit.linkedEmail}` : "Sin email registrado"}
                                    >
                                        <Mail className="w-3 h-3 mr-1" /> Notificar
                                    </button>
                                    <button 
                                        onClick={() => { setSelectedDebtorId(unit.id); setTargetPeriod('TOTAL'); setCustomRate(0); }}
                                        className="flex-1 py-2 px-3 bg-white hover:bg-orange-50 border border-orange-200 text-orange-600 text-xs font-medium rounded-lg flex items-center justify-center transition-colors shadow-sm"
                                    >
                                        <Calculator className="w-3 h-3 mr-1" /> Interés
                                    </button>
                                </>
                            )}
                         </div>
                    </div>
                )
            })}
            
            {filteredDebtors.length === 0 && (
                <div className="col-span-full text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
                    <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>No se encontraron unidades con deuda mayor a ${minDebtThreshold}</p>
                </div>
            )}
        </div>

        {/* Modal de Cálculo de Intereses */}
        {selectedDebtorId && selectedDebtorData && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-fade-in overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800">Aplicar Interés / Punitorio</h3>
                        <button onClick={() => setSelectedDebtorId(null)} className="text-slate-400 hover:text-red-500">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="p-6 space-y-6">
                        
                        {/* Selector de Período Base */}
                        <div>
                             <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center">
                                <Calendar className="w-4 h-4 mr-1 text-slate-500"/>
                                Seleccionar Período Base
                             </label>
                             <select 
                                value={targetPeriod}
                                onChange={(e) => setTargetPeriod(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm"
                             >
                                 <option value="TOTAL">Saldo Total Acumulado (${selectedDebtorData.balance.toFixed(2)})</option>
                                 {history.map(record => {
                                     const detail = record.unitDetails.find(d => d.unitId === selectedDebtorData.id);
                                     if(detail) {
                                         return (
                                             <option key={record.id} value={record.id}>
                                                 Liquidación {record.month} (${detail.totalToPay.toFixed(2)})
                                             </option>
                                         )
                                     }
                                     return null;
                                 })}
                             </select>
                             <p className="text-xs text-slate-500 mt-1">
                                 Elija si el interés aplica al total o a un mes histórico específico.
                             </p>
                        </div>

                        {/* Input de Porcentaje */}
                        <div>
                             <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center">
                                <Percent className="w-4 h-4 mr-1 text-slate-500"/>
                                Tasa de Interés (%)
                             </label>
                             <div className="relative">
                                 <input 
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={customRate}
                                    onChange={(e) => setCustomRate(parseFloat(e.target.value))}
                                    placeholder="Ej: 5.5"
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm pr-10"
                                 />
                                 <span className="absolute right-3 top-2 text-slate-400 font-bold">%</span>
                             </div>
                        </div>

                        {/* Preview */}
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex justify-between items-center">
                            <div>
                                <span className="text-indigo-600 text-xs font-bold uppercase block">Monto a Generar</span>
                                <span className="text-indigo-400 text-xs">Nota de Débito</span>
                            </div>
                            <span className="text-2xl font-bold text-indigo-700">
                                +${calculatePreview().toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                        <button 
                            onClick={() => setSelectedDebtorId(null)}
                            className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-200 rounded-lg transition-colors border border-transparent"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleConfirmInterest}
                            disabled={customRate <= 0}
                            className={`px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm flex items-center transition-colors ${customRate <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Aplicar Cargo
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default DebtorsView;
