import React, { useState, useMemo } from 'react';
import { Payment, Unit } from '../types';
import { CheckCircle, XCircle, Search, Filter, Plus, Clock, FileText, Download } from 'lucide-react';
import * as XLSX from 'xlsx'; // <--- Importamos

interface CollectionsViewProps {
  payments: Payment[];
  units: Unit[];
  onAddPayment: (payment: Omit<Payment, 'id'>) => Promise<void>;
  onUpdateStatus: (id: string, status: 'APPROVED' | 'REJECTED') => Promise<void>;
}

const CollectionsView: React.FC<CollectionsViewProps> = ({ payments, units, onAddPayment, onUpdateStatus }) => {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Estados para nuevo pago manual
  const [newUnitId, setNewUnitId] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newMethod, setNewMethod] = useState<'Transferencia' | 'Efectivo' | 'Cheque'>('Transferencia');

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
          status: 'APPROVED' // Si lo carga el admin, nace aprobado
      });
      setShowAddModal(false);
      setNewAmount('');
  };

  // --- FUNCIÓN EXPORTAR ---
  const handleExport = () => {
      const data = filteredPayments.map(p => {
          const unit = units.find(u => u.id === p.unitId);
          return {
              Fecha: new Date(p.date).toLocaleDateString(),
              UF: unit?.unitNumber || '?',
              Propietario: unit?.ownerName || '?',
              Monto: p.amount,
              Método: p.method,
              Estado: p.status === 'APPROVED' ? 'Aprobado' : p.status === 'PENDING' ? 'Pendiente' : 'Rechazado'
          };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Cobros");
      XLSX.writeFile(wb, `Cobros_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Control de Cobros</h2>
            <p className="text-slate-500 text-sm">Gestiona los pagos recibidos e informados</p>
          </div>
          <div className="flex gap-2">
              <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold hover:bg-emerald-100 transition-colors">
                  <Download className="w-4 h-4"/> Excel
              </button>
              <button onClick={() => setShowAddModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                  <Plus className="w-4 h-4 mr-2" /> Registrar Cobro
              </button>
          </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(s => (
                  <button 
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterStatus === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      {s === 'ALL' ? 'Todos' : s === 'PENDING' ? 'Pendientes' : s === 'APPROVED' ? 'Aprobados' : 'Rechazados'}
                  </button>
              ))}
          </div>
          <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar unidad o nombre..." 
                className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:border-indigo-500"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                  <tr>
                      <th className="px-6 py-3">Fecha</th>
                      <th className="px-6 py-3">Unidad</th>
                      <th className="px-6 py-3">Monto</th>
                      <th className="px-6 py-3">Método</th>
                      <th className="px-6 py-3">Comprobante</th>
                      <th className="px-6 py-3 text-center">Estado / Acciones</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                  {filteredPayments.map(p => {
                      const unit = units.find(u => u.id === p.unitId);
                      return (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-3 text-slate-500">{new Date(p.date).toLocaleDateString()}</td>
                              <td className="px-6 py-3 font-medium text-slate-800">
                                  UF {unit?.unitNumber} <span className="text-slate-400 font-normal">({unit?.ownerName})</span>
                              </td>
                              <td className="px-6 py-3 font-bold text-slate-700">${p.amount.toFixed(2)}</td>
                              <td className="px-6 py-3 text-slate-500">{p.method}</td>
                              <td className="px-6 py-3">
                                  {p.attachmentUrl ? (
                                      <a href={p.attachmentUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1">
                                          <FileText className="w-3 h-3"/> Ver
                                      </a>
                                  ) : <span className="text-slate-300">-</span>}
                              </td>
                              <td className="px-6 py-3 text-center">
                                  {p.status === 'PENDING' ? (
                                      <div className="flex justify-center gap-2">
                                          <button onClick={() => onUpdateStatus(p.id, 'APPROVED')} className="p-1 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200" title="Aprobar"><CheckCircle className="w-5 h-5"/></button>
                                          <button onClick={() => onUpdateStatus(p.id, 'REJECTED')} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200" title="Rechazar"><XCircle className="w-5 h-5"/></button>
                                      </div>
                                  ) : (
                                      <span className={`px-2 py-1 rounded text-xs font-bold ${p.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                          {p.status === 'APPROVED' ? 'Aprobado' : 'Rechazado'}
                                      </span>
                                  )}
                              </td>
                          </tr>
                      )
                  })}
              </tbody>
          </table>
          {filteredPayments.length === 0 && (
              <div className="p-8 text-center text-slate-400">No se encontraron pagos con estos filtros.</div>
          )}
      </div>

      {/* Modal Carga Manual */}
      {showAddModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-xl">
                  <h3 className="font-bold text-lg mb-4">Registrar Cobro (Efectivo/Otro)</h3>
                  <form onSubmit={handleManualAdd} className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Unidad</label>
                          <select className="w-full p-2 border rounded" value={newUnitId} onChange={e => setNewUnitId(e.target.value)} required>
                              <option value="">Seleccionar...</option>
                              {units.map(u => <option key={u.id} value={u.id}>UF {u.unitNumber} - {u.ownerName}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Monto ($)</label>
                          <input type="number" step="0.01" className="w-full p-2 border rounded" value={newAmount} onChange={e => setNewAmount(e.target.value)} required />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                          <input type="date" className="w-full p-2 border rounded" value={newDate} onChange={e => setNewDate(e.target.value)} required />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Método</label>
                          <select className="w-full p-2 border rounded" value={newMethod} onChange={e => setNewMethod(e.target.value as any)}>
                              <option value="Efectivo">Efectivo</option>
                              <option value="Transferencia">Transferencia</option>
                              <option value="Cheque">Cheque</option>
                          </select>
                      </div>
                      <div className="flex gap-2 pt-2">
                          <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 text-slate-500 hover:bg-slate-100 rounded">Cancelar</button>
                          <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Registrar</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default CollectionsView;