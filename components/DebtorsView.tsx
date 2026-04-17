import React, { useState } from 'react';
import { Unit, DebtItem, SettlementRecord, Payment, Consortium } from '../types';
import { Search, Plus, Trash2, Save, Users, ChevronRight, AlertTriangle, CheckSquare, Download, AlertCircle, Clock } from 'lucide-react';
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

  // --- NUEVO: MOTOR DE CÁLCULO SEPARADO (DEUDA VS PENDIENTE) ---
  const getUnitDebt = (unit: Unit | null) => {
      if (!unit) return { historical: 0, current: 0, total: 0, pendingPeriod: '' };

      // 1. Histórico (Deuda Base + Meses en Morosidad)
      const historical = (unit.debts || []).reduce((acc, d) => acc + d.total, 0) + (unit.initialBalance || 0);
      
      // 2. Pendiente (Liquidación actual aún no pagada y no pasada a morosidad)
      let current = 0;
      let pendingPeriod = '';
      
      if (history.length > 0) {
          const lastSettlement = history[0]; 
          const unitDetail = lastSettlement.unitDetails?.find(d => d.unitId === unit.id);
          
          if (unitDetail) {
              const isAlreadyInDebts = (unit.debts || []).some(d => d.period === lastSettlement.month);
              if (!isAlreadyInDebts) {
                  const settlementDate = new Date(lastSettlement.dateClosed).getTime();
                  const paidSinceThen = payments
                      .filter(p => p.unitId === unit.id && p.status === 'APPROVED' && new Date(p.date).getTime() >= settlementDate)
                      .reduce((sum, p) => sum + p.amount, 0);
                  
                  const amountOwed = unitDetail.totalToPay - paidSinceThen;
                  if (amountOwed > 1) { 
                      current = amountOwed;
                      pendingPeriod = lastSettlement.month;
                  }
              }
          }
      }

      return { historical, current, total: historical + current, pendingPeriod };
  };

  const addSuggestedDebt = () => {
      if (!selectedUnit) return;
      const debtObj = getUnitDebt(selectedUnit);
      if (debtObj.current <= 0) return;

      const exists = editingDebts.some(d => d.period === debtObj.pendingPeriod);
      if (exists) {
          alert("El período ya está en la lista de deudas.");
          return;
      }
      const newDebt: DebtItem = {
          id: Math.random().toString(36).substr(2, 9),
          period: debtObj.pendingPeriod,
          baseAmount: Number(debtObj.current.toFixed(2)),
          interestRate: 0,
          interestAmount: 0,
          total: Number(debtObj.current.toFixed(2))
      };
      setEditingDebts([...editingDebts, newDebt]);
  };

  const addDebtRow = () => {
    const newDebt: DebtItem = {
      id: Math.random().toString(36).substr(2, 9),
      period: '', baseAmount: 0, interestRate: 0, interestAmount: 0, total: 0
    };
    setEditingDebts([...editingDebts, newDebt]);
  };

  const removeDebtRow = (id: string) => {
    setEditingDebts(editingDebts.filter(d => d.id !== id));
    setSelectedDebtIds(selectedDebtIds.filter(selectedId => selectedId !== id));
  };

  const clearAllDebts = () => {
      if (confirm('⚠️ ¿Estás seguro de eliminar TODAS las deudas de esta unidad?\n\n(Debes hacer click en "Guardar Sistema" luego para confirmar)')) {
          setEditingDebts([]);
          setSelectedDebtIds([]);
      }
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

  const currentUnitDebt = getUnitDebt(selectedUnit);
  // Recalculamos la deuda histórica en tiempo real según lo que el usuario está editando en pantalla
  const realTimeHistoricalDebt = editingDebts.reduce((sum, d) => sum + d.total, 0) + (selectedUnit?.initialBalance || 0);

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
                Gestión de Deudas y Pendientes
            </h2>
            <p className="text-slate-500">Visualiza saldos pendientes del mes y administra la morosidad histórica.</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LISTADO DE UNIDADES CON DOBLE ETIQUETA */}
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
              const uDebtObj = getUnitDebt(unit);
              return (
                <button
                  key={unit.id}
                  onClick={() => handleSelectUnit(unit)}
                  className={`w-full p-4 flex items-center justify-between border-b border-slate-50 transition-colors ${
                    selectedUnit?.id === unit.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-slate-50 border-l-4 border-transparent'
                  }`}
                >
                  <div className="text-left flex-1">
                    <p className="font-bold text-slate-800">{unit.unitNumber}</p>
                    <p className="text-xs text-slate-500 truncate w-32">{unit.ownerName}</p>
                  </div>
                  
                  <div className="text-right flex flex-col items-end gap-1 pr-2">
                      {uDebtObj.historical > 0 && (
                          <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-200 shadow-sm flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3"/> {formatCurrency(uDebtObj.historical)}
                          </span>
                      )}
                      {uDebtObj.current > 0 && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200 shadow-sm flex items-center gap-1">
                              <Clock className="w-3 h-3"/> {formatCurrency(uDebtObj.current)}
                          </span>
                      )}
                      {uDebtObj.total <= 0 && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                              Al día
                          </span>
                      )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedUnit ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-[700px]">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Detalle: {selectedUnit.unitNumber}</h2>
                  <p className="text-sm text-slate-500">{selectedUnit.ownerName}</p>
                </div>
                
                <div className="flex gap-4 text-right">
                    {currentUnitDebt.current > 0 && (
                        <div className="bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                            <p className="text-[10px] text-amber-600 uppercase font-bold tracking-wider">Mes Pendiente</p>
                            <p className="text-xl font-black text-amber-600">{formatCurrency(currentUnitDebt.current)}</p>
                        </div>
                    )}
                    <div className="bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                        <p className="text-[10px] text-red-600 uppercase font-bold tracking-wider">Deuda Histórica</p>
                        <p className="text-xl font-black text-red-600">{formatCurrency(realTimeHistoricalDebt)}</p>
                    </div>
                </div>
              </div>

              {currentUnitDebt.current > 0 && (
                  <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 text-amber-800">
                          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                          <div>
                              <p className="font-bold text-sm">Saldo impago del mes actual detectado</p>
                              <p className="text-xs text-amber-700">Período {currentUnitDebt.pendingPeriod}: {formatCurrency(currentUnitDebt.current)}</p>
                          </div>
                      </div>
                      <button 
                          onClick={addSuggestedDebt}
                          className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-lg transition-colors border border-amber-300 shadow-sm"
                      >
                          + Pasar a Morosidad
                      </button>
                  </div>
              )}

              {editingDebts.length > 0 && (
                  <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                          <CheckSquare className="w-5 h-5 text-indigo-600"/>
                          <span className="text-sm font-bold text-indigo-800">
                              {selectedDebtIds.length} seleccionados
                          </span>
                      </div>
                      <div className="h-6 w-px bg-indigo-200 mx-2 hidden sm:block"></div>
                      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                          <span className="text-sm text-indigo-700">Aplicar interés:</span>
                          <input 
                              type="number" 
                              step="0.1"
                              placeholder="Ej: 7.3"
                              className="w-20 p-1.5 border border-indigo-200 rounded text-sm outline-none focus:border-indigo-500"
                              value={bulkInterestRate}
                              onChange={(e) => setBulkInterestRate(e.target.value === '' ? '' : Number(e.target.value))}
                          />
                          <span className="text-sm font-bold text-indigo-700">%</span>
                          <button 
                              onClick={applyBulkInterest}
                              disabled={selectedDebtIds.length === 0 || bulkInterestRate === ''}
                              className="ml-auto px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                          >
                              Aplicar Lote
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

                {selectedUnit.initialBalance > 0 && (
                  <div className="grid grid-cols-12 gap-2 items-center p-3 rounded-lg bg-orange-50 border border-orange-200 text-orange-800">
                    <div className="col-span-1"></div>
                    <div className="col-span-3 font-bold text-sm">Saldo Inicial</div>
                    <div className="col-span-2 font-medium">{formatCurrency(selectedUnit.initialBalance)}</div>
                    <div className="col-span-2">-</div>
                    <div className="col-span-2">-</div>
                    <div className="col-span-2 text-right font-bold">{formatCurrency(selectedUnit.initialBalance)}</div>
                  </div>
                )}

                {editingDebts.length === 0 && selectedUnit.initialBalance === 0 && (
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
                        title="Eliminar fila"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex gap-2 mt-4">
                    <button
                        onClick={addDebtRow}
                        className="flex-1 py-3 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 text-sm font-bold hover:bg-slate-50 hover:text-indigo-600 flex items-center justify-center gap-2 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Agregar Deuda Manual
                    </button>
                    
                    {editingDebts.length > 0 && (
                        <button
                            onClick={clearAllDebts}
                            className="px-4 py-3 border-2 border-red-200 bg-red-50 rounded-lg text-red-600 text-sm font-bold hover:bg-red-100 flex items-center justify-center gap-2 transition-colors shadow-sm"
                            title="Borrar todas las deudas de la lista"
                        >
                            <Trash2 className="w-4 h-4" /> Vaciar Lista
                        </button>
                    )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                    onClick={exportPDF}
                    className="flex items-center gap-2 px-6 py-3 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                >
                    <Download className="w-4 h-4"/> PDF Deuda
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
              <p className="text-sm">Para administrar y visualizar sus saldos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DebtorsView;