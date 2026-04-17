import React, { useState, useEffect } from 'react';
import { Unit, SettlementRecord, Payment, DebtAdjustment, Consortium, JoinRequest } from '../types';
import CollectionsView from './CollectionsView';
import DebtorsView from './DebtorsView';
import UnitsView from './UnitsView';
import { Wallet, AlertTriangle, Users, LayoutTemplate, UserPlus, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { getPendingJoinRequests, updateJoinRequest, registerUserAccess } from '../services/firestoreService';

interface ManagementViewProps {
  units: Unit[];
  setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
  consortiumId: string;
  history: SettlementRecord[];
  payments: Payment[];
  debtAdjustments: DebtAdjustment[];
  consortium: Consortium;
  onUpdateUnit: (id: string, updates: Partial<Unit>) => Promise<void>;
  onAddPayment: (p: Omit<Payment, 'id'>) => Promise<void>;
  onUpdateStatus: (id: string, s: 'APPROVED' | 'REJECTED') => Promise<void>;
  onDeletePayment: (id: string) => Promise<void>;
}

const ManagementView: React.FC<ManagementViewProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'COBROS' | 'DEUDAS' | 'UNIDADES' | 'SOLICITUDES'>('COBROS');

  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [approvingReq, setApprovingReq] = useState<JoinRequest | null>(null);
  const [selectedUnitForReq, setSelectedUnitForReq] = useState('');

  useEffect(() => {
      if (props.consortiumId) {
          getPendingJoinRequests(props.consortiumId).then(setRequests);
      }
  }, [props.consortiumId]);

  const handleApprove = async () => {
      if (!approvingReq || !selectedUnitForReq) return;
      try {
          const unit = props.units.find(u => u.id === selectedUnitForReq);
          if(!unit) return;
          const newEmails = [...(unit.authorizedEmails || []), approvingReq.userEmail];
          
          await props.onUpdateUnit(selectedUnitForReq, { authorizedEmails: newEmails });
          await registerUserAccess(approvingReq.userEmail, props.consortiumId);
          await updateJoinRequest(approvingReq.id, 'APPROVED');
          
          setRequests(requests.filter(r => r.id !== approvingReq.id));
          setApprovingReq(null);
          setSelectedUnitForReq('');
          alert('¡Usuario aprobado y vinculado a la unidad exitosamente!');
      } catch (e) {
          alert('Error al aprobar la solicitud.');
      }
  };

  const handleReject = async (reqId: string) => {
      if(!confirm("¿Rechazar esta solicitud de acceso?")) return;
      await updateJoinRequest(reqId, 'REJECTED');
      setRequests(requests.filter(r => r.id !== reqId));
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-3">
                <LayoutTemplate className="w-8 h-8 text-indigo-400" />
                Gestión Integral
            </h1>
            <p className="text-slate-400 mt-1">Administración centralizada de cobros, morosidad y accesos.</p>
          </div>
          
          <div className="flex bg-slate-800 p-1.5 rounded-xl w-full md:w-auto overflow-x-auto">
              <button onClick={() => setActiveTab('COBROS')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'COBROS' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}>
                  <Wallet className="w-4 h-4"/> Cobros
              </button>
              <button onClick={() => setActiveTab('DEUDAS')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'DEUDAS' ? 'bg-red-500 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}>
                  <AlertTriangle className="w-4 h-4"/> Deudas
              </button>
              <button onClick={() => setActiveTab('UNIDADES')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'UNIDADES' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}>
                  <Users className="w-4 h-4"/> Unidades
              </button>
              <button onClick={() => setActiveTab('SOLICITUDES')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap relative ${activeTab === 'SOLICITUDES' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}>
                  <UserPlus className="w-4 h-4"/> Solicitudes
                  {requests.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full animate-pulse">{requests.length}</span>}
              </button>
          </div>
      </div>

      <div className="animate-fade-in">
          {activeTab === 'COBROS' && <CollectionsView payments={props.payments} units={props.units} history={props.history} debtAdjustments={props.debtAdjustments} onAddPayment={props.onAddPayment} onUpdateStatus={props.onUpdateStatus} />}
          {activeTab === 'DEUDAS' && <DebtorsView units={props.units} history={props.history} payments={props.payments} consortium={props.consortium} onUpdateUnit={props.onUpdateUnit} />}
          {activeTab === 'UNIDADES' && <UnitsView units={props.units} setUnits={props.setUnits} consortiumId={props.consortiumId} payments={props.payments} history={props.history} consortium={props.consortium} onUpdateUnit={props.onUpdateUnit} onDeletePayment={props.onDeletePayment} />}
          
          {activeTab === 'SOLICITUDES' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[400px]">
                  <h3 className="font-bold text-slate-800 mb-6 text-xl">Solicitudes de Acceso Pendientes</h3>
                  {requests.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-20"/>
                          <p className="font-medium text-lg">No hay solicitudes pendientes.</p>
                          <p className="text-sm mt-1">Los vecinos que se registren aparecerán aquí.</p>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {requests.map(req => (
                              <div key={req.id} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col justify-between">
                                  <div className="mb-4">
                                      <p className="font-black text-slate-800 text-lg break-words">
                                          {req.firstName || 'Usuario'} {req.lastName || 'Nuevo'}
                                      </p>
                                      <p className="text-sm text-indigo-600 font-medium mb-3">{req.userEmail}</p>
                                      
                                      {req.message && (
                                          <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg flex items-start gap-2 text-sm text-amber-800">
                                              <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5 opacity-50"/>
                                              <span className="italic">"{req.message}"</span>
                                          </div>
                                      )}
                                      
                                      <p className="text-xs text-slate-400 mt-4 font-medium">Solicitó unirse el {new Date(req.date).toLocaleDateString()}</p>
                                  </div>
                                  <div className="flex gap-2">
                                      <button onClick={() => setApprovingReq(req)} className="flex-1 flex items-center justify-center gap-1 px-4 py-2.5 bg-emerald-50 text-emerald-700 font-bold rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-200">
                                          <CheckCircle className="w-4 h-4"/> Aprobar
                                      </button>
                                      <button onClick={() => handleReject(req.id)} className="flex-1 flex items-center justify-center gap-1 px-4 py-2.5 bg-red-50 text-red-700 font-bold rounded-lg hover:bg-red-100 transition-colors border border-red-200">
                                          <XCircle className="w-4 h-4"/> Rechazar
                                      </button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          )}
      </div>

      {approvingReq && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in">
                  <div className="flex items-center gap-3 mb-2 text-indigo-600">
                      <div className="p-2 bg-indigo-100 rounded-lg"><UserPlus className="w-5 h-5"/></div>
                      <h3 className="font-black text-xl text-slate-800">Vincular Usuario</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-6 font-medium leading-relaxed">Selecciona a qué unidad del consorcio pertenece el correo <strong className="text-slate-800 bg-slate-100 px-1 rounded break-words">{approvingReq.userEmail}</strong>.</p>
                  
                  <div className="mb-6">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Unidad Funcional</label>
                      <select 
                          className="w-full p-3 border border-slate-200 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" 
                          value={selectedUnitForReq} 
                          onChange={e => setSelectedUnitForReq(e.target.value)}
                      >
                          <option value="">Seleccionar Unidad...</option>
                          {props.units.map(u => <option key={u.id} value={u.id}>{u.unitNumber} - {u.ownerName}</option>)}
                      </select>
                  </div>

                  <div className="flex gap-3">
                      <button onClick={() => setApprovingReq(null)} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                      <button onClick={handleApprove} disabled={!selectedUnitForReq} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-colors">Asignar y Aprobar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ManagementView;