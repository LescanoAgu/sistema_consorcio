import React from 'react';
import { LayoutDashboard, Users, Receipt, Calculator, Building2, HandCoins, History, LogOut, ArrowLeftRight, AlertTriangle, UserCheck } from 'lucide-react';
import { ViewState, UserRole } from '../types';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  consortiumName: string;
  onSwitchConsortium: () => void;
  onLogout: () => void;
  userRole: UserRole;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, consortiumName, onSwitchConsortium, onLogout, userRole }) => {
  
  // Define all possible items
  const allItems = [
    // ADMIN & DEV & USER Views
    { id: 'dashboard', label: 'Tablero', icon: LayoutDashboard, roles: ['DEV', 'ADMIN'] },
    { id: 'user_portal', label: 'Mi Unidad', icon: UserCheck, roles: ['USER'] }, // Specific for user
    
    // ADMIN & DEV Views
    { id: 'units', label: 'Unidades', icon: Users, roles: ['DEV', 'ADMIN'] },
    { id: 'debtors', label: 'Deudores', icon: AlertTriangle, roles: ['DEV', 'ADMIN'] },
    { id: 'collections', label: 'Cobros', icon: HandCoins, roles: ['DEV', 'ADMIN'] },
    { id: 'settlement', label: 'Liquidación', icon: Calculator, roles: ['DEV', 'ADMIN'] },
    
    // SHARED Views (Behavior might differ inside)
    { id: 'expenses', label: 'Gastos', icon: Receipt, roles: ['DEV', 'ADMIN', 'USER'] },
    { id: 'history', label: 'Historial', icon: History, roles: ['DEV', 'ADMIN', 'USER'] },
  ];

  const visibleItems = allItems.filter(item => item.roles.includes(userRole));

  return (
    <div className={`w-64 text-white min-h-screen flex flex-col fixed left-0 top-0 shadow-xl z-10 ${userRole === 'DEV' ? 'bg-slate-950' : 'bg-slate-900'}`}>
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-lg ${userRole === 'DEV' ? 'bg-purple-600' : 'bg-indigo-600'}`}>
                <Building2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400 leading-tight">
            Gestión<br/>Consorcio
            </h1>
        </div>
        <p className="text-xs text-slate-400 truncate font-medium bg-slate-800 py-1 px-2 rounded mt-2">
            {consortiumName}
        </p>
        <div className="mt-2 text-[10px] uppercase tracking-wider font-bold text-slate-500">
            Rol: <span className={userRole === 'DEV' ? 'text-purple-400' : userRole === 'ADMIN' ? 'text-indigo-400' : 'text-emerald-400'}>{userRole}</span>
        </div>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <li key={item.id} className="mb-1">
                <button
                  onClick={() => onChangeView(item.id as ViewState)}
                  className={`w-full flex items-center px-6 py-3 transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-600/10 text-indigo-400 border-r-4 border-indigo-500'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white border-r-4 border-transparent'
                  }`}
                >
                  <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-indigo-400' : ''}`} />
                  <span className="font-medium text-sm">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-4 border-t border-slate-800 space-y-2">
        <button 
            onClick={onSwitchConsortium}
            className="w-full flex items-center px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
            <ArrowLeftRight className="w-4 h-4 mr-2" />
            Cambiar Consorcio
        </button>
        <button 
            onClick={onLogout}
            className="w-full flex items-center px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
        >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
        </button>
      </div>
    </div>
  );
};

export default Sidebar;