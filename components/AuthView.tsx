
import React, { useState } from 'react';
import { Consortium, UserRole } from '../types';
import { Building2, ArrowRight, LogOut, ShieldCheck, User, Code, PlusCircle, UserPlus, LogIn } from 'lucide-react';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration State
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('USER');
  const [regPassword, setRegPassword] = useState('');

  const [isCreating, setIsCreating] = useState(false);
  const [newConsortium, setNewConsortium] = useState<Partial<Consortium>>({ name: '', address: '', cuit: '' });

  const step = isAuthenticated ? 'select' : 'login';

  const handleSimulatedLogin = (role: UserRole) => {
    let mockEmail = email;
    if (!mockEmail) {
        if (role === 'DEV') mockEmail = 'dev@sistema.com';
        if (role === 'ADMIN') mockEmail = 'admin@consorcio.com';
        if (role === 'USER') mockEmail = 'propietario@mail.com';
    }
    onLoginSuccess(mockEmail, role);
  };

  const handleRegistration = (e: React.FormEvent) => {
      e.preventDefault();
      if(regName && regEmail && regPassword) {
          alert("Usuario registrado con éxito. Ingresando...");
          onLoginSuccess(regEmail, regRole);
      }
  };

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
                      {isRegistering ? 'Crear una nueva cuenta' : 'Seleccione su perfil de acceso'}
                  </p>
              </div>

              {!isRegistering ? (
                <>
                  {/* Quick Login Buttons for Demo */}
                  <div className="space-y-3">
                     <button onClick={() => handleSimulatedLogin('ADMIN')} className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 hover:border-indigo-500 rounded-xl group transition-all">
                        <div className="flex items-center">
                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg mr-3">
                                <ShieldCheck className="w-5 h-5"/>
                            </div>
                            <div className="text-left">
                                <p className="font-bold text-slate-700">Administrador</p>
                                <p className="text-xs text-slate-400">admin@consorcio.com</p>
                            </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500"/>
                     </button>

                     <button onClick={() => handleSimulatedLogin('USER')} className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 hover:border-emerald-500 rounded-xl group transition-all">
                        <div className="flex items-center">
                            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg mr-3">
                                <User className="w-5 h-5"/>
                            </div>
                            <div className="text-left">
                                <p className="font-bold text-slate-700">Propietario / Inquilino</p>
                                <p className="text-xs text-slate-400">propietario@mail.com</p>
                            </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500"/>
                     </button>

                     <button onClick={() => handleSimulatedLogin('DEV')} className="w-full flex items-center justify-between p-4 bg-slate-900 border border-slate-700 hover:border-purple-500 rounded-xl group transition-all">
                        <div className="flex items-center">
                            <div className="p-2 bg-slate-800 text-purple-400 rounded-lg mr-3">
                                <Code className="w-5 h-5"/>
                            </div>
                            <div className="text-left">
                                <p className="font-bold text-white">Desarrollador</p>
                                <p className="text-xs text-slate-400">Acceso total (Debug)</p>
                            </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-purple-500"/>
                     </button>
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-100">
                      <form onSubmit={(e) => { e.preventDefault(); handleSimulatedLogin('ADMIN'); }} className="opacity-70 hover:opacity-100 transition-opacity">
                          <p className="text-xs font-semibold text-slate-400 mb-2 uppercase">Login Tradicional</p>
                          <input 
                            type="email" 
                            className="w-full p-2 text-sm border rounded mb-2 bg-slate-50 focus:bg-white transition-colors"
                            placeholder="Email..."
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                          />
                           <input 
                            type="password" 
                            className="w-full p-2 text-sm border rounded mb-2 bg-slate-50 focus:bg-white transition-colors"
                            placeholder="Contraseña..."
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                          />
                          <button className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg font-medium transition-colors mb-2">
                              Ingresar
                          </button>
                          <button 
                            type="button"
                            onClick={() => setIsRegistering(true)}
                            className="w-full py-2 text-indigo-600 text-sm font-medium hover:bg-indigo-50 rounded-lg transition-colors flex items-center justify-center"
                          >
                             <UserPlus className="w-4 h-4 mr-2" /> Crear Cuenta Nueva
                          </button>
                      </form>
                  </div>
                </>
              ) : (
                <form onSubmit={handleRegistration} className="space-y-4 animate-fade-in">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
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
                            placeholder="juan@email.com"
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
                            placeholder="••••••••"
                            value={regPassword}
                            onChange={e => setRegPassword(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Usuario</label>
                        <select 
                            className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={regRole}
                            onChange={e => setRegRole(e.target.value as UserRole)}
                        >
                            <option value="ADMIN">Administrador de Consorcio</option>
                            <option value="USER">Propietario / Inquilino</option>
                        </select>
                    </div>
                    
                    <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md transition-colors mt-4">
                        Registrarse e Ingresar
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
                    <button onClick={onLogout} className="text-slate-400 hover:text-red-500" title="Cerrar Sesión">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
                
                {!isCreating ? (
                    <div className="space-y-3 overflow-y-auto max-h-[400px]">
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
                                className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-4 flex items-center justify-center text-slate-500 hover:text-indigo-500 transition-colors"
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
                    <p className="text-xs text-slate-400">Conectado como: {userEmail} ({userRole})</p>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default AuthView;
