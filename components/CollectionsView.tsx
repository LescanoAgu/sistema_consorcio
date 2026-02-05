import React, { useState, useMemo } from 'react';
import { Payment, Unit, SettlementRecord, DebtAdjustment } from '../types';
import { CheckCircle, XCircle, Search, Filter, Plus, FileText, Download, DollarSign } from 'lucide-react';
import * as XLSX from 'xlsx';

interface CollectionsViewProps {
  payments: Payment[];
  units: Unit[];
  history: SettlementRecord[]; // Necesario para calcular deuda
  debtAdjustments: DebtAdjustment[]; // Necesario para calcular deuda
  onAddPayment: (payment: Omit<Payment, 'id'>) => Promise<void>;
  onUpdateStatus: (id: string, status: 'APPROVED' | 'REJECTED') => Promise<void>;
}

const CollectionsView: React.FC<CollectionsViewProps> = ({ payments, units, history, debtAdjustments, onAddPayment, onUpdateStatus }) => {
  const [activeTab, setActiveTab] = useState<'LIST' | 'QUICK'>('LIST');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [newUnitId, setNewUnitId] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newMethod, setNewMethod] = useState<'Transferencia' | 'Efectivo' | 'Cheque'>('Transferencia');
  
  // Estado para mostrar la deuda sugerida
  const [suggestedDebt, setSuggestedDebt] = useState<number | null>(null);

  // FUNCIÓN MAESTRA DE CÁLCULO DE DEUDA
  const getUnitDebt = (unitId: string) => {
      const unit = units.find(u => u.id === unitId);
      if (!unit) return 0;

      const initial = unit.initialBalance || 0;
      
      const totalSettled = history.reduce((acc, record) => {
          const detail = record.unitDetails?.find(d => d.unitId === unitId);
          return acc + (detail ? detail.totalToPay : 0);
      }, 0);

      const totalAdjustments = debtAdjustments
          .filter(a => a.unitId === unitId)
          .reduce((acc, a) => acc + a.amount, 0);

      const totalPaid = payments
          .filter(p => p.unitId === unitId && p.status === 'APPROVED')
          .reduce((acc, p) => acc + p.amount, 0);

      return (initial + totalSettled + totalAdjustments) - totalPaid;
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const unitId = e.target.value;
      setNewUnitId(unitId);
      if (unitId) {
          const debt = getUnitDebt(unitId);
          setSuggestedDebt(debt);
          if (debt > 0) setNewAmount(debt.toFixed(2));
      } else {
          setSuggestedDebt(null);
          setNewAmount('');
      }
  };

  // Resto de lógica (Filtros, Excel, etc.)
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
      const debt = getUnitDebt(unit.id);
      setNewUnitId(unit.id);
      setNewAmount(debt > 0 ? debt.toFixed(2) : '');
      setSuggestedDebt(debt);
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Control de Cobros</h2>
            <p className="text-slate-500 text-sm">Gestión de pagos</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setActiveTab('LIST')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'LIST' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Listado</button>
              <button onClick={() => setActiveTab('QUICK')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'QUICK' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>⚡ Carga Rápida</button>
          </div>
      </div>

      {activeTab === 'LIST' && (
          <>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                    {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(s => (
                        <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterStatus === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            {s === 'ALL' ? 'Todos' : s === 'PENDING' ? 'Pendientes' : s === 'APPROVED' ? 'Aprobados' : 'Rechazados'}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold hover:bg-emerald-100 transition-colors">
                        <Download className="w-4 h-4"/> Excel
                    </button>
                    <button onClick={() => { setNewUnitId(''); setShowAddModal(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                        <Plus className="w-4 h-4 mr-2" /> Registrar Cobro
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                        <tr><th className="px-6 py-3">Fecha</th><th className="px-6 py-3">Unidad</th><th className="px-6 py-3">Monto</th><th className="px-6 py-3">Método</th><th className="px-6 py-3">Comp.</th><th className="px-6 py-3 text-center">Estado</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredPayments.map(p => {
                            const unit = units.find(u => u.id === p.unitId);
                            return (
                                <tr key={p.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-3 text-slate-500">{new Date(p.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-3 font-medium text-slate-800">UF {unit?.unitNumber} <span className="text-slate-400">({unit?.ownerName})</span></td>
                                    <td className="px-6 py-3 font-bold text-slate-700">${p.amount.toFixed(2)}</td>
                                    <td className="px-6 py-3 text-slate-500">{p.method}</td>
                                    <td className="px-6 py-3">{p.attachmentUrl ? <a href={p.attachmentUrl} target="_blank" rel="noreferrer" className="text-indigo-600 underline"><FileText className="w-4 h-4"/></a> : '-'}</td>
                                    <td className="px-6 py-3 text-center">
                                        {p.status === 'PENDING' ? (
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => onUpdateStatus(p.id, 'APPROVED')} className="p-1 bg-emerald-100 text-emerald-600 rounded"><CheckCircle className="w-5 h-5"/></button>
                                                <button onClick={() => onUpdateStatus(p.id, 'REJECTED')} className="p-1 bg-red-100 text-red-600 rounded"><XCircle className="w-5 h-5"/></button>
                                            </div>
                                        ) : <span className={`px-2 py-1 rounded text-xs font-bold ${p.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{p.status}</span>}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
          </>
      )}

      {/* VISTA CARGA RÁPIDA */}
      {activeTab === 'QUICK' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
              {units.map(u => {
                  const debt = getUnitDebt(u.id);
                  if (debt <= 1) return null; // Ocultar si no debe (margen de error $1)
                  return (
                      <div key={u.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors flex justify-between items-center">
                          <div>
                              <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded">UF {u.unitNumber}</span>
                              <h4 className="font-bold text-slate-800 mt-1">{u.ownerName}</h4>
                              <p className="text-red-500 font-bold text-sm mt-1">Debe: ${debt.toFixed(2)}</p>
                          </div>
                          <button onClick={() => handleQuickPay(u)} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-2 rounded-lg font-bold text-sm flex items-center transition-colors">
                              <DollarSign className="w-4 h-4 mr-1"/> Cobrar
                          </button>
                      </div>
                  )
              })}
              {units.every(u => getUnitDebt(u.id) <= 1) && <p className="col-span-full text-center text-slate-400 py-10">¡Todo al día! No hay deudores.</p>}
          </div>
      )}

      {/* MODAL COBRO */}
      {showAddModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-xl animate-in zoom-in duration-200">
                  <h3 className="font-bold text-lg mb-4">Registrar Cobro</h3>
                  <form onSubmit={handleManualAdd} className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Unidad</label>
                          <select className="w-full p-2 border rounded bg-slate-50" value={newUnitId} onChange={handleUnitChange} required>
                              <option value="">Seleccionar...</option>
                              {units.map(u => <option key={u.id} value={u.id}>UF {u.unitNumber} - {u.ownerName}</option>)}
                          </select>
                          {suggestedDebt !== null && (
                              <p className={`text-xs mt-1 font-bold ${suggestedDebt > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                  {suggestedDebt > 0 ? `Deuda actual: $${suggestedDebt.toFixed(2)}` : 'Sin deuda pendiente'}
                              </p>
                          )}
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Monto ($)</label>
                          <input type="number" step="0.01" className="w-full p-2 border rounded font-bold text-lg" value={newAmount} onChange={e => setNewAmount(e.target.value)} required autoFocus placeholder="0.00" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                          <input type="date" className="w-full p-2 border rounded" value={newDate} onChange={e => setNewDate(e.target.value)} required />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Método</label>
                          <select className="w-full p-2 border rounded" value={newMethod} onChange={e => setNewMethod(e.target.value as any)}>
                              <option value="Transferencia">Transferencia</option>
                              <option value="Efectivo">Efectivo</option>
                              <option value="Cheque">Cheque</option>
                          </select>
                      </div>
                      <div className="flex gap-2 pt-4">
                          <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 text-slate-500 hover:bg-slate-100 rounded font-medium">Cancelar</button>
                          <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700 shadow">Confirmar Cobro</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default CollectionsView;