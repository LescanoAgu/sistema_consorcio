import React, { useState, useMemo } from 'react';
import { Payment, Unit, SettlementRecord, DebtAdjustment } from '../types';
import { CheckCircle, XCircle, Search, Plus, FileText, Download, DollarSign, Clock, CheckSquare } from 'lucide-react';
import * as XLSX from 'xlsx';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
};

interface CollectionsViewProps {
  payments: Payment[];
  units: Unit[];
  history: SettlementRecord[]; 
  debtAdjustments: DebtAdjustment[]; 
  onAddPayment: (payment: Omit<Payment, 'id'>) => Promise<void>;
  onUpdateStatus: (id: string, status: 'APPROVED' | 'REJECTED') => Promise<void>;
}

const CollectionsView: React.FC<CollectionsViewProps> = ({ payments, units, history, debtAdjustments, onAddPayment, onUpdateStatus }) => {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'COLLECTED'>('PENDING');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [newUnitId, setNewUnitId] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newMethod, setNewMethod] = useState<'Transferencia' | 'Efectivo' | 'Cheque'>('Transferencia');
  
  const [suggestedDebt, setSuggestedDebt] = useState<{historical: number, current: number, total: number} | null>(null);

  const getUnitDebt = (unitId: string) => {
      const unit = units.find(u => u.id === unitId);
      if (!unit) return { historical: 0, current: 0, total: 0 };

      const historical = (unit.debts || []).reduce((acc, d) => acc + d.total, 0);
      let current = 0;
      
      if (history.length > 0) {
          const lastSettlement = history[0]; 
          const unitDetail = lastSettlement.unitDetails?.find(d => d.unitId === unitId);
          if (unitDetail) {
              const isAlreadyInDebts = (unit.debts || []).some(d => d.period === lastSettlement.month);
              if (!isAlreadyInDebts) {
                  const settlementDate = new Date(lastSettlement.dateClosed).getTime();
                  const paidSinceThen = payments
                      .filter(p => p.unitId === unitId && p.status === 'APPROVED' && new Date(p.date).getTime() >= settlementDate)
                      .reduce((sum, p) => sum + p.amount, 0);
                  
                  const amountOwed = unitDetail.totalToPay - paidSinceThen;
                  if (amountOwed > 1) { 
                      current = amountOwed;
                  }
              }
          }
      }

      const initial = unit.initialBalance || 0;
      
      return {
          historical: historical + initial,
          current,
          total: historical + initial + current
      };
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const unitId = e.target.value;
      setNewUnitId(unitId);
      if (unitId) {
          const debtObj = getUnitDebt(unitId);
          setSuggestedDebt(debtObj);
          if (debtObj.total > 0) setNewAmount(debtObj.total.toString());
      } else {
          setSuggestedDebt(null);
          setNewAmount('');
      }
  };

  const filteredPayments = useMemo(() => {
      return payments.filter(p => {
          const unit = units.find(u => u.id === p.unitId);
          const matchStatus = filterStatus === 'ALL' || p.status === filterStatus;
          const matchSearch = searchTerm === '' || 
              unit?.unitNumber.includes(searchTerm) || 
              unit?.ownerName.toLowerCase().includes(searchTerm.toLowerCase());
          return matchStatus && matchSearch;
      });
  }, [payments, units, filterStatus, searchTerm]);

  const handleManualAdd = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newUnitId || !newAmount) return;
      await onAddPayment({
          unitId: newUnitId,
          amount: parseFloat(newAmount),
          date: newDate,
          method: newMethod,
          notes: 'Carga Manual Administración',
          status: 'APPROVED'
      });
      setShowAddModal(false);
      setNewAmount('');
      setNewUnitId('');
      setSuggestedDebt(null);
      alert("Cobro registrado.");
  };

  const handleQuickPay = (unit: Unit) => {
      const debtObj = getUnitDebt(unit.id);
      setNewUnitId(unit.id);
      setNewAmount(debtObj.total > 0 ? debtObj.total.toString() : '');
      setSuggestedDebt(debtObj);
      setShowAddModal(true);
  };

  const handleExport = () => {
      const data = filteredPayments.map(p => {
          const unit = units.find(u => u.id === p.unitId);
          return {
              Fecha: new Date(p.date).toLocaleDateString(),
              UF: unit?.unitNumber,
              Propietario: unit?.ownerName,
              Monto: p.amount,
              Método: p.method,
              Estado: p.status
          };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Cobranzas");
      XLSX.writeFile(wb, "Reporte_Cobranzas.xlsx");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex bg-slate-200 p-1 rounded-xl w-full md:w-auto shadow-inner">
              <button onClick={() => setActiveTab('PENDING')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'PENDING' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:text-slate-800'}`}>
                  <Clock className="w-4 h-4" /> Pendientes de Cobro
              </button>
              <button onClick={() => setActiveTab('COLLECTED')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'COLLECTED' ? 'bg-white shadow text-emerald-700' : 'text-slate-600 hover:text-slate-800'}`}>
                  <CheckSquare className="w-4 h-4" /> Cobrados
              </button>
          </div>
          
          {activeTab === 'COLLECTED' && (
              <button onClick={() => { setNewUnitId(''); setShowAddModal(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition-colors shadow shadow-indigo-200 font-bold">
                  <Plus className="w-4 h-4 mr-2" /> Cargar Cobro Manual
              </button>
          )}
      </div>

      {activeTab === 'PENDING' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {units.map(u => {
                  const debtObj = getUnitDebt(u.id);
                  if (debtObj.total <= 1) return null; 
                  return (
                      <div key={u.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-all flex justify-between items-center group">
                          <div>
                              <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded">UF {u.unitNumber}</span>
                              <h4 className="font-bold text-slate-800 mt-2">{u.ownerName}</h4>
                              <div className="mt-2 space-y-1">
                                  {debtObj.historical > 0 && <p className="text-xs text-slate-500 font-medium">Histórico: {formatCurrency(debtObj.historical)}</p>}
                                  {debtObj.current > 0 && <p className="text-xs text-slate-500 font-medium">Mes Actual: {formatCurrency(debtObj.current)}</p>}
                                  <p className="text-red-600 font-black text-lg pt-1 border-t border-slate-50">Total: {formatCurrency(debtObj.total)}</p>
                              </div>
                          </div>
                          <button onClick={() => handleQuickPay(u)} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white px-4 py-3 rounded-xl font-bold flex flex-col items-center justify-center transition-colors">
                              <DollarSign className="w-6 h-6"/> <span className="text-xs uppercase tracking-wider mt-1">Cobrar</span>
                          </button>
                      </div>
                  )
              })}
              {units.every(u => getUnitDebt(u.id).total <= 1) && (
                  <div className="col-span-full text-center text-slate-500 py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                      <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                      <p className="font-bold text-lg">¡Excelente, al día!</p>
                      <p>No hay unidades con saldos pendientes.</p>
                  </div>
              )}
          </div>
      )}

      {activeTab === 'COLLECTED' && (
          <div className="animate-fade-in space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                    {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(s => (
                        <button key={s} onClick={() => setFilterStatus(s)} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${filterStatus === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            {s === 'ALL' ? 'Todos' : s === 'PENDING' ? 'Pendientes de Confirmar' : s === 'APPROVED' ? 'Aprobados' : 'Rechazados'}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="Buscar..." className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                    </div>
                    <button onClick={handleExport} className="flex items-center justify-center px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold hover:bg-emerald-100 transition-colors">
                        <Download className="w-4 h-4"/>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                        <tr><th className="px-6 py-4">Fecha</th><th className="px-6 py-4">Unidad</th><th className="px-6 py-4">Monto Cobrado</th><th className="px-6 py-4">Método</th><th className="px-6 py-4">Comp.</th><th className="px-6 py-4 text-center">Estado</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredPayments.map(p => {
                            const unit = units.find(u => u.id === p.unitId);
                            return (
                                <tr key={p.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 text-slate-500">{new Date(p.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-medium text-slate-800">UF {unit?.unitNumber} <span className="text-slate-400">({unit?.ownerName})</span></td>
                                    <td className="px-6 py-4 font-bold text-emerald-600">{formatCurrency(p.amount)}</td>
                                    <td className="px-6 py-4 text-slate-500">{p.method}</td>
                                    <td className="px-6 py-4">{p.attachmentUrl ? <a href={p.attachmentUrl} target="_blank" rel="noreferrer" className="text-indigo-600 underline font-medium flex items-center gap-1"><FileText className="w-4 h-4"/> Ver</a> : '-'}</td>
                                    <td className="px-6 py-4 text-center">
                                        {p.status === 'PENDING' ? (
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => onUpdateStatus(p.id, 'APPROVED')} className="px-3 py-1 bg-emerald-100 text-emerald-700 font-bold rounded-lg hover:bg-emerald-200 transition-colors">Aprobar</button>
                                                <button onClick={() => onUpdateStatus(p.id, 'REJECTED')} className="px-3 py-1 bg-red-100 text-red-700 font-bold rounded-lg hover:bg-red-200 transition-colors">Rechazar</button>
                                            </div>
                                        ) : <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${p.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>{p.status}</span>}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                {filteredPayments.length === 0 && <div className="text-center py-10 text-slate-500">No se encontraron registros.</div>}
            </div>
          </div>
      )}

      {showAddModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
                  <div className="bg-indigo-600 p-4 text-white">
                      <h3 className="font-bold text-lg flex items-center gap-2"><DollarSign className="w-5 h-5"/> Registrar Cobro</h3>
                  </div>
                  <form onSubmit={handleManualAdd} className="p-6 space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Seleccionar Unidad</label>
                          <select className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-indigo-500" value={newUnitId} onChange={handleUnitChange} required>
                              <option value="">Seleccionar...</option>
                              {units.map(u => <option key={u.id} value={u.id}>UF {u.unitNumber} - {u.ownerName}</option>)}
                          </select>
                          {suggestedDebt !== null && (
                              <div className="mt-2 text-xs font-medium bg-slate-50 p-2 rounded border border-slate-100 text-slate-600 flex justify-between">
                                  <span>Deuda Sugerida:</span> 
                                  <span className={`font-bold ${suggestedDebt.total > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{formatCurrency(suggestedDebt.total)}</span>
                              </div>
                          )}
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Monto a Cobrar ($)</label>
                          <input type="number" step="0.01" className="w-full p-3 border border-slate-200 rounded-lg font-bold text-lg text-indigo-700 outline-none focus:border-indigo-500" value={newAmount} onChange={e => setNewAmount(e.target.value)} required autoFocus placeholder="0.00" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Cobro</label>
                              <input type="date" className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500" value={newDate} onChange={e => setNewDate(e.target.value)} required />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Método de Pago</label>
                              <select className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500" value={newMethod} onChange={e => setNewMethod(e.target.value as any)}>
                                  <option value="Transferencia">Transferencia</option>
                                  <option value="Efectivo">Efectivo</option>
                                  <option value="Cheque">Cheque</option>
                              </select>
                          </div>
                      </div>
                      <div className="flex gap-3 pt-4 border-t border-slate-100">
                          <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-slate-600 hover:bg-slate-100 rounded-lg font-bold transition-colors">Cancelar</button>
                          <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow transition-colors">Confirmar</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default CollectionsView;