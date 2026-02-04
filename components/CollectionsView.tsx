import React, { useState, useMemo } from 'react';
import { Payment, Unit } from '../types';
import { Plus, Search, DollarSign, CheckCircle, XCircle, FileText, AlertCircle, Calendar } from 'lucide-react';

interface CollectionsViewProps {
  payments: Payment[];
  units: Unit[];
  onAddPayment: (payment: Omit<Payment, 'id'>) => Promise<void>;
  onUpdateStatus: (paymentId: string, newStatus: 'APPROVED' | 'REJECTED') => Promise<void>;
}

const CollectionsView: React.FC<CollectionsViewProps> = ({ payments, units, onAddPayment, onUpdateStatus }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const [newPayment, setNewPayment] = useState<{
    unitId: string, amount: string, date: string, method: 'Transferencia' | 'Efectivo' | 'Cheque', notes: string
  }>({
    unitId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    method: 'Transferencia',
    notes: ''
  });

  const pendingPayments = useMemo(() => payments.filter(p => p.status === 'PENDING'), [payments]);
  const historyPayments = useMemo(() => {
    return payments.filter(p => p.status !== 'PENDING').filter(p => {
        const unit = units.find(u => u.id === p.unitId);
        const searchString = `${unit?.unitNumber} ${unit?.ownerName} ${p.notes}`.toLowerCase();
        return searchString.includes(searchTerm.toLowerCase());
    });
  }, [payments, units, searchTerm]);

  const totalCollectedThisMonth = useMemo(() => {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      return payments
        .filter(p => p.status === 'APPROVED' && p.date.startsWith(currentMonth))
        .reduce((acc, curr) => acc + curr.amount, 0);
  }, [payments]);

  const handleManualAdd = async () => {
    if (!newPayment.unitId || !newPayment.amount) return;
    await onAddPayment({
        unitId: newPayment.unitId,
        amount: parseFloat(newPayment.amount),
        date: newPayment.date,
        method: newPayment.method,
        notes: newPayment.notes,
        status: 'APPROVED' // Los manuales del admin entran aprobados
    });
    setIsAdding(false);
    setNewPayment({ unitId: '', amount: '', date: new Date().toISOString().split('T')[0], method: 'Transferencia', notes: '' });
  };

  const handleStatusChange = async (id: string, status: 'APPROVED' | 'REJECTED') => {
      setProcessingId(id);
      await onUpdateStatus(id, status);
      setProcessingId(null);
  };

  return (
    <div className="space-y-8">
      {/* Header Stat */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Módulo de Cobros</h2>
           <p className="text-slate-500 text-sm">Gestión de pagos recibidos</p>
        </div>
        <div className="bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100 flex items-center shadow-sm">
            <DollarSign className="w-5 h-5 text-emerald-600 mr-2" />
            <span className="text-emerald-800 font-bold text-lg">${totalCollectedThisMonth.toFixed(2)}</span>
            <span className="text-emerald-600 text-xs ml-2 uppercase font-semibold">Recaudado este mes</span>
        </div>
      </div>

      {/* SECTION 1: Pending Approvals (Inbox) */}
      {pendingPayments.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 animate-fade-in">
              <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-amber-900 text-lg">Pagos Pendientes de Aprobación ({pendingPayments.length})</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingPayments.map(p => {
                      const unit = units.find(u => u.id === p.unitId);
                      return (
                          <div key={p.id} className="bg-white p-4 rounded-lg shadow-sm border border-amber-100 flex flex-col justify-between gap-4">
                              <div className="flex justify-between items-start">
                                  <div>
                                      <span className="inline-block bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded mb-1">{unit?.unitNumber}</span>
                                      <p className="font-bold text-slate-800">{unit?.ownerName}</p>
                                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                                          <Calendar className="w-3 h-3"/> {new Date(p.date).toLocaleDateString()}
                                      </p>
                                      {p.notes && <p className="text-xs text-slate-500 italic mt-1">"{p.notes}"</p>}
                                  </div>
                                  <div className="text-right">
                                      <span className="block text-xl font-bold text-emerald-600">${p.amount}</span>
                                      <span className="text-xs text-slate-400 uppercase">{p.method}</span>
                                  </div>
                              </div>
                              
                              <div className="flex items-center gap-3 pt-3 border-t border-slate-50">
                                  {p.attachmentUrl ? (
                                      <a href={p.attachmentUrl} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 text-indigo-600 text-sm font-medium hover:bg-indigo-50 py-2 rounded transition-colors">
                                          <FileText className="w-4 h-4" /> Ver Comprobante
                                      </a>
                                  ) : (
                                      <span className="flex-1 text-center text-xs text-slate-400 italic">Sin comprobante</span>
                                  )}
                                  
                                  <div className="flex gap-2">
                                      <button 
                                        disabled={processingId === p.id}
                                        onClick={() => handleStatusChange(p.id, 'REJECTED')}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" title="Rechazar">
                                          <XCircle className="w-6 h-6" />
                                      </button>
                                      <button 
                                        disabled={processingId === p.id}
                                        onClick={() => handleStatusChange(p.id, 'APPROVED')}
                                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50" title="Aprobar Pago">
                                          <CheckCircle className="w-6 h-6" />
                                      </button>
                                  </div>
                              </div>
                          </div>
                      )
                  })}
              </div>
          </div>
      )}

      {/* SECTION 2: Payment History & Manual Add */}
      <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Buscar en historial..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button
                onClick={() => setIsAdding(!isAdding)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center shadow-sm whitespace-nowrap"
            >
                <Plus className="w-4 h-4 mr-2" />
                {isAdding ? 'Cancelar' : 'Carga Manual'}
            </button>
        </div>

        {isAdding && (
            <div className="bg-white p-6 rounded-xl shadow-md border border-indigo-100 animate-fade-in">
                <h3 className="font-semibold text-slate-700 mb-4">Cargar Pago Manualmente (Admin)</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">UNIDAD</label>
                        <select className="w-full p-2 border rounded" value={newPayment.unitId} onChange={e => setNewPayment({...newPayment, unitId: e.target.value})}>
                            <option value="">Seleccionar...</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.unitNumber} - {u.ownerName}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">MONTO</label>
                        <input type="number" className="w-full p-2 border rounded" value={newPayment.amount} onChange={e => setNewPayment({...newPayment, amount: e.target.value})} placeholder="0.00" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">FECHA</label>
                        <input type="date" className="w-full p-2 border rounded" value={newPayment.date} onChange={e => setNewPayment({...newPayment, date: e.target.value})} />
                    </div>
                    <div className="flex items-end">
                        <button onClick={handleManualAdd} className="w-full bg-emerald-600 text-white font-bold py-2 rounded hover:bg-emerald-700">Guardar</button>
                    </div>
                </div>
            </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
            <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
                    <th className="px-6 py-3">Fecha</th>
                    <th className="px-6 py-3">Unidad</th>
                    <th className="px-6 py-3">Detalle</th>
                    <th className="px-6 py-3">Estado</th>
                    <th className="px-6 py-3 text-right">Monto</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
                {historyPayments.map(payment => {
                    const unit = units.find(u => u.id === payment.unitId);
                    return (
                        <tr key={payment.id} className="hover:bg-slate-50">
                            <td className="px-6 py-3 text-slate-600">{payment.date}</td>
                            <td className="px-6 py-3 font-bold text-slate-700">{unit?.unitNumber}</td>
                            <td className="px-6 py-3">
                                <p className="text-slate-700">{unit?.ownerName}</p>
                                <p className="text-xs text-slate-400">{payment.method} {payment.notes && `- ${payment.notes}`}</p>
                            </td>
                            <td className="px-6 py-3">
                                {payment.status === 'APPROVED' ? (
                                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex w-fit items-center gap-1">
                                        <CheckCircle className="w-3 h-3"/> Aprobado
                                    </span>
                                ) : (
                                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold flex w-fit items-center gap-1">
                                        <XCircle className="w-3 h-3"/> Rechazado
                                    </span>
                                )}
                            </td>
                            <td className={`px-6 py-3 text-right font-bold ${payment.status === 'REJECTED' ? 'text-slate-400 line-through' : 'text-emerald-600'}`}>
                                ${payment.amount.toFixed(2)}
                            </td>
                        </tr>
                    )
                })}
                {historyPayments.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">No hay historial de pagos.</td></tr>
                )}
            </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default CollectionsView;