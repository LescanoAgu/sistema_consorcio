
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import UnitsView from './components/UnitsView';
import ExpensesView from './components/ExpensesView';
import SettlementView from './components/SettlementView';
import AuthView from './components/AuthView';
import CollectionsView from './components/CollectionsView';
import HistoryView from './components/HistoryView';
import DebtorsView from './components/DebtorsView';
import UserPortal from './components/UserPortal';

import { Unit, Expense, AppSettings, ViewState, Consortium, Payment, SettlementRecord, UserRole, DebtAdjustment, ReserveTransaction, ExpenseDistributionType } from './types';

// Initial Mock Data
const INITIAL_UNITS: Unit[] = [
  { id: '1', unitNumber: '1A', ownerName: 'Carlos Ruiz', linkedEmail: 'propietario@mail.com', proratePercentage: 12.5, initialBalance: 0 },
  { id: '2', unitNumber: '1B', ownerName: 'Maria Lopez', proratePercentage: 12.5, initialBalance: 5000 }, 
  { id: '3', unitNumber: '2A', ownerName: 'Juan Perez', linkedEmail: 'juan@mail.com', proratePercentage: 15.0, initialBalance: 0 },
  { id: '4', unitNumber: '2B', ownerName: 'Ana Gomez', proratePercentage: 15.0, initialBalance: 0 },
  { id: '5', unitNumber: '3A', ownerName: 'Pedro Silva', proratePercentage: 22.5, initialBalance: 0 },
  { id: '6', unitNumber: '3B', ownerName: 'Lucia Diaz', proratePercentage: 22.5, initialBalance: 0 },
];

const INITIAL_SETTINGS: AppSettings = {
  reserveFundBalance: 50000,
  monthlyReserveContributionPercentage: 5, 
};

const INITIAL_CONSORTIUMS: Consortium[] = [
  { id: '1', name: 'Edificio Torre Norte', address: 'Av. Libertador 1234, CABA', cuit: '30-11223344-5' },
  { id: '2', name: 'Residencias del Parque', address: 'Calle 50 Nro 800, La Plata', cuit: '30-99887766-1' },
];

