import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import UnitsView from './components/UnitsView';
import ExpensesView from './components/ExpensesView';
import SettlementView from './components/SettlementView';
import CollectionsView from './components/CollectionsView';
import HistoryView from './components/HistoryView';
import DebtorsView from './components/DebtorsView';
import AuthView from './components/AuthView';
import UserPortal from './components/UserPortal';
import { Unit, Expense, Payment, ViewState, UserRole, Consortium, AppSettings, SettlementRecord, DebtAdjustment } from './types';

// --- PERSISTENCIA LOCAL (Para que guarde sin Base de Datos) ---
const useLocalStorage = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };
  return [storedValue, setValue];
};

function App() {
  // --- ESTADOS CON GUARDADO AUTOMÁTICO ---
  const [user, setUser] = useLocalStorage<{email: string, role: UserRole} | null>('app_user', null);
  const [consortium, setConsortium] = useLocalStorage<Consortium | null>('app_consortium', null);
  
  // Datos principales
  const [units, setUnits] = useLocalStorage<Unit[]>('data_units', []);
  const [expenses, setExpenses] = useLocalStorage<Expense[]>('data_expenses', []);
  const [payments, setPayments] = useLocalStorage<Payment[]>('data_payments', []);
  const [history, setHistory] = useLocalStorage<SettlementRecord[]>('data_history', []);
  const [debtAdjustments, setDebtAdjustments] = useLocalStorage<DebtAdjustment[]>('data_adjustments', []);
  
  // Configuración (Aquí vive el SALDO del Fondo)
  const [settings, setSettings] = useLocalStorage<AppSettings>('data_settings', {
    reserveFundBalance: 0,
    monthlyReserveContributionPercentage: 5
  });

  const [view, setView] = useState<ViewState>('dashboard');

  // --- HANDLERS ---

  const handleLogin = (email: string, role: UserRole) => {
    setUser({ email, role });
    // Si es user normal, va a su portal, si no al dashboard
    setView(role === 'USER' ? 'user_portal' : 'dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setConsortium(null);
    setView('dashboard');
  };

  const handleCloseMonth = (record: SettlementRecord) => {
    // 1. Guardar en historial
    setHistory([record, ...history]);
    
    // 2. Actualizar Saldos de las Unidades (Deuda)
    const updatedUnits = units.map(u => {
        const detail = record.unitDetails.find(d => d.unitId === u.id);
        const debt = detail ? detail.totalToPay : 0;
        // Sumamos la deuda nueva al saldo existente (si lo hubiera)
        // Nota: Esto es simplificado. En un sistema real se crean "Movimientos de Cuenta Corriente".
        // Aquí asumimos que initialBalance se usa como "Deuda Acumulada".
        return { ...u }; 
    });
    setUnits(updatedUnits);

    // 3. Limpiar gastos del mes actual (Ya se cerraron)
    setExpenses([]);

    // 4. Actualizar el saldo de la caja del fondo con el valor de cierre real
    setSettings({
        ...settings,
        reserveFundBalance: record.reserveBalanceAtClose
    });

    alert("¡Mes cerrado con éxito! Los gastos se han archivado y el saldo del fondo se ha actualizado.");
    setView('history');
  };

  const updateReserveBalance = (newBalance: number) => {
      setSettings({ ...settings, reserveFundBalance: newBalance });
  };

  // --- RENDER ---

  if (!user) {
    return (
      <AuthView 
        isAuthenticated={false} 
        onLoginSuccess={handleLogin}
        onSelectConsortium={setConsortium}
        consortiums={[{ id: '1', name: 'Edificio Demo', address: 'Calle Falsa 123' }]} // Demo data
        onCreateConsortium={() => {}}
        onLogout={() => {}}
        userRole={'ADMIN'}
        userEmail={''}
      />
    );
  }

  if (!consortium) {
      // Selector simple si ya está logueado pero sin consorcio (raro en este flujo simplificado)
      setConsortium({ id: '1', name: 'Edificio Demo', address: 'Calle Falsa 123' });
      return null; 
  }

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar 
        currentView={view} 
        onChangeView={setView} 
        consortiumName={consortium.name}
        onSwitchConsortium={() => setConsortium(null)}
        onLogout={handleLogout}
        userRole={user.role}
      />
      
      <main className="flex-1 overflow-y-auto p-8 ml-64">
        <div className="max-w-7xl mx-auto">
          
          {view === 'dashboard' && (
            <Dashboard 
                units={units} 
                expenses={expenses} 
                settings={settings} 
                reserveHistory={[]} // Historial de reserva visual simplificado
            />
          )}

          {view === 'units' && (
            <UnitsView units={units} setUnits={setUnits} />
          )}

          {view === 'expenses' && (
            <ExpensesView 
                expenses={expenses} 
                setExpenses={setExpenses} 
                reserveBalance={settings.reserveFundBalance} // Pasamos el saldo real
            />
          )}

          {view === 'settlement' && (
            <SettlementView 
                units={units} 
                expenses={expenses} 
                settings={settings} 
                onCloseMonth={handleCloseMonth}
                updateReserveBalance={updateReserveBalance} // Pasamos la función para guardar manual
            />
          )}

          {view === 'collections' && (
            <CollectionsView payments={payments} units={units} setPayments={setPayments} />
          )}

          {view === 'debtors' && (
             <DebtorsView 
                units={units} 
                payments={payments} 
                history={history} 
                debtAdjustments={debtAdjustments} 
                setDebtAdjustments={setDebtAdjustments} 
             />
          )}

          {view === 'history' && (
            <HistoryView history={history} consortiumName={consortium.name} units={units} />
          )}

          {view === 'user_portal' && (
             <UserPortal 
                userEmail={user.email} 
                units={units} 
                expenses={expenses} 
                history={history} 
                payments={payments} 
             />
          )}

        </div>
      </main>
    </div>
  );
}

export default App;