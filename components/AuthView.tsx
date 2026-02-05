import React, { useState } from 'react';
import { Consortium, UserRole } from '../types';
import { Building2, ArrowRight, LogOut, PlusCircle, LogIn, AlertCircle, Loader2, UserPlus } from 'lucide-react';
import { auth } from '../src/config/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

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
      setError(mode === 'LOGIN' ? 'Credenciales incorrectas.' : 'Error al registrarse: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
      if(!newConsortium.name) return;
      if (auth.currentUser) {
          onCreateConsortium({ 
              id: '', 
              name: newConsortium.name, 
              address: newConsortium.address, 
              cuit: newConsortium.cuit 
          }, auth.currentUser.uid);
          setIsCreatingConsortium(false);
      }
  };

  // --- VISTA 1: LOGIN / REGISTRO ---
  if (!isAuthenticated) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden w-full max-w-5xl flex flex-col md:flex-row h-[600px]">
                
                {/* Brand Section */}
                <div className="md:w-1/2 bg-slate-900 text-white p-12 flex flex-col justify-between relative">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2 bg-indigo-600 rounded-lg"><Building2 className="w-8 h-8"/></div>
                            <span className="text-2xl font-bold tracking-tight">ConsorcioSimple</span>
                        </div>
                        <h1 className="text-4xl font-extrabold leading-tight mb-6">
                            Gestión inteligente para comunidades modernas.
                        </h1>
                        <p className="text-slate-400 text-lg">
                            Administra expensas, reservas, reclamos y comunicación en un solo lugar.
                        </p>
                    </div>
                    <div className="text-xs text-slate-500 relative z-10">
                        © 2024 Plataforma de Gestión
                    </div>
                    {/* Abstract Shapes */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 translate-y-1/2 -translate-x-1/2"></div>
                </div>

                {/* Form Section */}
                <div className="md:w-1/2 p-12 flex flex-col justify-center">
                    <div className="w-full max-w-sm mx-auto">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">
                            {mode === 'LOGIN' ? 'Iniciar Sesión' : 'Crear Cuenta'}
                        </h2>
                        <p className="text-slate-500 mb-8">
                            {mode === 'LOGIN' ? 'Accede a tu panel de control' : 'Comienza gratis hoy mismo'}
                        </p>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center text-red-600 text-sm animate-pulse">
                                <AlertCircle className="w-4 h-4 mr-2"/> {error}
                            </div>
                        )}

                        <form onSubmit={handleAuth} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
                                <input type="email" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="nombre@empresa.com" value={email} onChange={e => setEmail(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                                <input type="password" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
                            </div>
                            <button type="submit" disabled={loading} className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all flex justify-center items-center shadow-lg shadow-slate-200">
                                {loading ? <Loader2 className="animate-spin w-5 h-5"/> : (mode === 'LOGIN' ? 'Ingresar' : 'Registrarse')}
                            </button>
                        </form>

                        <div className="mt-6 text-center pt-6 border-t border-slate-100">
                            <p className="text-sm text-slate-500">
                                {mode === 'LOGIN' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
                                <button onClick={() => setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN')} className="ml-2 text-indigo-600 font-bold hover:underline">
                                    {mode === 'LOGIN' ? 'Regístrate' : 'Inicia Sesión'}
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  // --- VISTA 2: SELECCIÓN DE CONSORCIO ---
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
          <div className="flex justify-between items-center mb-6">
              <div>
                  <h1 className="text-2xl font-bold text-slate-800">Mis Consorcios</h1>
                  <p className="text-slate-500 text-sm">Selecciona una propiedad para gestionar</p>
              </div>
              <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-500 hidden md:block">{userEmail}</span>
                  <button onClick={onLogout} className="text-slate-400 hover:text-red-500 transition-colors" title="Salir">
                      <LogOut className="w-5 h-5"/>
                  </button>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Tarjetas de Consorcios */}
              {consortiums.map(c => (
                  <button 
                      key={c.id} 
                      onClick={() => onSelectConsortium(c)}
                      className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-500 transition-all group text-left relative overflow-hidden"
                  >
                      <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowRight className="w-5 h-5 text-indigo-500"/>
                      </div>
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-50 transition-colors">
                          <Building2 className="w-6 h-6 text-slate-600 group-hover:text-indigo-600"/>
                      </div>
                      <h3 className="font-bold text-lg text-slate-800 mb-1 truncate">{c.name}</h3>
                      <p className="text-sm text-slate-500 truncate">{c.address || 'Sin dirección'}</p>
                  </button>
              ))}

              {/* Botón Crear Nuevo */}
              <button 
                  onClick={() => setIsCreatingConsortium(true)}
                  className="bg-slate-100 p-6 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center text-center min-h-[160px]"
              >
                  <PlusCircle className="w-8 h-8 text-slate-400 mb-2"/>
                  <span className="font-bold text-slate-600">Crear Nuevo Consorcio</span>
              </button>
          </div>
      </div>

      {/* Modal Crear Consorcio */}
      {isCreatingConsortium && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                  <h3 className="text-xl font-bold text-slate-800 mb-4">Nuevo Edificio</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Consorcio</label>
                          <input className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ej: Edificio Alvear" autoFocus value={newConsortium.name} onChange={e => setNewConsortium({...newConsortium, name: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                          <input className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Calle y Altura" value={newConsortium.address} onChange={e => setNewConsortium({...newConsortium, address: e.target.value})} />
                      </div>
                      <div className="flex gap-3 pt-2">
                          <button onClick={() => setIsCreatingConsortium(false)} className="flex-1 py-2 text-slate-500 font-medium hover:bg-slate-100 rounded-lg">Cancelar</button>
                          <button onClick={handleCreate} className="flex-1 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800">Crear</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AuthView;