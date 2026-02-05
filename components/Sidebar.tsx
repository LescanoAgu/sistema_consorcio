import React from 'react';
import { LayoutDashboard, Users, Receipt, Calculator, Building2, HandCoins, History, LogOut, ArrowLeftRight, AlertTriangle, UserCheck, Megaphone, X, Wrench, CalendarCheck } from 'lucide-react';
import { ViewState, UserRole } from '../types';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  consortiumName: string;
  onSwitchConsortium: () => void;
  onLogout: () => void;
  userRole: UserRole;
  isOpen: boolean;
  onClose: () => void;
  badges?: { [key: string]: number };
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, consortiumName, onSwitchConsortium, onLogout, userRole, isOpen, onClose, badges = {} }) => {
  
  const allItems = [
    // ADMIN & DEV & USER Views
    { id: 'dashboard', label: 'Tablero', icon: LayoutDashboard, roles: ['DEV', 'ADMIN'] },
    { id: 'user_portal', label: 'Mi Unidad', icon: UserCheck, roles: ['USER'] },
    
    // ADMIN & DEV Views
    { id: 'announcements', label: 'Novedades', icon: Megaphone, roles: ['DEV', 'ADMIN', 'USER'] },
    { id: 'amenities', label: 'Reservas', icon: CalendarCheck, roles: ['DEV', 'ADMIN', 'USER'] }, // <--- NUEVO
    { id: 'maintenance', label: 'Mantenimiento', icon: Wrench, roles: ['DEV', 'ADMIN', 'USER'] },
    { id: 'units', label: 'Unidades', icon: Users, roles: ['DEV', 'ADMIN'] },
    { id: 'debtors', label: 'Deudores', icon: AlertTriangle, roles: ['DEV', 'ADMIN'] },
    { id: 'collections', label: 'Cobros', icon: HandCoins, roles: ['DEV', 'ADMIN'] },
    { id: 'settlement', label: 'Liquidación', icon: Calculator, roles: ['DEV', 'ADMIN'] },
    
    // SHARED Views
    { id: 'expenses', label: 'Gastos', icon: Receipt, roles: ['DEV', 'ADMIN', 'USER'] },
    { id: 'history', label: 'Historial', icon: History, roles: ['DEV', 'ADMIN', 'USER'] },
    
    // ADMIN only
    { id: 'settings', label: 'Configuración', icon: Building2, roles: ['DEV', 'ADMIN'] },
  ];

  const filteredItems = allItems.filter(item => item.roles.includes(userRole));

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed top-0 left-0 z-50 h-screen w-64 bg-slate-900 text-white flex flex-col transition-transform duration-300 ease-in-out shadow-2xl
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 md:shadow-none
      `}>
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent truncate max-w-[180px]">
              {consortiumName || 'Mi Consorcio'}
            </h1>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{userRole === 'DEV' ? 'Modo Desarrollador' : userRole}</p>
          </div>
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <ul>
            {filteredItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              const badgeCount = badges[item.id] || 0;

              return (
                <li key={item.id} className="mb-1">
                  <button
                    onClick={() => {
                      onChangeView(item.id as ViewState);
                      onClose(); 
                    }}
                    className={`w-full flex items-center justify-between px-6 py-3 transition-all duration-200 ${
                      isActive
                        ? 'bg-indigo-600/10 text-indigo-400 border-r-4 border-indigo-500'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white border-r-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center">
                      <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-indigo-400' : ''}`} />
                      <span className="font-medium text-sm">{item.label}</span>
                    </div>
                    
                    {badgeCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                        {badgeCount}
                      </span>
                    )}
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
              className="w-full flex items-center px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-slate-800 rounded-lg transition-colors"
          >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;