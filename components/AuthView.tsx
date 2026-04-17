import React, { useState, useEffect } from 'react';
import { Consortium, UserRole, JoinRequest } from '../types';
import { Building2, ArrowRight, LogOut, PlusCircle, AlertCircle, Loader2, UserPlus, Info, Search, X } from 'lucide-react';
import { auth } from '../src/config/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getAllConsortiums, getUserJoinRequests, createJoinRequest } from '../services/firestoreService';

interface AuthViewProps {
  isAuthenticated: boolean;
  onLoginSuccess: (email: string, role: UserRole) => void;
  onSelectConsortium: (consortium: Consortium) => void;
  consortiums: Consortium[];
  onCreateConsortium: (c: Consortium, userId: string) => void;
  onLogout: () => void;
  userRole: UserRole;
  userEmail: string;
}

const AuthView: React.FC<AuthViewProps> = ({ isAuthenticated, onSelectConsortium, consortiums, onCreateConsortium, onLogout, userEmail }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  
  const [isCreatingConsortium, setIsCreatingConsortium] = useState(false);
  const [newConsortium, setNewConsortium] = useState({ name: '', address: '', cuit: '' });

  const [allConsortiums, setAllConsortiums] = useState<Consortium[]>([]);
  const [myRequests, setMyRequests] = useState<JoinRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // NUEVO: Estado para el modal de datos de solicitud
  const [joinFormData, setJoinFormData] = useState<{ c: Consortium | null; firstName: string; lastName: string; message: string }>({
      c: null, firstName: '', lastName: '', message: ''
  });

  useEffect(() => {
      if (isAuthenticated && consortiums.length === 1 && !isCreatingConsortium) {
          onSelectConsortium(consortiums[0]);
      }
  }, [isAuthenticated, consortiums, isCreatingConsortium, onSelectConsortium]);

  useEffect(() => {
      if (isAuthenticated && consortiums.length === 0) {
          getAllConsortiums().then(setAllConsortiums);
          getUserJoinRequests(userEmail).then(setMyRequests);
      }
  }, [isAuthenticated, consortiums.length, userEmail]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'LOGIN') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
          setError('Correo o contraseña incorrectos.');
      } else if (err.code === 'auth/email-already-in-use') {
          setError('Este correo ya está registrado.');
      } else {
          setError(mode === 'LOGIN' ? 'Error al iniciar sesión.' : 'Error al registrarse.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
      if(!newConsortium.name) return;
      if (auth.currentUser) {
          onCreateConsortium({ id: '', name: newConsortium.name, address: newConsortium.address, cuit: newConsortium.cuit }, auth.currentUser.uid);
          setIsCreatingConsortium(false);
      }
  };

  const handleConfirmJoin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!joinFormData.c || !joinFormData.firstName || !joinFormData.lastName) return;
      
      setLoading(true);
      try {
          await createJoinRequest({
              userEmail,
              firstName: joinFormData.firstName,
              lastName: joinFormData.lastName,
              message: joinFormData.message,
              consortiumId: joinFormData.c.id,
              consortiumName: joinFormData.c.name,
              status: 'PENDING',
              date: new Date().toISOString()
          });
          const reqs = await getUserJoinRequests(userEmail);
          setMyRequests(reqs);
          setJoinFormData({ c: null, firstName: '', lastName: '', message: '' });
          alert('¡Solicitud enviada! Espera a que el administrador te apruebe.');
      } catch (err) {
          alert('Error al enviar la solicitud.');
      } finally {
          setLoading(false);
      }
  };

  if (!isAuthenticated) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-5xl flex flex-col md:flex-row h-auto md:h-[600px] border border-slate-100">
                <div className="md:w-1/2 bg-slate-900 text-white p-10 md:p-12 flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-10">
                            <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-900/50"><Building2 className="w-8 h-8"/></div>
                            <span className="text-2xl font-bold tracking-tight">ConsorcioSimple</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-6">Gestión inteligente para comunidades modernas.</h1>
                        <p className="text-slate-400 text-lg leading-relaxed">Administra expensas, reservas, reclamos y comunicación en un solo lugar.</p>
                    </div>
                    <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 translate-y-1/2 -translate-x-1/4"></div>
                </div>
                <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white relative z-10">
                    <div className="w-full max-w-sm mx-auto">
                        <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">{mode === 'LOGIN' ? 'Bienvenido de nuevo' : 'Crear Cuenta'}</h2>
                        <p className="text-slate-500 mb-8 font-medium">{mode === 'LOGIN' ? 'Ingresa tus credenciales para continuar' : 'Comienza a gestionar tu consorcio hoy'}</p>
                        {error && <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center text-red-600 text-sm font-medium animate-in fade-in"><AlertCircle className="w-5 h-5 mr-3 flex-shrink-0"/> {error}</div>}
                        <form onSubmit={handleAuth} className="space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Correo Electrónico</label>
                                <input type="email" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium text-slate-800" placeholder="nombre@correo.com" value={email} onChange={e => setEmail(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Contraseña</label>
                                <input type="password" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium text-slate-800" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
                            </div>
                            <button type="submit" disabled={loading} className="w-full py-3.5 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all flex justify-center items-center shadow-lg shadow-indigo-200 disabled:opacity-70">
                                {loading ? <Loader2 className="animate-spin w-5 h-5"/> : (mode === 'LOGIN' ? 'Ingresar a mi cuenta' : 'Registrarme')}
                            </button>
                        </form>
                        <div className="mt-8 text-center pt-6 border-t border-slate-100">
                            <p className="text-sm text-slate-600 font-medium">
                                {mode === 'LOGIN' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
                                <button onClick={() => { setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN'); setError(''); }} className="ml-2 text-indigo-600 font-bold hover:text-indigo-800 transition-colors">
                                    {mode === 'LOGIN' ? 'Regístrate aquí' : 'Inicia Sesión'}
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                  <h1 className="text-3xl font-black text-slate-800 tracking-tight">Panel de Acceso</h1>
                  <p className="text-slate-500 font-medium mt-1">
                      {consortiums.length > 0 ? 'Selecciona una propiedad para gestionar' : 'Bienvenido a ConsorcioSimple'}
                  </p>
              </div>
              <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm">
                          {userEmail.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-bold text-slate-700 hidden sm:block">{userEmail}</span>
                  </div>
                  <div className="w-px h-6 bg-slate-200 mx-2"></div>
                  <button onClick={onLogout} className="text-slate-400 hover:text-red-500 transition-colors flex items-center gap-2 text-sm font-bold" title="Cerrar Sesión">
                      <LogOut className="w-4 h-4"/> <span className="hidden sm:block">Salir</span>
                  </button>
              </div>
          </div>

          {consortiums.length === 0 ? (
              // VISTA PARA USUARIOS SIN CONSORCIOS (BUSCAR Y UNIRSE)
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-3xl mx-auto">
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Unirse a un Consorcio</h2>
                  <p className="text-slate-500 mb-6">Busca tu edificio en la lista y solicita acceso al administrador para ver tus expensas y novedades.</p>
                  
                  <div className="relative mb-6">
                      <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                      <input 
                          type="text" 
                          placeholder="Buscar por nombre o dirección..." 
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                      />
                  </div>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {allConsortiums
                          .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase())))
                          .map(c => {
                          const req = myRequests.find(r => r.consortiumId === c.id);
                          return (
                              <div key={c.id} className="flex justify-between items-center p-4 border border-slate-100 rounded-xl hover:border-indigo-200 transition-colors">
                                 <div>
                                    <p className="font-bold text-slate-800">{c.name}</p>
                                    <p className="text-sm text-slate-500">{c.address || 'Sin dirección'}</p>
                                 </div>
                                 {req ? (
                                     <span className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-bold flex items-center gap-2">
                                         <Loader2 className="w-4 h-4 animate-spin"/> Pendiente
                                     </span>
                                 ) : (
                                     <button onClick={() => setJoinFormData({ c, firstName: '', lastName: '', message: '' })} disabled={loading} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition-colors shadow">
                                         Solicitar Acceso
                                     </button>
                                 )}
                              </div>
                          )
                      })}
                      {allConsortiums.length === 0 && <p className="text-center text-slate-400 py-6">No hay consorcios disponibles.</p>}
                  </div>

                  <div className="pt-8 mt-8 border-t border-slate-100 text-center">
                      <p className="text-sm text-slate-500 mb-4 font-medium">¿Eres Administrador y quieres registrar un edificio nuevo?</p>
                      <button onClick={() => setIsCreatingConsortium(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-xl font-bold transition-all shadow flex items-center justify-center gap-2 mx-auto">
                          <PlusCircle className="w-5 h-5"/> Crear Mi Primer Consorcio
                      </button>
                  </div>
              </div>
          ) : (
              // VISTA PARA ADMINISTRADORES QUE MANEJAN MÚLTIPLES CONSORCIOS
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {consortiums.map(c => (
                      <button 
                          key={c.id} 
                          onClick={() => onSelectConsortium(c)}
                          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-indigo-500 transition-all duration-300 group text-left relative overflow-hidden flex flex-col h-full"
                      >
                          <div className="absolute top-0 right-0 p-5 opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                              <ArrowRight className="w-6 h-6 text-indigo-500"/>
                          </div>
                          <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-indigo-50 group-hover:scale-110 transition-all duration-300">
                              <Building2 className="w-6 h-6 text-slate-400 group-hover:text-indigo-600"/>
                          </div>
                          <div className="flex-1">
                              <h3 className="font-black text-xl text-slate-800 mb-2 group-hover:text-indigo-900 transition-colors line-clamp-2">{c.name}</h3>
                              <p className="text-sm text-slate-500 font-medium truncate">{c.address || 'Sin dirección registrada'}</p>
                          </div>
                          <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ingresar al Panel</span>
                          </div>
                      </button>
                  ))}

                  <button 
                      onClick={() => setIsCreatingConsortium(true)}
                      className="bg-slate-50/50 p-6 rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all duration-300 flex flex-col items-center justify-center text-center min-h-[220px] group"
                  >
                      <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <PlusCircle className="w-6 h-6 text-slate-400 group-hover:text-indigo-500"/>
                      </div>
                      <span className="font-bold text-slate-600 group-hover:text-indigo-700">Agregar Consorcio</span>
                  </button>
              </div>
          )}
      </div>

      {/* Modal Completar Datos de Solicitud */}
      {joinFormData.c && (
          <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                      <div>
                          <h3 className="text-xl font-black text-slate-800">Solicitar Acceso</h3>
                          <p className="text-sm text-slate-500 mt-1 font-medium">{joinFormData.c.name}</p>
                      </div>
                      <button onClick={() => setJoinFormData({ c: null, firstName: '', lastName: '', message: '' })} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500"/></button>
                  </div>
                  
                  <form onSubmit={handleConfirmJoin} className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1.5">Nombre</label>
                              <input required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800" placeholder="Ej: Juan" value={joinFormData.firstName} onChange={e => setJoinFormData({...joinFormData, firstName: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1.5">Apellido</label>
                              <input required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800" placeholder="Ej: Pérez" value={joinFormData.lastName} onChange={e => setJoinFormData({...joinFormData, lastName: e.target.value})} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">Mensaje al Administrador (Opcional)</label>
                          <textarea 
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-800" 
                              placeholder="Ej: Hola, soy inquilino del depto 4B." 
                              rows={3} 
                              value={joinFormData.message} 
                              onChange={e => setJoinFormData({...joinFormData, message: e.target.value})} 
                          />
                      </div>
                      <div className="pt-4 mt-2 border-t border-slate-100">
                          <button type="submit" disabled={loading} className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md flex justify-center items-center">
                              {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Enviar Solicitud'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Modal Crear Consorcio */}
      {isCreatingConsortium && (
          <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-slate-100 bg-slate-50">
                      <h3 className="text-xl font-black text-slate-800">Registrar Edificio</h3>
                      <p className="text-sm text-slate-500 mt-1">Completa los datos para crear el entorno.</p>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">Nombre del Consorcio *</label>
                          <input 
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors font-medium text-slate-800" 
                              placeholder="Ej: Edificio Libertador 123" 
                              autoFocus 
                              value={newConsortium.name} 
                              onChange={e => setNewConsortium({...newConsortium, name: e.target.value})} 
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">Dirección Física</label>
                          <input 
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors font-medium text-slate-800" 
                              placeholder="Calle y Altura" 
                              value={newConsortium.address} 
                              onChange={e => setNewConsortium({...newConsortium, address: e.target.value})} 
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">CUIT (Opcional)</label>
                          <input 
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors font-medium text-slate-800" 
                              placeholder="XX-XXXXXXXX-X" 
                              value={newConsortium.cuit} 
                              onChange={e => setNewConsortium({...newConsortium, cuit: e.target.value})} 
                          />
                      </div>
                      
                      <div className="flex gap-3 pt-4 mt-2 border-t border-slate-100">
                          <button 
                              onClick={() => setIsCreatingConsortium(false)} 
                              className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                          >
                              Cancelar
                          </button>
                          <button 
                              onClick={handleCreate} 
                              disabled={!newConsortium.name}
                              className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-colors"
                          >
                              Crear Entorno
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AuthView;