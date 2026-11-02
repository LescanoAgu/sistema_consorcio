import { formatLocalDate } from '../utils/dateUtils';
import React, { useState, useMemo, useEffect } from 'react';
import { MaintenanceRequest, Unit, UserRole } from '../types';
import { Wrench, Plus, CheckCircle, Clock, MessageSquare, X } from 'lucide-react';

interface MaintenanceViewProps {
  requests: MaintenanceRequest[];
  units: Unit[];
  userRole: UserRole;
  userEmail: string;
  onAdd: (data: Omit<MaintenanceRequest, 'id'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<MaintenanceRequest>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const MaintenanceView: React.FC<MaintenanceViewProps> = ({ requests, units, userRole, userEmail, onAdd, onUpdate }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({ title: '', description: '' });
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [adminResponse, setAdminResponse] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedEmail = (userEmail || '').trim().toLowerCase();

  const myUnits = useMemo(() => {
      if (userRole === 'ADMIN') return units;
      return units.filter(u =>
          (u.authorizedEmails || []).some(em => em.trim().toLowerCase() === normalizedEmail)
      );
  }, [units, userRole, normalizedEmail]);

  useEffect(() => {
      if (myUnits.length > 0 && (!selectedUnitId || !myUnits.some(u => u.id === selectedUnitId))) {
          setSelectedUnitId(myUnits[0].id);
      }
  }, [myUnits, selectedUnitId]);

  // Filtrar reclamos: Admin ve todos, Usuario ve los de todas sus unidades vinculadas
  const filteredRequests = useMemo(() => {
      if (userRole === 'ADMIN') return requests;
      const myUnitIds = new Set(myUnits.map(u => u.id));
      return requests.filter(r => myUnitIds.has(r.unitId));
  }, [requests, userRole, myUnits]);

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const targetUnit = myUnits.find(u => u.id === selectedUnitId) || myUnits[0];
      if (!targetUnit) return alert("No tienes unidad asignada para crear reclamos.");

      setIsSubmitting(true);
      try {
          await onAdd({
              unitId: targetUnit.id,
              title: newRequest.title.trim(),
              description: newRequest.description.trim(),
              status: 'PENDING',
              date: new Date().toISOString()
          });
          setIsFormOpen(false);
          setNewRequest({ title: '', description: '' });
      } catch (err) {
          console.error(err);
          alert("Error al enviar el reclamo.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleStatusChange = async (id: string, newStatus: 'PENDING' | 'IN_PROGRESS' | 'DONE') => {
      await onUpdate(id, { status: newStatus });
  };

  const handleAdminResponse = async (id: string) => {
      if(!adminResponse.trim()) return;
      await onUpdate(id, { adminResponse: adminResponse.trim() });
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
      <div className="flex justify-between items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-indigo-600"/> Mantenimiento y Reclamos
          </h2>
          <button
              onClick={() => setIsFormOpen(true)}
              disabled={myUnits.length === 0}
              className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
          >
              <Plus className="w-4 h-4 mr-2"/> Nuevo Reclamo
          </button>
      </div>

      {/* MODAL CREAR RECLAMO */}
      {isFormOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-black text-lg text-slate-800">Nuevo Reporte de Mantenimiento</h3>
                      <button onClick={() => setIsFormOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600"/></button>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4">
                      {myUnits.length > 1 && (
                          <div>
                              <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">Unidad Funcional</label>
                              <select
                                  value={selectedUnitId}
                                  onChange={e => setSelectedUnitId(e.target.value)}
                                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                  {myUnits.map(u => (
                                      <option key={u.id} value={u.id}>
                                          UF {u.unitNumber} {u.block ? `(${u.block})` : ''} - {u.ownerName}
                                      </option>
                                  ))}
                              </select>
                          </div>
                      )}
                      <div>
                          <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">Asunto *</label>
                          <input 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm"
                            placeholder="Ej: Luz quemada en palier piso 2"
                            value={newRequest.title}
                            onChange={e => setNewRequest({...newRequest, title: e.target.value})}
                            required
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">Descripción detallada *</label>
                          <textarea 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm"
                            placeholder="Indicá ubicación, horarios o cualquier dato útil para el mantenimiento..."
                            rows={3}
                            value={newRequest.description}
                            onChange={e => setNewRequest({...newRequest, description: e.target.value})}
                            required
                          />
                      </div>
                      <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                          {isSubmitting ? 'Enviando...' : 'Enviar Reporte'}
                      </button>
                  </form>
              </div>
          </div>
      )}

      {/* LISTA DE RECLAMOS */}
      <div className="grid gap-4">
          {filteredRequests.length === 0 ? (
              <div className="text-center p-12 bg-white border border-slate-200 rounded-xl text-slate-400 shadow-sm">
                  <Wrench className="w-12 h-12 mx-auto mb-2 opacity-20"/>
                  <p className="font-medium">No hay reclamos registrados.</p>
              </div>
          ) : (
              filteredRequests.map(req => {
                  const unit = units.find(u => u.id === req.unitId);
                  return (
                      <div key={req.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                          <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                              <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                      {getStatusBadge(req.status)}
                                      <span className="text-xs text-slate-400">{formatLocalDate(req.date)}</span>
                                      {(userRole === 'ADMIN' || myUnits.length > 1) && unit && (
                                          <span className="text-xs font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                                              UF {unit.unitNumber}
                                          </span>
                                      )}
                                  </div>
                                  <h3 className="font-bold text-slate-800 text-lg">{req.title}</h3>
                                  <p className="text-slate-600 mt-1 text-sm whitespace-pre-wrap">{req.description}</p>
                                  
                                  {req.adminResponse && (
                                      <div className="mt-3 bg-indigo-50 p-3 rounded-lg border border-indigo-100 flex gap-3 items-start">
                                          <MessageSquare className="w-4 h-4 text-indigo-600 mt-1 shrink-0"/>
                                          <div>
                                              <p className="text-xs font-bold text-indigo-700 uppercase">Respuesta de Administración</p>
                                              <p className="text-sm text-indigo-900 mt-0.5">{req.adminResponse}</p>
                                          </div>
                                      </div>
                                  )}
                              </div>

                              {/* ACCIONES ADMIN */}
                              {userRole === 'ADMIN' && (
                                  <div className="flex flex-col gap-2 min-w-[140px]">
                                      <select 
                                        className="text-xs border p-1.5 rounded-lg bg-slate-50 font-medium"
                                        value={req.status}
                                        onChange={(e) => handleStatusChange(req.id, e.target.value as any)}
                                      >
                                          <option value="PENDING">Pendiente</option>
                                          <option value="IN_PROGRESS">En Proceso</option>
                                          <option value="DONE">Resuelto</option>
                                      </select>
                                      
                                      <button 
                                        onClick={() => { setEditingId(req.id); setAdminResponse(req.adminResponse || ''); }}
                                        className="text-xs text-indigo-600 hover:underline text-left font-semibold"
                                      >
                                          {req.adminResponse ? 'Editar respuesta...' : 'Responder...'}
                                      </button>
                                  </div>
                              )}
                          </div>

                          {/* CAMPO RESPUESTA ADMIN */}
                          {userRole === 'ADMIN' && editingId === req.id && (
                              <div className="mt-4 flex gap-2">
                                  <input 
                                    className="flex-1 text-sm border rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Escribir respuesta al propietario..."
                                    value={adminResponse}
                                    onChange={e => setAdminResponse(e.target.value)}
                                  />
                                  <button onClick={() => handleAdminResponse(req.id)} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold">Guardar</button>
                                  <button onClick={() => setEditingId(null)} className="text-slate-400 px-2"><X className="w-4 h-4"/></button>
                              </div>
                          )}
                      </div>
                  );
              })
          )}
      </div>
    </div>
  );
};

export default MaintenanceView;
