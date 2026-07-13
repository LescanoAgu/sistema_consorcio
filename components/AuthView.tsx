import React, { useState, useEffect } from 'react';
import { Consortium, UserRole, JoinRequest } from '../types';
import { Building2, ArrowRight, LogOut, PlusCircle, AlertCircle, Loader2, UserPlus, Info, Search, X, CheckCircle2 } from 'lucide-react';
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

const AuthView: React.FC<AuthViewProps> = ({ 
  isAuthenticated, 
  onSelectConsortium, 
  consortiums, 
  onCreateConsortium, 
  onLogout, 
  userEmail 
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  
  const [isCreatingConsortium, setIsCreatingConsortium] = useState(false);
  const [newConsortium, setNewConsortium] = useState({ name: '', address: '', cuit: '' });

  // Estados para el flujo de Coposesores / Vecinos
  const [allConsortiums, setAllConsortiums] = useState<Consortium[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para el Modal de Solicitud de Ingreso
  const [joinModal, setJoinModal] = useState<{isOpen: boolean, consortiumId: string, consortiumName: string} | null>(null);
  const [joinForm, setJoinForm] = useState({ firstName: '', lastName: '', message: '' });

  const closeJoinModal = () => {
      setJoinModal(null);
      setJoinForm({ firstName: '', lastName: '', message: '' });
  };

  // Cargar lista global de consorcios y solicitudes del usuario cuando se autentica
  useEffect(() => {
    if (isAuthenticated && userEmail) {
      const loadConsortiumData = async () => {
        try {
          const all = await getAllConsortiums();
          setAllConsortiums(all);
          const requests = await getUserJoinRequests(userEmail);
          setJoinRequests(requests);
        } catch (err) {
          console.error("Error al cargar información de consorcios públicos:", err);
        }
      };
      loadConsortiumData();
    }
  }, [isAuthenticated, userEmail]);

  // Manejador del Formulario de Autenticación
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Por favor, completa todos los campos obligatorios.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      if (mode === 'LOGIN') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err: any) {
      console.error("Error de autenticación:", err);
      switch (err.code) {
        case 'auth/invalid-email': setError('El correo electrónico no tiene un formato válido.'); break;
        case 'auth/user-disabled': setError('Esta cuenta ha sido deshabilitada temporalmente.'); break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential': setError('El correo electrónico o la contraseña son incorrectos.'); break;
        case 'auth/email-already-in-use': setError('Este correo electrónico ya se encuentra registrado.'); break;
        case 'auth/weak-password': setError('La contraseña es muy débil. Debe tener al menos 6 caracteres.'); break;
        default: setError('Ocurrió un inconveniente al procesar la solicitud. Inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Manejador para la creación de un nuevo Consorcio (Flujo Admin SaaS)
  const handleCreate = async () => {
    if (!newConsortium.name.trim()) return;
    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await onCreateConsortium(newConsortium as Consortium, currentUser.uid);
        setIsCreatingConsortium(false);
        setNewConsortium({ name: '', address: '', cuit: '' });
      }
    } catch (err) {
      setError('No se pudo crear el consorcio. Verifica las restricciones de tu plan.');
    } finally {
      setLoading(false);
    }
  };

  // Manejador para enviar la solicitud con los datos completos del vecino
  const handleSendJoinRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinModal || !joinForm.firstName.trim() || !joinForm.lastName.trim()) return;

    if (joinRequests.some(r => r.consortiumId === joinModal.consortiumId && r.status === 'PENDING')) {
      alert("Ya posees una solicitud de acceso pendiente para este consorcio.");
      closeJoinModal();
      return;
    }

    try {
      setLoading(true);
      const requestData = {
        consortiumId: joinModal.consortiumId,
        consortiumName: joinModal.consortiumName,
        userEmail,
        firstName: joinForm.firstName.trim(),
        lastName: joinForm.lastName.trim(),
        message: joinForm.message.trim(),
        status: 'PENDING' as const,
        date: new Date().toISOString()
      };
      await createJoinRequest(requestData);
      const updatedRequests = await getUserJoinRequests(userEmail);
      setJoinRequests(updatedRequests);
      alert("¡Solicitud enviada! El administrador del consorcio recibirá tu aviso.");
      setJoinModal(null);
      setJoinForm({ firstName: '', lastName: '', message: '' });
    } catch (err) {
      alert("Ocurrió un error al enviar la solicitud de ingreso.");
    } finally {
      setLoading(false);
    }
  };

  const filteredConsortiums = allConsortiums.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.cuit && c.cuit.includes(searchTerm))
  );

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 antialiased font-sans">
      
      {!isAuthenticated ? (
        /* ================= PANTALLA DE LOGIN / REGISTRO ================= */
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden p-8 border border-slate-100 transition-all">
          <div className="flex flex-col items-center mb-8">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl mb-4">
              <Building2 className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Sistema de Gestión del Consorcio</h1>
            <p className="text-slate-500 text-sm mt-1 text-center">
              {mode === 'LOGIN' ? 'Ingresa tus credenciales para administrar o ver tus expensas' : 'Crea una cuenta para comenzar a operar'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Correo Electrónico</label>
              <input 
                type="email" 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Contraseña</label>
              <input 
                type="password" 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <span>{mode === 'LOGIN' ? 'Iniciar Sesión' : 'Registrar Cuenta'}</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <button 
              onClick={() => setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN')}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-semibold transition-colors"
              disabled={loading}
            >
              {mode === 'LOGIN' ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya posees una cuenta? Inicia sesión'}
            </button>
          </div>
        </div>
      ) : (
        /* ================= PANTALLA DE SELECCIÓN DE ENTORNO / CONSORCIO ================= */
        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl p-6 md:p-8 border border-slate-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 mb-8 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest block mb-0.5">Sesión Activa</span>
              <h2 className="text-xl font-bold text-slate-800 truncate max-w-md">{userEmail}</h2>
            </div>
            <button 
              onClick={onLogout} 
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-rose-600 font-bold px-4 py-2 hover:bg-rose-50 rounded-xl transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Columna Izquierda: Consorcios Vinculados */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-slate-800 text-lg">Tus Consorcios</h3>
                <button 
                  onClick={() => setIsCreatingConsortium(true)}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold px-2.5 py-1.5 hover:bg-indigo-50 rounded-lg transition-all"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Nuevo (Admin)</span>
                </button>
              </div>

              {consortiums.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center text-center">
                  <Info className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-sm text-slate-500 font-medium">Aún no estás vinculado a ningún consorcio activo.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                  {consortiums.map((c) => (
                    <div 
                      key={c.id}
                      onClick={() => onSelectConsortium(c)}
                      className="group p-4 bg-slate-50 hover:bg-indigo-600 border border-slate-100 rounded-xl cursor-pointer flex justify-between items-center transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                    >
                      <div>
                        <h4 className="font-bold text-slate-800 group-hover:text-white transition-colors">{c.name}</h4>
                        <p className="text-xs text-slate-500 group-hover:text-indigo-200 transition-colors mt-0.5">{c.address || 'Sin dirección registrada'}</p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </div>
                  ))}
                </div>
              )}

              {/* Historial de solicitudes enviadas por el Vecino */}
              {joinRequests.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-bold text-slate-700 text-sm mb-3">Tus Solicitudes de Ingreso</h4>
                  <div className="space-y-2">
                    {joinRequests.map((req) => (
                      <div key={req.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                        <span className="font-semibold text-slate-700">{req.consortiumName}</span>
                        <span className={`px-2.5 py-1 rounded-full font-bold ${
                          req.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                          req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          'bg-rose-50 text-rose-600 border border-rose-100'
                        }`}>
                          {req.status === 'PENDING' ? 'Pendiente' : req.status === 'APPROVED' ? 'Aprobada' : 'Rechazada'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Columna Derecha: Buscador Global (Vecinos / Coposesores) */}
            <div className="border-t lg:border-t-0 lg:border-l border-slate-100 pt-6 lg:pt-0 lg:pl-8">
              <h3 className="font-black text-slate-800 text-lg mb-4">¿Eres Inquilino o Propietario?</h3>
              <p className="text-xs text-slate-500 mb-4 font-medium leading-relaxed">
                Busca el consorcio de tu edificio o barrio por su nombre o CUIT para solicitar el acceso a tus resúmenes de expensas.
              </p>

              <div className="relative mb-4">
                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
                <input 
                  type="text"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium text-slate-800"
                  placeholder="Buscar por Nombre o CUIT del Consorcio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {searchTerm.trim().length > 0 && (
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                  {filteredConsortiums.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-4 font-medium">No se hallaron consorcios bajo ese término.</p>
                  ) : (
                    filteredConsortiums.map((c) => {
                      const isLinked = consortiums.some(myC => myC.id === c.id);
                      const hasPending = joinRequests.some(r => r.consortiumId === c.id && r.status === 'PENDING');

                      return (
                        <div key={c.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                          <div className="max-w-[70%]">
                            <h5 className="font-bold text-xs text-slate-800 truncate">{c.name}</h5>
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">CUIT: {c.cuit || 'No informado'}</p>
                          </div>
                          {isLinked ? (
                            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Vinculado
                            </span>
                          ) : hasPending ? (
                            <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-lg">
                              En Revisión
                            </span>
                          ) : (
                            <button 
                              onClick={() => setJoinModal({isOpen: true, consortiumId: c.id, consortiumName: c.name})}
                              className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                              disabled={loading}
                            >
                              <UserPlus className="w-3 h-3" /> Unirse
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: SOLICITUD DE INGRESO (VECINO) ================= */}
      {joinModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden p-6 border border-slate-100">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
              <h3 className="font-black text-slate-800 text-lg">Solicitar Acceso</h3>
              <button onClick={closeJoinModal} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-slate-500 mb-4">Ingresa tus datos para que el administrador de <strong>{joinModal.consortiumName}</strong> pueda verificar tu identidad y asignarte a tu unidad.</p>

            <form onSubmit={handleSendJoinRequest} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Nombre *</label>
                  <input type="text" required value={joinForm.firstName} onChange={e => setJoinForm({...joinForm, firstName: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm" placeholder="Juan"/>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Apellido *</label>
                  <input type="text" required value={joinForm.lastName} onChange={e => setJoinForm({...joinForm, lastName: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm" placeholder="Pérez"/>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Unidad / Mensaje Adicional</label>
                <textarea value={joinForm.message} onChange={e => setJoinForm({...joinForm, message: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm resize-none h-24" placeholder="Ej: Soy el propietario del Dpto 4B..."></textarea>
              </div>

              <div className="flex gap-3 pt-4 mt-2 border-t border-slate-100">
                <button type="button" onClick={closeJoinModal} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors" disabled={loading}>
                  Cancelar
                </button>
                <button type="submit" disabled={!joinForm.firstName.trim() || !joinForm.lastName.trim() || loading} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-colors flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar Solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREACIÓN DE NUEVO CONSORCIO (ADMIN) ================= */}
      {isCreatingConsortium && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden p-6 border border-slate-100">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
              <h3 className="font-black text-slate-800 text-lg">Registrar Nuevo Consorcio</h3>
              <button 
                onClick={() => setIsCreatingConsortium(false)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Nombre del Consorcio *</label>
                <input 
                  type="text" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors font-medium text-slate-800"
                  placeholder="Edificio San Martín I"
                  value={newConsortium.name}
                  onChange={e => setNewConsortium({...newConsortium, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Dirección Completa</label>
                <input 
                  type="text" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors font-medium text-slate-800"
                  placeholder="Av. San Martín 1234, Mendoza"
                  value={newConsortium.address}
                  onChange={e => setNewConsortium({...newConsortium, address: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">CUIT Comercial</label>
                <input 
                  type="text" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors font-medium text-slate-800"
                  placeholder="30-71234567-9"
                  value={newConsortium.cuit}
                  onChange={e => setNewConsortium({...newConsortium, cuit: e.target.value})}
                />
              </div>
              
              <div className="flex gap-3 pt-4 mt-2 border-t border-slate-100">
                <button 
                  onClick={() => setIsCreatingConsortium(false)} 
                  className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleCreate} 
                  disabled={!newConsortium.name.trim() || loading}
                  className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear Entorno'}
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