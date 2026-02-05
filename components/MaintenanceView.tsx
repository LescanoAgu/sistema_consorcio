import React, { useState, useMemo } from 'react';
import { MaintenanceRequest, Unit, UserRole } from '../types';
import { Wrench, Plus, CheckCircle, Clock, AlertCircle, MessageSquare, ChevronRight, X } from 'lucide-react';

interface MaintenanceViewProps {
  requests: MaintenanceRequest[];
  units: Unit[];
  userRole: UserRole;
  userEmail: string;
  onAdd: (data: Omit<MaintenanceRequest, 'id'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<MaintenanceRequest>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const MaintenanceView: React.FC<MaintenanceViewProps> = ({ requests, units, userRole, userEmail, onAdd, onUpdate, onDelete }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({ title: '', description: '' });
  const [adminResponse, setAdminResponse] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filtrar reclamos: Admin ve todos, Usuario ve solo los suyos
  const filteredRequests = useMemo(() => {
      if (userRole === 'ADMIN' || userRole === 'DEV') return requests;
      const myUnit = units.find(u => u.linkedEmail === userEmail);
      if (!myUnit) return [];
      return requests.filter(r => r.unitId === myUnit.id);
  }, [requests, userRole, userEmail, units]);

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const myUnit = units.find(u => u.linkedEmail === userEmail) || units[0]; // Fallback for admin testing
      if (!myUnit) return alert("No tienes unidad asignada para crear reclamos.");

      await onAdd({
          unitId: myUnit.id,
          title: newRequest.title,
          description: newRequest.description,
          status: 'PENDING',
          date: new Date().toISOString()
      });
      setIsFormOpen(false);
      setNewRequest({ title: '', description: '' });
  };

  const handleStatusChange = async (id: string, newStatus: 'PENDING' | 'IN_PROGRESS' | 'DONE') => {
      await onUpdate(id, { status: newStatus });
  };

  const handleAdminResponse = async (id: string) => {
      if(!adminResponse) return;
      await onUpdate(id, { adminResponse });
      setEditingId(null);
      setAdminResponse('');
  };

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'PENDING': return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold flex items-center w-fit"><Clock className="w-3 h-3 mr-1"/> Pendiente</span>;
          case 'IN_PROGRESS': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold flex items-center w-fit"><Wrench className="w-3 h-3 mr-1"/> En Proceso</span>;
          case 'DONE': return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold flex items-center w-fit"><CheckCircle className="w-3 h-3 mr-1"/> Resuelto</span>;
          default: return null;
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-indigo-600"/> Mantenimiento y Reclamos
          </h2>
          <button onClick={() => setIsFormOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition-colors shadow-sm">
              <Plus className="w-4 h-4 mr-2"/> Nuevo Reclamo
          </button>
      </div>

      {/* MODAL CREAR RECLAMO */}
      {isFormOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg">Nuevo Reporte</h3>
                      <button onClick={() => setIsFormOpen(false)}><X className="w-5 h-5 text-slate-400"/></button>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4">
                      <input 
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Asunto (Ej: Luz quemada palier 1)"
                        value={newRequest.title}
                        onChange={e => setNewRequest({...newRequest, title: e.target.value})}
                        required
                      />
                      <textarea 
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Descripción detallada..."
                        rows={3}
                        value={newRequest.description}
                        onChange={e => setNewRequest({...newRequest, description: e.target.value})}
                        required
                      />
                      <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700">Enviar Reporte</button>
                  </form>
              </div>
          </div>
      )}

      {/* LISTA DE RECLAMOS */}
      <div className="grid gap-4">
          {filteredRequests.length === 0 ? (
              <div className="text-center p-12 bg-slate-50 border-2 border-dashed rounded-xl text-slate-400">
                  <Wrench className="w-12 h-12 mx-auto mb-2 opacity-20"/>
                  <p>No hay reclamos activos.</p>
              </div>
          ) : (
              filteredRequests.map(req => {
                  const unit = units.find(u => u.id === req.unitId);
                  return (
                      <div key={req.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                          <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                              <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                      {getStatusBadge(req.status)}
                                      <span className="text-xs text-slate-400">{new Date(req.date).toLocaleDateString()}</span>
                                      {userRole === 'ADMIN' && (
                                          <span className="text-xs font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                                              UF {unit?.unitNumber}
                                          </span>
                                      )}
                                  </div>
                                  <h3 className="font-bold text-slate-800 text-lg">{req.title}</h3>
                                  <p className="text-slate-600 mt-1 text-sm">{req.description}</p>
                                  
                                  {req.adminResponse && (
                                      <div className="mt-3 bg-indigo-50 p-3 rounded-lg border border-indigo-100 flex gap-3 items-start">
                                          <MessageSquare className="w-4 h-4 text-indigo-600 mt-1 shrink-0"/>
                                          <div>
                                              <p className="text-xs font-bold text-indigo-700 uppercase">Respuesta Administración</p>
                                              <p className="text-sm text-indigo-900">{req.adminResponse}</p>
                                          </div>
                                      </div>
                                  )}
                              </div>

                              {/* ACCIONES ADMIN */}
                              {userRole === 'ADMIN' && (
                                  <div className="flex flex-col gap-2 min-w-[140px]">
                                      <select 
                                        className="text-xs border p-1 rounded bg-slate-50 font-medium"
                                        value={req.status}
                                        onChange={(e) => handleStatusChange(req.id, e.target.value as any)}
                                      >
                                          <option value="PENDING">Pendiente</option>
                                          <option value="IN_PROGRESS">En Proceso</option>
                                          <option value="DONE">Resuelto</option>
                                      </select>
                                      
                                      {!req.adminResponse && (
                                          <button 
                                            onClick={() => setEditingId(req.id)}
                                            className="text-xs text-indigo-600 hover:underline text-left"
                                          >
                                              Responder...
                                          </button>
                                      )}
                                  </div>
                              )}
                          </div>

                          {/* CAMPO RESPUESTA ADMIN */}
                          {editingId === req.id && (
                              <div className="mt-4 flex gap-2">
                                  <input 
                                    className="flex-1 text-sm border rounded p-2"
                                    placeholder="Escribir respuesta..."
                                    value={adminResponse}
                                    onChange={e => setAdminResponse(e.target.value)}
                                  />
                                  <button onClick={() => handleAdminResponse(req.id)} className="bg-indigo-600 text-white px-3 py-1 rounded text-sm">Enviar</button>
                                  <button onClick={() => setEditingId(null)} className="text-slate-400 px-2"><X className="w-4 h-4"/></button>
                              </div>
                          )}
                      </div>
                  )
              })
          )}
      </div>
    </div>
  );
};

export default MaintenanceView;