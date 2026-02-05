import React, { useState, useMemo } from 'react';
import { Amenity, Booking, Unit, UserRole } from '../types';
import { Calendar, Plus, Trash2, Clock, CheckCircle, Users, X, Info } from 'lucide-react';

interface AmenitiesViewProps {
  amenities: Amenity[];
  bookings: Booking[];
  units: Unit[];
  userRole: UserRole;
  userEmail: string;
  onAddAmenity: (data: Omit<Amenity, 'id'>) => Promise<void>;
  onDeleteAmenity: (id: string) => Promise<void>;
  onAddBooking: (data: Omit<Booking, 'id'>) => Promise<void>;
  onDeleteBooking: (id: string) => Promise<void>;
}

const TIME_SLOTS = ['Mañana (10-14hs)', 'Tarde (14-18hs)', 'Noche (19-23hs)'];

const AmenitiesView: React.FC<AmenitiesViewProps> = ({ amenities, bookings, units, userRole, userEmail, onAddAmenity, onDeleteAmenity, onAddBooking, onDeleteBooking }) => {
  const [activeTab, setActiveTab] = useState<'CALENDAR' | 'ADMIN'>('CALENDAR');
  const [selectedAmenityId, setSelectedAmenityId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Admin form state
  const [newAmenity, setNewAmenity] = useState({ name: '', description: '', capacity: 10 });

  const myUnit = useMemo(() => units.find(u => u.linkedEmail === userEmail), [units, userEmail]);

  // Filtrar reservas por fecha y espacio seleccionado
  const bookingsForDate = useMemo(() => {
      return bookings.filter(b => b.date === selectedDate && (selectedAmenityId ? b.amenityId === selectedAmenityId : true));
  }, [bookings, selectedDate, selectedAmenityId]);

  const handleCreateAmenity = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newAmenity.name) return;
      await onAddAmenity({ ...newAmenity, requiresApproval: false });
      setNewAmenity({ name: '', description: '', capacity: 10 });
  };

  const handleBook = async (slot: string) => {
      if (!selectedAmenityId) return alert("Selecciona un espacio primero.");
      if (!myUnit && userRole !== 'ADMIN') return alert("No tienes unidad asignada.");
      
      const unitToBook = myUnit || units[0]; // Admin fallback

      if (confirm(`¿Reservar ${slot} para el ${selectedDate}?`)) {
          try {
              await onAddBooking({
                  amenityId: selectedAmenityId,
                  unitId: unitToBook.id,
                  unitNumber: unitToBook.unitNumber,
                  date: selectedDate,
                  timeSlot: slot,
                  status: 'CONFIRMED',
                  createdAt: new Date().toISOString()
              });
              alert("¡Reserva confirmada!");
          } catch (error) {
              alert("Error: El turno ya está ocupado.");
          }
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-indigo-600"/> Reservas y Espacios
          </h2>
          {userRole === 'ADMIN' && (
              <div className="flex bg-white rounded-lg p-1 border shadow-sm">
                  <button 
                    onClick={() => setActiveTab('CALENDAR')}
                    className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${activeTab === 'CALENDAR' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      Calendario
                  </button>
                  <button 
                    onClick={() => setActiveTab('ADMIN')}
                    className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${activeTab === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      Gestionar Espacios
                  </button>
              </div>
          )}
      </div>

      {amenities.length === 0 && activeTab === 'CALENDAR' && (
          <div className="text-center p-12 bg-slate-50 border-2 border-dashed rounded-xl text-slate-400">
              <Info className="w-12 h-12 mx-auto mb-2 opacity-20"/>
              <p>No hay espacios comunes configurados.</p>
              {userRole === 'ADMIN' && <button onClick={() => setActiveTab('ADMIN')} className="text-indigo-600 hover:underline">Crear uno ahora</button>}
          </div>
      )}

      {/* VISTA CALENDARIO Y RESERVAS */}
      {activeTab === 'CALENDAR' && amenities.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* COL 1: Selectores */}
              <div className="space-y-6">
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                      <label className="block text-sm font-bold text-slate-700 mb-2">1. Elige un Espacio</label>
                      <div className="space-y-2">
                          {amenities.map(a => (
                              <button
                                key={a.id}
                                onClick={() => setSelectedAmenityId(a.id)}
                                className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex justify-between items-center ${selectedAmenityId === a.id ? 'border-indigo-500 bg-indigo-50 text-indigo-800 shadow-sm' : 'border-slate-200 hover:border-indigo-300'}`}
                              >
                                  <span className="font-bold">{a.name}</span>
                                  <span className="text-xs flex items-center text-slate-500"><Users className="w-3 h-3 mr-1"/> {a.capacity} pers.</span>
                              </button>
                          ))}
                      </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                      <label className="block text-sm font-bold text-slate-700 mb-2">2. Elige una Fecha</label>
                      <input 
                        type="date" 
                        value={selectedDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                  </div>
              </div>

              {/* COL 2: Turnos Disponibles */}
              <div className="lg:col-span-2">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full">
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                          <Clock className="w-5 h-5 text-indigo-600"/> Turnos Disponibles ({new Date(selectedDate).toLocaleDateString()})
                      </h3>
                      
                      {!selectedAmenityId ? (
                          <div className="text-center text-slate-400 py-10">Selecciona un espacio para ver turnos.</div>
                      ) : (
                          <div className="grid gap-4">
                              {TIME_SLOTS.map(slot => {
                                  const booking = bookings.find(b => b.amenityId === selectedAmenityId && b.date === selectedDate && b.timeSlot === slot);
                                  const isMyBooking = booking?.unitId === myUnit?.id;

                                  if (booking) {
                                      return (
                                          <div key={slot} className={`p-4 rounded-lg border flex justify-between items-center ${isMyBooking ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200 opacity-70'}`}>
                                              <div className="flex items-center gap-3">
                                                  <div className="bg-slate-200 text-slate-500 p-2 rounded-lg"><Clock className="w-5 h-5"/></div>
                                                  <div>
                                                      <p className="font-bold text-slate-700">{slot}</p>
                                                      <p className="text-xs text-slate-500">Reservado por UF {booking.unitNumber} {isMyBooking && '(Vos)'}</p>
                                                  </div>
                                              </div>
                                              {(isMyBooking || userRole === 'ADMIN') && (
                                                  <button onClick={() => onDeleteBooking(booking.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors" title="Cancelar Reserva">
                                                      <Trash2 className="w-5 h-5"/>
                                                  </button>
                                              )}
                                          </div>
                                      );
                                  }

                                  return (
                                      <div key={slot} className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 flex justify-between items-center hover:shadow-md transition-shadow">
                                          <div className="flex items-center gap-3">
                                              <div className="bg-emerald-100 text-emerald-600 p-2 rounded-lg"><CheckCircle className="w-5 h-5"/></div>
                                              <div>
                                                  <p className="font-bold text-slate-700">{slot}</p>
                                                  <p className="text-xs text-emerald-600 font-bold">DISPONIBLE</p>
                                              </div>
                                          </div>
                                          <button 
                                            onClick={() => handleBook(slot)}
                                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-700 transition-colors"
                                          >
                                              Reservar
                                          </button>
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* VISTA ADMIN (Gestión de Espacios) */}
      {activeTab === 'ADMIN' && userRole === 'ADMIN' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-700 mb-4">Crear Nuevo Espacio</h3>
                  <form onSubmit={handleCreateAmenity} className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-600 mb-1">Nombre</label>
                          <input className="w-full p-2 border rounded" placeholder="Ej: Quincho Grande" value={newAmenity.name} onChange={e => setNewAmenity({...newAmenity, name: e.target.value})} required/>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-600 mb-1">Descripción</label>
                          <input className="w-full p-2 border rounded" placeholder="Ej: Incluye parrilla y baño" value={newAmenity.description} onChange={e => setNewAmenity({...newAmenity, description: e.target.value})}/>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-600 mb-1">Capacidad (Personas)</label>
                          <input type="number" className="w-full p-2 border rounded" value={newAmenity.capacity} onChange={e => setNewAmenity({...newAmenity, capacity: Number(e.target.value)})}/>
                      </div>
                      <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700">Guardar Espacio</button>
                  </form>
              </div>

              <div className="space-y-4">
                  <h3 className="font-bold text-slate-700">Espacios Existentes</h3>
                  {amenities.map(a => (
                      <div key={a.id} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                          <div>
                              <h4 className="font-bold text-slate-800">{a.name}</h4>
                              <p className="text-sm text-slate-500">{a.description} • Cap: {a.capacity}</p>
                          </div>
                          <button onClick={() => onDeleteAmenity(a.id)} className="text-slate-400 hover:text-red-600 p-2"><Trash2 className="w-5 h-5"/></button>
                      </div>
                  ))}
              </div>
          </div>
      )}
    </div>
  );
};

export default AmenitiesView;