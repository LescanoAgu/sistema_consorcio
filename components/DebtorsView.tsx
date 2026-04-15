import React, { useState, useMemo } from 'react';
import { Unit, DebtItem, SettlementRecord, Payment, Consortium } from '../types';
import { Search, Plus, Trash2, Save, Users, ChevronRight, AlertTriangle, CheckSquare, Download, AlertCircle } from 'lucide-react';
import { generateDebtDetailPDF } from '../services/pdfService';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
};

interface DebtorsViewProps {
  units: Unit[];
  history: SettlementRecord[];
  payments: Payment[];
  consortium: Consortium;
  onUpdateUnit: (unitId: string, updates: Partial<Unit>) => Promise<void>;
}

const DebtorsView: React.FC<DebtorsViewProps> = ({ units, history, payments, consortium, onUpdateUnit }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [editingDebts, setEditingDebts] = useState<DebtItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  const [selectedDebtIds, setSelectedDebtIds] = useState<string[]>([]);
  const [bulkInterestRate, setBulkInterestRate] = useState<number | ''>('');

  const handleSelectUnit = (unit: Unit) => {
    setSelectedUnit(unit);
    setEditingDebts(unit.debts || []);
    setSelectedDebtIds([]); 
    setBulkInterestRate('');
  };

  const suggestedDebt = useMemo(() => {
    if (!selectedUnit || history.length === 0) return null;
    
    const lastSettlement = history[0]; 
    const unitDetail = lastSettlement.unitDetails?.find(d => d.unitId === selectedUnit.id);
    if (!unitDetail || unitDetail.totalToPay <= 0) return null;

    const settlementDate = new Date(lastSettlement.dateClosed).getTime();
    const paidSinceThen = payments
        .filter(p => p.unitId === selectedUnit.id && p.status === 'APPROVED' && new Date(p.date).getTime() >= settlementDate)
        .reduce((sum, p) => sum + p.amount, 0);

    const amountOwed = unitDetail.totalToPay - paidSinceThen;

    if (amountOwed > 1) {
        return {
            period: lastSettlement.month,
            amount: amountOwed
        };
    }
    return null;
  }, [selectedUnit, history, payments]);

  const addSuggestedDebt = () => {
      if (!suggestedDebt) return;
      const exists = editingDebts.some(d => d.period === suggestedDebt.period);
      if (exists) {
          alert("El período ya está en la lista de deudas.");
          return;
      }
      const newDebt: DebtItem = {
          id: Math.random().toString(36).substr(2, 9),
          period: suggestedDebt.period,
          baseAmount: Number(suggestedDebt.amount.toFixed(2)),
          interestRate: 0,
          interestAmount: 0,
          total: Number(suggestedDebt.amount.toFixed(2))
      };
      setEditingDebts([...editingDebts, newDebt]);
  };

  const addDebtRow = () => {
    const newDebt: DebtItem = {
      id: Math.random().toString(36).substr(2, 9),
      period: '',
      baseAmount: 0,
      interestRate: 0,
      interestAmount: 0,
      total: 0
    };
    setEditingDebts([...editingDebts, newDebt]);
  };

  const removeDebtRow = (id: string) => {
    setEditingDebts(editingDebts.filter(d => d.id !== id));
    setSelectedDebtIds(selectedDebtIds.filter(selectedId => selectedId !== id));
  };

  const updateDebtField = (id: string, field: keyof DebtItem, value: string) => {
    const updated = editingDebts.map(debt => {
      if (debt.id === id) {
        const newDebt = { ...debt };
        if (field === 'period') {
          newDebt.period = value;
        } else {
          const numValue = parseFloat(value) || 0;
          (newDebt as any)[field] = numValue;
          if (field === 'baseAmount' || field === 'interestRate') {
            newDebt.interestAmount = newDebt.baseAmount * (newDebt.interestRate / 100);
            newDebt.total = newDebt.baseAmount + newDebt.interestAmount;
          }
        }
        return newDebt;
      }
      return debt;
    });
    setEditingDebts(updated);
  };

  const toggleSelection = (id: string) => {
    if (selectedDebtIds.includes(id)) {
        setSelectedDebtIds(selectedDebtIds.filter(itemId => itemId !== id));
    } else {
        setSelectedDebtIds([...selectedDebtIds, id]);
    }
  };

  const toggleSelectAll = () => {
      if (selectedDebtIds.length === editingDebts.length) {
          setSelectedDebtIds([]);
      } else {
          setSelectedDebtIds(editingDebts.map(d => d.id));
      }
  };

  const applyBulkInterest = () => {
      if (bulkInterestRate === '' || selectedDebtIds.length === 0) return;
      const rate = Number(bulkInterestRate);
      const updated = editingDebts.map(debt => {
          if (selectedDebtIds.includes(debt.id)) {
              const newInterestAmount = debt.baseAmount * (rate / 100);
              return { ...debt, interestRate: rate, interestAmount: newInterestAmount, total: debt.baseAmount + newInterestAmount };
          }
          return debt;
      });
      setEditingDebts(updated);
      setSelectedDebtIds([]); 
      setBulkInterestRate('');
  };

  const saveDebts = async () => {
    if (!selectedUnit) return;
    setIsSaving(true);
    try {
      const cleanDebts = editingDebts.map(d => ({
          id: d.id, period: d.period || '', baseAmount: Number(d.baseAmount) || 0,
          interestRate: Number(d.interestRate) || 0, interestAmount: Number(d.interestAmount) || 0, total: Number(d.total) || 0
      }));
      await onUpdateUnit(selectedUnit.id, { debts: cleanDebts });
      alert("Historial de deuda actualizado y guardado correctamente.");
      setSelectedUnit({ ...selectedUnit, debts: cleanDebts });
    } catch (error) {
      alert("Error al guardar el historial de deuda.");
    } finally {
      setIsSaving(false);
    }
  };

  const exportPDF = () => {
      if (!selectedUnit) return;
      const tempUnit = { ...selectedUnit, debts: editingDebts };
      generateDebtDetailPDF(tempUnit, consortium);
  };

  // Sumamos la deuda desglosada MÁS el saldo inicial de la unidad (Deuda base/existente)
  const debtsTotal = editingDebts.reduce((sum, d) => sum + d.total, 0);
  const initialBalance = selectedUnit?.initialBalance || 0;
  const totalDebt = debtsTotal + initialBalance;

  const filteredUnits = units.filter(u => 
    u.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.ownerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-red-600" />
                Gestión de Morosidad Histórica
            </h2>
            <p className="text-slate-500">Carga deudas anteriores, suma recargos por mora y exporta a PDF.</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[700px]">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar unidad..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filteredUnits.map(unit => {
              const uDebt = (unit.debts || []).reduce((sum, d) => sum + d.total, 0) + (unit.initialBalance || 0);
              return (
                <button
                  key={unit.id}
                  onClick={() => handleSelectUnit(unit)}
                  className={`w-full p-4 flex items-center justify-between border-b border-slate-50 transition-colors ${
                    selectedUnit?.id === unit.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-slate-50 border-l-4 border-transparent'
                  }`}
                >
                  <div className="text-left">
                    <p className="font-bold text-slate-800">UF {unit.unitNumber}</p>
                    <p className="text-xs text-slate-500 truncate w-40">{unit.ownerName}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${uDebt > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {formatCurrency(uDebt)}
                    </p>
                    <ChevronRight className="w-4 h-4 text-slate-300 ml-auto mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedUnit ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-[700px]">
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Detalle de Deuda: UF {selectedUnit.unitNumber}</h2>
                  <p className="text-sm text-slate-500">{selectedUnit.ownerName}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 uppercase font-bold">Total Histórico Adeudado</p>
                  <p className="text-3xl font-black text-red-600">
                    {formatCurrency(totalDebt)}
                  </p>
                </div>
              </div>

              {suggestedDebt && (
                  <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3 text-amber-800">
                          <AlertCircle className="w-5 h-5 text-amber-600" />
                          <div>
                              <p className="font-bold text-sm">Se detectó saldo impago del último mes</p>
                              <p className="text-xs text-amber-700">Período {suggestedDebt.period}: {formatCurrency(suggestedDebt.amount)}</p>
                          </div>
                      </div>
                      <button 
                          onClick={addSuggestedDebt}
                          className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-sm rounded-lg transition-colors border border-amber-300"
                      >
                          + Cargar a la Deuda
                      </button>
                  </div>
              )}

              {editingDebts.length > 0 && (
                  <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center gap-4">
                      <div className="flex items-center gap-2">
                          <CheckSquare className="w-5 h-5 text-indigo-600"/>
                          <span className="text-sm font-bold text-indigo-800">
                              {selectedDebtIds.length} seleccionados
                          </span>
                      </div>
                      <div className="h-6 w-px bg-indigo-200 mx-2"></div>
                      <div className="flex items-center gap-2 flex-1">
                          <span className="text-sm text-indigo-700">Aplicar interés:</span>
                          <input 
                              type="number" 
                              step="0.1"
                              placeholder="Ej: 7.3"
                              className="w-24 p-1.5 border border-indigo-200 rounded text-sm outline-none focus:border-indigo-500"
                              value={bulkInterestRate}
                              onChange={(e) => setBulkInterestRate(e.target.value === '' ? '' : Number(e.target.value))}
                          />
                          <span className="text-sm font-bold text-indigo-700">%</span>
                          <button 
                              onClick={applyBulkInterest}
                              disabled={selectedDebtIds.length === 0 || bulkInterestRate === ''}
                              className="ml-auto px-4 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                          >
                              Aplicar a Seleccionados
                          </button>
                      </div>
                  </div>
              )}

              <div className="flex-1 overflow-y-auto pr-2 space-y-3 mb-6">
                <div className="grid grid-cols-12 gap-2 px-2 text-[10px] font-bold text-slate-400 uppercase items-center">
                  <div className="col-span-1 flex justify-center">
                      <input 
                          type="checkbox" 
                          checked={editingDebts.length > 0 && selectedDebtIds.length === editingDebts.length}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      />
                  </div>
                  <div className="col-span-3">Período / Mes</div>
                  <div className="col-span-2">Monto Base</div>
                  <div className="col-span-2">% Int</div>
                  <div className="col-span-2">Interés $</div>
                  <div className="col-span-2 text-right">Subtotal</div>
                </div>

                {/* Mostrar el Saldo Inicial / Deuda Existente */}
                {initialBalance > 0 && (
                  <div className="grid grid-cols-12 gap-2 items-center p-3 rounded-lg bg-orange-50 border border-orange-200 text-orange-800">
                    <div className="col-span-1"></div>
                    <div className="col-span-3 font-bold text-sm">Saldo Inicial / Deuda Previa</div>
                    <div className="col-span-2 font-medium">{formatCurrency(initialBalance)}</div>
                    <div className="col-span-2">-</div>
                    <div className="col-span-2">-</div>
                    <div className="col-span-2 text-right font-bold">{formatCurrency(initialBalance)}</div>
                  </div>
                )}

                {editingDebts.length === 0 && initialBalance === 0 && (
                  <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                    <p className="text-slate-400 font-medium">Esta unidad no registra deuda histórica.</p>
                  </div>
                )}

                {editingDebts.map((debt) => (
                  <div key={debt.id} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg group border transition-colors ${selectedDebtIds.includes(debt.id) ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="col-span-1 flex justify-center">
                        <input 
                            type="checkbox" 
                            checked={selectedDebtIds.includes(debt.id)}
                            onChange={() => toggleSelection(debt.id)}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                        />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        placeholder="Ej: Marzo 2026"
                        className="w-full bg-white border border-slate-200 rounded text-sm p-2 outline-none focus:border-indigo-500"
                        value={debt.period}
                        onChange={(e) => updateDebtField(debt.id, 'period', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="relative">
                        <span className="absolute left-2 top-2 text-slate-400 text-sm">$</span>
                        <input
                          type="number"
                          className="w-full pl-6 bg-white border border-slate-200 rounded text-sm p-2 outline-none focus:border-indigo-500"
                          value={debt.baseAmount === 0 ? '' : debt.baseAmount}
                          onChange={(e) => updateDebtField(debt.id, 'baseAmount', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          className="w-full pr-6 bg-white border border-slate-200 rounded text-sm p-2 outline-none focus:border-indigo-500"
                          value={debt.interestRate === 0 ? '' : debt.interestRate}
                          onChange={(e) => updateDebtField(debt.id, 'interestRate', e.target.value)}
                        />
                        <span className="absolute right-2 top-2 text-slate-400 text-sm">%</span>
                      </div>
                    </div>
                    <div className="col-span-2 text-sm font-medium text-slate-500 pl-2">
                      {formatCurrency(debt.interestAmount)}
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <span className="text-sm font-bold text-slate-800">
                        {formatCurrency(debt.total)}
                      </span>
                      <button 
                        onClick={() => removeDebtRow(debt.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addDebtRow}
                  className="w-full py-3 mt-4 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 text-sm font-bold hover:bg-slate-50 hover:text-indigo-600 flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Agregar Nuevo Mes Manualmente
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                    onClick={exportPDF}
                    className="flex items-center gap-2 px-6 py-3 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                >
                    <Download className="w-5 h-5"/> Descargar PDF
                </button>
                <button
                  onClick={saveDebts}
                  disabled={isSaving}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50 transition-all"
                >
                  <Save className="w-5 h-5" /> {isSaving ? 'Guardando...' : 'Guardar Sistema'}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-[700px] flex flex-col items-center justify-center bg-white rounded-xl shadow-sm border border-slate-200 text-slate-400">
              <Users className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg">Selecciona una unidad en el panel izquierdo</p>
              <p className="text-sm">Para administrar y exportar sus deudas mes a mes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DebtorsView;