const App: React.FC = () => {
  // Authentication & Global State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [selectedConsortium, setSelectedConsortium] = useState<Consortium | null>(null);
  const [consortiums, setConsortiums] = useState<Consortium[]>(() => {
      const saved = localStorage.getItem('cons_list');
      return saved ? JSON.parse(saved) : INITIAL_CONSORTIUMS;
  });
  
  // RBAC State
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('ADMIN'); 
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');

  // App Data State
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  
  const [units, setUnits] = useState<Unit[]>(() => {
    const saved = localStorage.getItem('cons_units');
    return saved ? JSON.parse(saved) : INITIAL_UNITS;
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('cons_expenses');
    return saved ? JSON.parse(saved) : [];
  });

  const [payments, setPayments] = useState<Payment[]>(() => {
      const saved = localStorage.getItem('cons_payments');
      return saved ? JSON.parse(saved) : [];
  });

  const [history, setHistory] = useState<SettlementRecord[]>(() => {
      const saved = localStorage.getItem('cons_history');
      return saved ? JSON.parse(saved) : [];
  });

  // NEW: Debt Adjustments (Interest)
  const [debtAdjustments, setDebtAdjustments] = useState<DebtAdjustment[]>(() => {
      const saved = localStorage.getItem('cons_debt_adj');
      return saved ? JSON.parse(saved) : [];
  });

  // NEW: Reserve Fund History
  const [reserveHistory, setReserveHistory] = useState<ReserveTransaction[]>(() => {
      const saved = localStorage.getItem('cons_reserve_hist');
      return saved ? JSON.parse(saved) : [];
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('cons_settings');
    return saved ? JSON.parse(saved) : INITIAL_SETTINGS;
  });

  // Persistence Effects
  useEffect(() => { localStorage.setItem('cons_list', JSON.stringify(consortiums)); }, [consortiums]);
  useEffect(() => { localStorage.setItem('cons_units', JSON.stringify(units)); }, [units]);
  useEffect(() => { localStorage.setItem('cons_expenses', JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem('cons_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('cons_payments', JSON.stringify(payments)); }, [payments]);
  useEffect(() => { localStorage.setItem('cons_history', JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem('cons_debt_adj', JSON.stringify(debtAdjustments)); }, [debtAdjustments]);
  useEffect(() => { localStorage.setItem('cons_reserve_hist', JSON.stringify(reserveHistory)); }, [reserveHistory]);

  const updateReserveBalance = (newBalance: number) => {
    setSettings(prev => ({ ...prev, reserveFundBalance: newBalance }));
  };

  const handleCloseMonth = (record: SettlementRecord) => {
      // 1. Save Settlement
      setHistory(prev => [record, ...prev]);
      
      // 2. Logic to update Reserve Fund History
      let currentReserve = settings.reserveFundBalance;
      const transactions: ReserveTransaction[] = [];
      const today = new Date().toISOString().split('T')[0];

      // A. Expenses paid FROM reserve (Debit)
      const expensesFromReserve = record.snapshotExpenses.filter(e => e.distributionType === ExpenseDistributionType.FROM_RESERVE);
      expensesFromReserve.forEach(exp => {
          currentReserve -= exp.amount;
          transactions.push({
              id: crypto.randomUUID(),
              date: today,
              amount: -exp.amount,
              description: `Pago Gasto: ${exp.description}`,
              balanceAfter: currentReserve
          });
      });

      // B. Contribution TO reserve (Credit)
      // Calculate contribution amount based on Ordinary expenses
      const ordinaryTotal = record.snapshotExpenses
        .filter(e => e.category === 'Ordinary' && e.distributionType !== ExpenseDistributionType.FROM_RESERVE)
        .reduce((sum, e) => sum + e.amount, 0);
      
      const contribution = (ordinaryTotal * settings.monthlyReserveContributionPercentage) / 100;
      
      if (contribution > 0) {
          currentReserve += contribution;
          transactions.push({
              id: crypto.randomUUID(),
              date: today,
              amount: contribution,
              description: `Aporte mensual Expensas (${record.month})`,
              balanceAfter: currentReserve
          });
      }

      // Update States
      if (transactions.length > 0) {
          setReserveHistory(prev => [...transactions.reverse(), ...prev]); // Newest first
          updateReserveBalance(currentReserve);
      }

      setExpenses([]);
      setCurrentView('history');
  };

  const handleCreateConsortium = (newConsortium: Consortium) => {
      setConsortiums([...consortiums, newConsortium]);
  };

  const handleSwitchConsortium = () => {
      setSelectedConsortium(null);
      setCurrentView(currentUserRole === 'USER' ? 'user_portal' : 'dashboard');
  };

  const handleLogout = () => {
      setSelectedConsortium(null);
      setIsAuthenticated(false);
      setCurrentUserEmail('');
  };

  // Login/Selection Screen
  if (!isAuthenticated || !selectedConsortium) {
      return (
        <AuthView 
            isAuthenticated={isAuthenticated}
            onLoginSuccess={(email, role) => {
                setIsAuthenticated(true);
                setCurrentUserRole(role);
                setCurrentUserEmail(email);
            }}
            onSelectConsortium={(consortium) => {
                setSelectedConsortium(consortium);
                setCurrentView(currentUserRole === 'USER' ? 'user_portal' : 'dashboard');
            }}
            consortiums={consortiums}
            onCreateConsortium={handleCreateConsortium}
            onLogout={handleLogout}
            userRole={currentUserRole}
            userEmail={currentUserEmail}
        />
      );
  }

  // Main App View Router
  const renderView = () => {
    if (currentUserRole === 'USER') {
        if (['dashboard', 'units', 'collections', 'settlement', 'debtors'].includes(currentView)) {
             return <UserPortal userEmail={currentUserEmail} units={units} expenses={expenses} history={history} payments={payments} />;
        }
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard 
                  units={units} 
                  expenses={expenses} 
                  settings={settings} 
                  reserveHistory={reserveHistory}
                />;
      case 'user_portal':
        return <UserPortal userEmail={currentUserEmail} units={units} expenses={expenses} history={history} payments={payments} />;
      case 'debtors':
        return <DebtorsView 
                  units={units} 
                  payments={payments} 
                  history={history} 
                  debtAdjustments={debtAdjustments} 
                  setDebtAdjustments={setDebtAdjustments}
                />;
      case 'units':
        return <UnitsView units={units} setUnits={setUnits} />;
      case 'expenses':
        return <ExpensesView expenses={expenses} setExpenses={setExpenses} />;
      case 'collections':
        return <CollectionsView payments={payments} units={units} setPayments={setPayments} />;
      case 'history':
        return <HistoryView history={history} consortiumName={selectedConsortium.name} units={units} />;
      case 'settlement':
        return (
          <SettlementView 
            units={units} 
            expenses={expenses} 
            settings={settings}
            updateReserveBalance={updateReserveBalance}
            onCloseMonth={handleCloseMonth}
          />
        );
      default:
        return <Dashboard units={units} expenses={expenses} settings={settings} reserveHistory={reserveHistory} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <Sidebar 
        currentView={currentView} 
        onChangeView={setCurrentView} 
        consortiumName={selectedConsortium.name}
        onSwitchConsortium={handleSwitchConsortium}
        onLogout={handleLogout}
        userRole={currentUserRole}
      />
      
      <main className="ml-64 flex-1 p-8 overflow-y-auto h-screen">
        <header className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
                  {currentView === 'dashboard' && 'Resumen General'}
                  {currentView === 'user_portal' && 'Mi Portal'}
                  {currentView === 'units' && 'Gestión de Propiedades'}
                  {currentView === 'expenses' && 'Control de Gastos'}
                  {currentView === 'collections' && 'Cobranzas'}
                  {currentView === 'settlement' && 'Liquidación Mensual'}
                  {currentView === 'history' && 'Histórico de Cierres'}
                  {currentView === 'debtors' && 'Control de Morosidad'}
              </h1>
              <p className="text-slate-500 mt-1">
                  {selectedConsortium.name} <span className="text-xs bg-slate-200 px-2 py-0.5 rounded ml-2">{selectedConsortium.cuit}</span>
              </p>
            </div>
            
            {currentUserRole !== 'USER' && (
                <div className="bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200 text-sm font-medium text-slate-600 flex items-center gap-2">
                    Fondo Reserva: <span className="text-emerald-600 font-bold">${settings.reserveFundBalance.toFixed(2)}</span>
                </div>
            )}
        </header>

        <div className="max-w-7xl mx-auto pb-10">
             {renderView()}
        </div>
      </main>
    </div>
  );
};

export default App;
