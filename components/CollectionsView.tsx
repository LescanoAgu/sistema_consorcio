
import React, { useState, useMemo } from 'react';
import { Payment, Unit } from '../types';
import { Plus, Search, DollarSign, Calendar, X, Save, Paperclip, FileText } from 'lucide-react';

interface CollectionsViewProps {
  payments: Payment[];
  units: Unit[];
  setPayments: React.Dispatch<React.SetStateAction<Payment[]>>;
}

const CollectionsView: React.FC<CollectionsViewProps> = ({ payments, units, setPayments }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newPayment, setNewPayment] = useState<Partial<Payment>>({
    unitId: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    method: 'Transferencia',
    notes: '',
    attachmentUrl: ''
  });

  const handleAdd = () => {
    if (!newPayment.unitId || !newPayment.amount) return;
    
    const payment: Payment = {
        id: crypto.randomUUID(),
        unitId: newPayment.unitId,
        amount: Number(newPayment.amount),
        date: newPayment.date || new Date().toISOString().split('T')[0],
        method: newPayment.method as any,
        notes: newPayment.notes,
        attachmentUrl: newPayment.attachmentUrl
    };

    setPayments(prev => [payment, ...prev]);
    setIsAdding(false);
    setNewPayment({
        unitId: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        method: 'Transferencia',
        notes: '',
        attachmentUrl: ''
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const fileName = e.target.files[0].name;
          setNewPayment({ ...newPayment, attachmentUrl: `comprobante_simulado_${fileName}` });
      }
  };

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
        const unit = units.find(u => u.id === p.unitId);
        const searchString = `${unit?.unitNumber} ${unit?.ownerName} ${p.notes}`.toLowerCase();
        return searchString.includes(searchTerm.toLowerCase());
    });
  }, [payments, units, searchTerm]);

  const totalCollected = payments.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Módulo de Cobros</h2>
           <p className="text-slate-500 text-sm">Registro de pagos recibidos de propietarios</p>
        </div>
        <div className="bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100 flex items-center">
            <DollarSign className="w-5 h-5 text-emerald-600 mr-2" />
            <span className="text-emerald-800 font-bold text-lg">${totalCollected.toFixed(2)}</span>
            <span className="text-emerald-600 text-xs ml-2 uppercase font-semibold">Recaudado este mes</span>
        </div>
      </div>

      <div className="flex gap-4">
          <div className="relative flex-1">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar por unidad, propietario..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center shadow-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-2" />
            Registrar Pago
          </button>
      </div>

      {isAdding && (
          <div className="bg-white p-6 rounded-xl shadow-md border border-indigo-100 animate-fade-in">
              <div className="flex justify-between mb-4">
                  <h3 className="font-semibold text-slate-700">Nuevo Cobro</h3>
                  <button onClick={() => setIsAdding(false)}><X className="w-5 h-5 text-slate-400 hover:text-red-500"/></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Unidad</label>
                      <select 
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm"
                        value={newPayment.unitId}
                        onChange={e => setNewPayment({...newPayment, unitId: e.target.value})}
                      >
                          <option value="">Seleccionar Unidad...</option>
                          {units.map(u => (
                              <option key={u.id} value={u.id}>{u.unitNumber} - {u.ownerName}</option>
                          ))}
                      </select>
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Monto ($)</label>
                      <input 
                        type="number" 
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm"
                        value={newPayment.amount}
                        onChange={e => setNewPayment({...newPayment, amount: parseFloat(e.target.value)})}
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                      <input 
                        type="date" 
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm"
                        value={newPayment.date}
                        onChange={e => setNewPayment({...newPayment, date: e.target.value})}
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Medio de Pago</label>
                      <select 
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm"
                        value={newPayment.method}
                        onChange={e => setNewPayment({...newPayment, method: e.target.value as any})}
                      >
                          <option value="Transferencia">Transferencia Bancaria</option>
                          <option value="Efectivo">Efectivo</option>
                          <option value="Cheque">Cheque</option>
                      </select>
                  </div>
                   <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Comprobante de Pago (PDF/Foto)</label>
                      <label className="flex items-center justify-center px-4 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors w-full bg-white shadow-sm">
                        <Paperclip className="w-4 h-4 mr-2 text-slate-500" />
                        <span className="text-sm text-slate-600 truncate">
                            {newPayment.attachmentUrl ? newPayment.attachmentUrl.replace('comprobante_simulado_', '') : 'Adjuntar archivo...'}
                        </span>
                        <input type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={handleFileChange} />
                    </label>
                  </div>
                   <div className="md:col-span-1 lg:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Notas (Opcional)</label>
                      <input 
                        type="text" 
                        placeholder="Ej: Pago parcial expensas Noviembre"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm"
                        value={newPayment.notes}
                        onChange={e => setNewPayment({...newPayment, notes: e.target.value})}
                      />
                  </div>
              </div>
              <div className="mt-4 flex justify-end">
                  <button onClick={handleAdd} className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 flex items-center shadow-sm">
                      <Save className="w-4 h-4 mr-2" /> Guardar Pago
                  </button>
              </div>
          </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
              <th className="px-6 py-3 font-medium">Fecha</th>
              <th className="px-6 py-3 font-medium">Unidad</th>
              <th className="px-6 py-3 font-medium">Propietario</th>
              <th className="px-6 py-3 font-medium">Método</th>
              <th className="px-6 py-3 font-medium">Notas</th>
              <th className="px-6 py-3 font-medium text-center">Comp.</th>
              <th className="px-6 py-3 font-medium text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
             {filteredPayments.map(payment => {
                 const unit = units.find(u => u.id === payment.unitId);
                 return (
                    <tr key={payment.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-slate-600 text-sm">{payment.date}</td>
                        <td className="px-6 py-4 font-bold text-slate-700">{unit?.unitNumber || '???'}</td>
                        <td className="px-6 py-4 text-slate-700">{unit?.ownerName || 'Desconocido'}</td>
                        <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600 font-medium">
                                {payment.method}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 italic">{payment.notes || '-'}</td>
                         <td className="px-6 py-4 text-center">
                            {payment.attachmentUrl ? (
                                <button className="text-indigo-600 hover:text-indigo-800" title="Ver comprobante">
                                    <FileText className="w-4 h-4 mx-auto" />
                                </button>
                            ) : (
                                <span className="text-slate-300">-</span>
                            )}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-600">+${payment.amount.toFixed(2)}</td>
                    </tr>
                 )
             })}
             {filteredPayments.length === 0 && (
                 <tr>
                     <td colSpan={7} className="text-center py-8 text-slate-500">No hay pagos registrados con ese criterio.</td>
                 </tr>
             )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CollectionsView;
