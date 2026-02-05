import React, { useMemo, useState } from 'react';
import { Unit, Payment, SettlementRecord, DebtAdjustment } from '../types';
import { AlertTriangle, TrendingUp, Plus, Filter, X, Calculator, History, ChevronUp, FileText, Wallet, Mail, Calendar, Percent, Trash2 } from 'lucide-react';

interface DebtorsViewProps {
  units: Unit[];
  payments: Payment[];
  history: SettlementRecord[];
  debtAdjustments: DebtAdjustment[];
  onAddAdjustment: (adj: Omit<DebtAdjustment, 'id'>) => Promise<void>; // <--- Nuevo Prop
  onDeleteAdjustment: (id: string) => Promise<void>; // <--- Nuevo Prop
}

const DebtorsView: React.FC<DebtorsViewProps> = ({ units, payments, history, debtAdjustments, onAddAdjustment, onDeleteAdjustment }) => {
  const [minDebtThreshold, setMinDebtThreshold] = useState<number>(100); 
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  
  // Modal State
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null);
  const [customRate, setCustomRate] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const debtorsData = useMemo(() => {
    return units.map(unit => {
        // 1. Initial Debt
        const initial = unit.initialBalance || 0;

        // 2. Total Owed from Settlements (History)
        const totalSettled = history.reduce((acc, record) => {
            const detail = record.unitDetails?.find(d => d.unitId === unit.id);
            return acc + (detail ? detail.totalToPay : 0);
        }, 0);

        // 3. Total Paid (Only Approved)
        const totalPaid = payments.filter(p => p.unitId === unit.id && p.status === 'APPROVED').reduce((acc, p) => acc + p.amount, 0);
        
        // 4. Adjustments (Interest/Fines)
        const totalAdjustments = debtAdjustments.filter(a => a.unitId === unit.id).reduce((acc, a) => acc + a.amount, 0);

        // Balance Final
        const balance = (initial + totalSettled + totalAdjustments) - totalPaid;

        return { 
            ...unit, 
            balance, 
            lastPayment: payments.filter(p => p.unitId === unit.id && p.status === 'APPROVED').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] 
        };
    })
    .filter(u => u.balance > minDebtThreshold)
    .sort((a, b) => b.balance - a.balance);
  }, [units, history, payments, minDebtThreshold, debtAdjustments]);

  const selectedDebtor = units.find(u => u.id === selectedDebtorId);

  const calculatePreview = () => {
      if(!selectedDebtor) return 0;
      const debtorData = debtorsData.find(d => d.id === selectedDebtorId);
      const currentDebt = debtorData?.balance || 0;
      return currentDebt * (customRate / 100);
  };

  const handleConfirmInterest = async () => {
      if (!selectedDebtorId || customRate <= 0) return;
      setIsSubmitting(true);
      try {
          const amount = calculatePreview();
          await onAddAdjustment({
              unitId: selectedDebtorId,
              amount: amount,
              date: new Date().toISOString(),
              description: `Interés por Mora (${customRate}%)`
          });
          setSelectedDebtorId(null);
          setCustomRate(0);
      } catch (error) {
          console.error(error);
          alert("Error al guardar el ajuste.");
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                    Gestión de Morosidad
                </h2>
                <p className="text-slate-500">Unidades con deuda superior a ${minDebtThreshold}</p>
            </div>
            
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-500 font-bold">Mínimo:</span>
                <input 
                    type="number" 
                    value={minDebtThreshold} 
                    onChange={e => setMinDebtThreshold(Number(e.target.value))}
                    className="w-20 p-1 text-sm border rounded outline-none focus:border-indigo-500"
                />
            </div>
        </div>

        {/* LISTADO DE MOROSOS */}
        <div className="grid grid-cols-1 gap-4">
            {debtorsData.map(debtor => (
                <div key={debtor.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-center gap-6 hover:border-red-200 transition-colors">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600 font-bold text-lg border border-red-100">
                            {debtor.unitNumber}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">{debtor.ownerName}</h3>
                            <p className="text-sm text-slate-500 flex items-center gap-1">
                                <History className="w-3 h-3"/> Último pago: {debtor.lastPayment ? new Date(debtor.lastPayment.date).toLocaleDateString() : 'Nunca'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-8 w-full md:w-auto justify-between">
                        <div className="text-right">
                            <p className="text-xs text-slate-400 uppercase font-bold">Deuda Total</p>
                            <p className="text-2xl font-bold text-red-600">${debtor.balance.toFixed(2)}</p>
                        </div>
                        
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setSelectedDebtorId(debtor.id)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 transition-colors"
                            >
                                <Percent className="w-4 h-4" />
                                Aplicar Interés
                            </button>
                            <button 
                                onClick={() => setExpandedHistoryId(expandedHistoryId === debtor.id ? null : debtor.id)}
                                className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"
                            >
                                <ChevronUp className={`w-5 h-5 transition-transform ${expandedHistoryId === debtor.id ? '' : 'rotate-180'}`} />
                            </button>
                        </div>
                    </div>

                    {/* DETALLE DE AJUSTES (Si está expandido) */}
                    {expandedHistoryId === debtor.id && (
                        <div className="w-full border-t border-slate-100 pt-4 mt-2 bg-slate-50 p-4 rounded-lg">
                            <h4 className="font-bold text-sm text-slate-700 mb-2">Historial de Cargos Adicionales</h4>
                            {debtAdjustments.filter(a => a.unitId === debtor.id).length > 0 ? (
                                <ul className="space-y-2">
                                    {debtAdjustments.filter(a => a.unitId === debtor.id).map(adj => (
                                        <li key={adj.id} className="flex justify-between text-sm items-center bg-white p-2 rounded border border-slate-200">
                                            <span>{new Date(adj.date).toLocaleDateString()} - {adj.description}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-red-600">+${adj.amount.toFixed(2)}</span>
                                                <button onClick={() => onDeleteAdjustment(adj.id)} className="text-slate-400 hover:text-red-500">
                                                    <Trash2 className="w-4 h-4"/>
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-xs text-slate-400 italic">Sin cargos adicionales registrados.</p>
                            )}
                        </div>
                    )}
                </div>
            ))}

            {debtorsData.length === 0 && (
                <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
                    <TrendingUp className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-50" />
                    <h3 className="text-lg font-medium text-slate-700">¡Excelente!</h3>
                    <p className="text-slate-500">No hay unidades que superen el umbral de deuda.</p>
                </div>
            )}
        </div>

        {/* MODAL INTERESES */}
        {selectedDebtorId && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
                    <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2"><Calculator className="w-5 h-5"/> Calcular Intereses</h3>
                        <button onClick={() => setSelectedDebtorId(null)}><X className="w-5 h-5"/></button>
                    </div>
                    
                    <div className="p-6 space-y-6">
                        <div className="text-center">
                            <p className="text-sm text-slate-500 mb-1">Unidad {selectedDebtor?.unitNumber}</p>
                            <p className="text-xl font-bold text-slate-800">{selectedDebtor?.ownerName}</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Tasa de Interés (%)</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    className="flex-1 p-3 border border-slate-300 rounded-lg text-lg font-bold text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="0"
                                    value={customRate}
                                    onChange={e => setCustomRate(parseFloat(e.target.value))}
                                />
                                <span className="text-xl font-bold text-slate-400">%</span>
                            </div>
                        </div>

                        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex justify-between items-center">
                            <div>
                                <p className="text-sm text-indigo-700 font-medium">Recargo a aplicar</p>
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
                            disabled={customRate <= 0 || isSubmitting}
                            className={`px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm flex items-center transition-colors ${customRate <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            {isSubmitting ? 'Guardando...' : 'Aplicar Cargo'}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default DebtorsView;