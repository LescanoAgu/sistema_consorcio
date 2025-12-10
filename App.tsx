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

import * as FirestoreService from './services/firestoreService';
import { Unit, Expense, AppSettings, ViewState, Consortium, Payment, SettlementRecord, UserRole, DebtAdjustment, ReserveTransaction } from './types';

const DEFAULT_SETTINGS: AppSettings = {
  reserveFundBalance: 0,
  monthlyReserveContributionPercentage: 5, 
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('ADMIN'); 
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');

  const [selectedConsortium, setSelectedConsortium] = useState<Consortium | null>(null);
  const [consortiums, setConsortiums] = useState<Consortium[]>([]);
  
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [units, setUnits] = useState<Unit[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  
  const [payments, setPayments] = useState<Payment[]>([]);
  const [history, setHistory] = useState<SettlementRecord[]>([]);
  const [debtAdjustments, setDebtAdjustments] = useState<DebtAdjustment[]>([]);
  const [reserveHistory, setReserveHistory] = useState<ReserveTransaction[]>([]);

  // Cargar Consorcios
  useEffect(() => {
    const loadConsortiums = async () => {
      try {
        const data = await FirestoreService.getConsortiums();
        setConsortiums(data);
      } catch (error) {
        console.error("Error cargando consorcios:", error);
      }
    };
    loadConsortiums();
  }, []);

  // Cargar Datos del Consorcio
  useEffect(() => {
    if (selectedConsortium) {
      const loadConsortiumData = async () => {
        try {
          const unitsData = await FirestoreService.getUnits(selectedConsortium.id);
          setUnits(unitsData);

          const expensesData = await FirestoreService.getExpenses(selectedConsortium.id);
          setExpenses(expensesData);
        } catch (error) {
          console.error("Error cargando datos:", error);
        }
      };
      loadConsortiumData();
    }
  }, [selectedConsortium]);

  const handleCreateConsortium = async (newConsortium: Consortium) => {
    try {
      const created = await FirestoreService.createConsortium(newConsortium);
      setConsortiums([...consortiums, created]);
    } catch (error) {
      alert("Error al crear consorcio en BD");
    }
  };

  const handleSwitchConsortium = () => {
      setSelectedConsortium(null);
      setCurrentView(currentUserRole === 'USER' ? 'user_portal' : 'dashboard');
      setUnits([]);
      setExpenses([]);
  };

  const handleLogout = () => {
      setSelectedConsortium(null);
      setIsAuthenticated(false);
      setCurrentUserEmail('');
  };

  const handleSettlementSuccess = () => {
      // Recargar gastos (deberían desaparecer los liquidados)
      if (selectedConsortium) {
          FirestoreService.getExpenses(selectedConsortium.id).then(setExpenses);
      }
      setCurrentView('history');
  };

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

  const renderView = () => {
    // Si no hay consorcio seleccionado, no renderizamos nada (seguridad)
    if (!selectedConsortium) return null;

    if (currentUserRole === 'USER') {
        if (['dashboard', 'units', 'collections', 'settlement', 'debtors'].includes(currentView)) {
             return <UserPortal userEmail={currentUserEmail} units={units} expenses={expenses} history={history} payments={payments} />;
        }
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard units={units} expenses={expenses} settings={settings} reserveHistory={reserveHistory} />;
      case 'units':
        return <UnitsView 
                  units={units} 
                  setUnits={setUnits} 
                  consortiumId={selectedConsortium.id} // ✅ PASAMOS EL ID
               />;
      case 'expenses':
        return <ExpensesView 
                  expenses={expenses} 
                  setExpenses={setExpenses} 
                  consortiumId={selectedConsortium.id} // ✅ PASAMOS EL ID
               />;
      case 'settlement':
        return (
          <SettlementView 
            units={units} 
            expenses={expenses} 
            settings={settings}
            consortiumId={selectedConsortium.id} // ✅ PASAMOS EL ID
            onSettlementSuccess={handleSettlementSuccess} // ✅ Callback para recargar
            updateReserveBalance={(v) => setSettings({...settings, reserveFundBalance: v})}
          />
        );
      case 'collections':
        return <CollectionsView payments={payments} units={units} setPayments={setPayments} />;
      case 'history':
        return <HistoryView history={history} consortiumName={selectedConsortium.name} units={units} />;
      case 'debtors':
        return <DebtorsView units={units} payments={payments} history={history} debtAdjustments={debtAdjustments} setDebtAdjustments={setDebtAdjustments} />;
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
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Panel de Control</h1>
              <p className="text-slate-500 mt-1">{selectedConsortium.name} <span className="text-xs bg-slate-200 px-2 py-0.5 rounded ml-2">{selectedConsortium.cuit}</span></p>
            </div>
        </header>
        <div className="max-w-7xl mx-auto pb-10">{renderView()}</div>
      </main>
    </div>
  );
};

export default App;