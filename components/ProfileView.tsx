import React, { useState } from 'react';
import { UserRole } from '../types';
import { User, Lock, Mail, Shield, Save, LogOut } from 'lucide-react';
import { auth } from '../src/config/firebase';
import { updatePassword, updateProfile } from 'firebase/auth';

interface ProfileViewProps {
  userEmail: string;
  userRole: UserRole;
  onLogout: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ userEmail, userRole, onLogout }) => {
  const [newName, setNewName] = useState(auth.currentUser?.displayName || '');
  const [newPassword, setNewPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const handleUpdateProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      setMsg('');
      
      try {
          const promises = [];
          const user = auth.currentUser;
          
          if (user && newName !== user.displayName) {
              promises.push(updateProfile(user, { displayName: newName }));
          }
          if (user && newPassword) {
              promises.push(updatePassword(user, newPassword));
          }

          if (promises.length > 0) {
              await Promise.all(promises);
              setMsg('¡Perfil actualizado correctamente!');
              setNewPassword(''); // Limpiar campo pass
          } else {
              setMsg('No hubo cambios para guardar.');
          }
      } catch (error: any) {
          console.error(error);
          setMsg('Error: ' + (error.message === 'CREDENTIAL_TOO_OLD_LOGIN_AGAIN' ? 'Debes volver a iniciar sesión para cambiar la contraseña.' : 'No se pudo actualizar.'));
      } finally {
          setIsSaving(false);
      }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <User className="w-6 h-6 text-indigo-600"/> Mi Perfil
      </h2>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 p-6 border-b border-slate-200 flex items-center gap-4">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-2xl">
                  {(newName || userEmail || 'U')[0].toUpperCase()}
              </div>
              <div>
                  <h3 className="text-lg font-bold text-slate-800">{newName || 'Usuario Sin Nombre'}</h3>
                  <div className="flex gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-600 font-medium flex items-center gap-1">
                          <Mail className="w-3 h-3"/> {userEmail}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold flex items-center gap-1">
                          <Shield className="w-3 h-3"/> {userRole}
                      </span>
                  </div>
              </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-6">
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
                      <input 
                        type="text" 
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="Tu nombre"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nueva Contraseña</label>
                      <div className="relative">
                          <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                          <input 
                            type="password" 
                            className="w-full pl-10 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="Dejar en blanco para mantener la actual"
                            minLength={6}
                          />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Mínimo 6 caracteres.</p>
                  </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={onLogout}
                    className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1 px-3 py-2 hover:bg-red-50 rounded-lg transition-colors"
                  >
                      <LogOut className="w-4 h-4"/> Cerrar Sesión
                  </button>

                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow disabled:opacity-50 flex items-center gap-2"
                  >
                      <Save className="w-4 h-4"/> {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
              </div>
              
              {msg && (
                  <div className={`p-3 rounded-lg text-sm text-center ${msg.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {msg}
                  </div>
              )}
          </form>
      </div>
    </div>
  );
};

export default ProfileView;