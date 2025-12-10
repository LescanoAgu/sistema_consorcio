import React, { useState } from 'react';
import { Consortium, UserRole } from '../types';
import { Building2, ArrowRight, LogOut, ShieldCheck, User, PlusCircle, UserPlus, LogIn, AlertCircle, Loader2 } from 'lucide-react';
// ✅ IMPORTANTE: Importamos la autenticación real de Firebase
import { auth } from '../src/config/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

interface AuthViewProps {
  isAuthenticated: boolean;
  onLoginSuccess: (email: string, role: UserRole) => void;
  onSelectConsortium: (consortium: Consortium) => void;
  consortiums: Consortium[];
  onCreateConsortium: (c: Consortium) => void;
  onLogout: () => void;
  userRole: UserRole;
  userEmail: string;
}

const AuthView: React.FC<AuthViewProps> = ({ isAuthenticated, onLoginSuccess, onSelectConsortium, consortiums, onCreateConsortium, onLogout, userRole, userEmail }) => {
  // Login States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Registration State
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState(''); // (Nota: Firebase Auth básico usa solo email/pass, el nombre lo guardaremos local por ahora)
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('ADMIN'); // Por defecto ADMIN para crear el primer consorcio
  const [regPassword, setRegPassword] = useState('');

  // Create Consortium State
  const [isCreating, setIsCreating] = useState(false);
  const [newConsortium, setNewConsortium] = useState<Partial<Consortium>>({ name: '', address: '', cuit: '' });

  const step = isAuthenticated ? 'select' : 'login';

  // --- LÓGICA DE AUTENTICACIÓN REAL ---

  const handleRealLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Si pasa, notificamos a la App (Asumimos ADMIN si entra por login directo para simplificar, o podrías guardar el rol en BD)
      onLoginSuccess(email, 'ADMIN'); 
    } catch (err: any) {
      console.error(err);
      setError('Error al iniciar sesión: Verifique sus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  const handleRealRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await createUserWithEmailAndPassword(auth, regEmail, regPassword);
      // Al registrarse, usamos el rol que seleccionó en el formulario
      onLoginSuccess(regEmail, regRole);
      alert("¡Cuenta creada con éxito! Ahora puedes crear tu primer consorcio.");
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este correo ya está registrado.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else {
        setError('Error al registrarse. Intente nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRealLogout = async () => {
    await signOut(auth);
    onLogout();
  };

  // --- LÓGICA DE CREACIÓN ---

  const handleCreate = () => {
      if(newConsortium.name && newConsortium.address) {
          onCreateConsortium({
              id: crypto.randomUUID(),
              name: newConsortium.name,
              address: newConsortium.address,
              cuit: newConsortium.cuit || '',
              image: ''
          });
          setIsCreating(false);
          setNewConsortium({ name: '', address: '', cuit: '' });
      }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        
        {step === 'login' && (
           <div className="p-8">
              <div className="text-center mb-8">
                  <div className="inline-block p-3 bg-indigo-600 rounded-xl mb-4">
                      <Building2 className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-slate-800">Gestión Consorcio</h1>
                  <p className="text-slate-500">
                      {isRegistering ? 'Crear Cuenta (Admin)' : 'Bienvenido al Sistema'}
                  </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2"/>
                  {error}
                </div>
              )}

              {!isRegistering ? (
                <>
                  <form onSubmit={handleRealLogin} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email</label>
                        <input 
                            type="email" 
                            autoComplete="username" // <--- AGREGAR ESTO
                            className="..."
                            placeholder="nombre@ejemplo.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                              required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Contraseña</label>
                        <input 
                            type="password" 
                            autoComplete="current-password" // <--- AGREGAR ESTO
                            className="..."
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                      </div>
                      
                      <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-indigo-200 flex justify-center items-center"
                      >
                          {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Iniciar Sesión'}
                      </button>
                  </form>

                  <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                      <p className="text-sm text-slate-500 mb-3">¿Es tu primera vez aquí?</p>
                      <button 
                        onClick={() => setIsRegistering(true)}
                        className="w-full py-2 text-indigo-600 text-sm font-medium hover:bg-indigo-50 rounded-lg transition-colors flex items-center justify-center border border-indigo-100"
                      >
                         <UserPlus className="w-4 h-4 mr-2" /> Registrarse como Administrador
                      </button>
                  </div>
                </>
              ) : (
                <form onSubmit={handleRealRegistration} className="space-y-4 animate-fade-in">
                    <div className="p-3 bg-indigo-50 text-indigo-800 text-xs rounded-lg mb-2">
                        💡 Como es una instalación nueva, la primera cuenta que crees tendrá permisos para crear consorcios.
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                        <input 
                            required
                            type="text" 
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Ej: Juan Perez"
                            value={regName}
                            onChange={e => setRegName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input 
                            required
                            type="email" 
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="admin@consorcio.com"
                            value={regEmail}
                            onChange={e => setRegEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                        <input 
                            required
                            type="password" 
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Mínimo 6 caracteres"
                            value={regPassword}
                            onChange={e => setRegPassword(e.target.value)}
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md transition-colors mt-4 flex justify-center"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Crear Cuenta e Ingresar'}
                    </button>
                    
                    <button 
                        type="button" 
                        onClick={() => setIsRegistering(false)}
                        className="w-full py-2 text-slate-500 hover:text-slate-700 text-sm font-medium flex items-center justify-center mt-2"
                    >
                        <LogIn className="w-4 h-4 mr-2" /> Volver al Login
                    </button>
                </form>
              )}
           </div>
        )}

        {step === 'select' && (
            <div className="p-8 relative h-full flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Seleccione Consorcio</h2>
                    <button onClick={handleRealLogout} className="text-slate-400 hover:text-red-500 flex items-center gap-1 text-sm font-medium" title="Cerrar Sesión">
                        Salir <LogOut className="w-4 h-4" />
                    </button>
                </div>
                
                {!isCreating ? (
                    <div className="space-y-3 overflow-y-auto max-h-[400px]">
                        {consortiums.length === 0 && (
                            <div className="text-center py-8 text-slate-400">
                                <Building2 className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                <p>No hay consorcios creados aún.</p>
                            </div>
                        )}

                        {consortiums.map(c => (
                            <button 
                                key={c.id}
                                onClick={() => onSelectConsortium(c)}
                                className="w-full group bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl p-4 text-left transition-all flex items-center justify-between"
                            >
                                <div>
                                    <h3 className="font-bold text-slate-800 group-hover:text-indigo-700">{c.name}</h3>
                                    <p className="text-xs text-slate-500">{c.address}</p>
                                    {c.cuit && <p className="text-[10px] text-slate-400 mt-1">CUIT: {c.cuit}</p>}
                                </div>
                                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transform group-hover:translate-x-1 transition-all" />
                            </button>
                        ))}
                        
                        {(userRole === 'ADMIN' || userRole === 'DEV') && (
                            <button 
                                onClick={() => setIsCreating(true)}
                                className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-4 flex items-center justify-center text-slate-500 hover:text-indigo-500 transition-colors mt-4"
                            >
                                <PlusCircle className="w-5 h-5 mr-2" />
                                Crear Nuevo Consorcio
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 animate-fade-in">
                        <h3 className="font-bold text-slate-700 mb-3">Nuevo Edificio</h3>
                        <div className="space-y-3">
                            <input 
                                type="text" 
                                placeholder="Nombre del Consorcio"
                                className="w-full p-2 border rounded text-sm"
                                value={newConsortium.name}
                                onChange={e => setNewConsortium({...newConsortium, name: e.target.value})}
                            />
                            <input 
                                type="text" 
                                placeholder="Dirección Completa"
                                className="w-full p-2 border rounded text-sm"
                                value={newConsortium.address}
                                onChange={e => setNewConsortium({...newConsortium, address: e.target.value})}
                            />
                            <input 
                                type="text" 
                                placeholder="CUIT (Opcional)"
                                className="w-full p-2 border rounded text-sm"
                                value={newConsortium.cuit}
                                onChange={e => setNewConsortium({...newConsortium, cuit: e.target.value})}
                            />
                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setIsCreating(false)} className="flex-1 py-2 text-slate-500 hover:bg-slate-200 rounded text-sm">Cancelar</button>
                                <button onClick={handleCreate} className="flex-1 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">Guardar</button>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="mt-auto border-t border-slate-100 pt-4 text-center">
                    <p className="text-xs text-slate-400">Conectado como: {userEmail}</p>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default AuthView;