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

// ✅ IMPORTACIÓN CORREGIDA: Apunta a la carpeta src/services
import * as FirestoreService from './services/firestoreService';
import { Unit, Expense, AppSettings, ViewState, Consortium, Payment, SettlementRecord, UserRole, DebtAdjustment, ReserveTransaction } from './types';

// Configuración inicial por defecto (solo si falla la carga)
const DEFAULT_SETTINGS: AppSettings = {
  reserveFundBalance: 0,
  monthlyReserveContributionPercentage: 5, 
};

const App: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('ADMIN'); 
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');

  // Consortium State
  const [selectedConsortium, setSelectedConsortium] = useState<Consortium | null>(null);
  const [consortiums, setConsortiums] = useState<Consortium[]>([]);
  
  // App Data State (Inicializamos vacío, se cargará de Firebase)
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [units, setUnits] = useState<Unit[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  
  // Estos los mantenemos en local por ahora o podrías crear servicios para ellos también
  const [payments, setPayments] = useState<Payment[]>([]);
  const [history, setHistory] = useState<SettlementRecord[]>([]);
  const [debtAdjustments, setDebtAdjustments] = useState<DebtAdjustment[]>([]);
  const [reserveHistory, setReserveHistory] = useState<ReserveTransaction[]>([]);

  // 1. Cargar Consorcios al iniciar
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

  // 2. Cargar Datos del Consorcio Seleccionado
  useEffect(() => {
    if (selectedConsortium) {
      const loadConsortiumData = async () => {
        try {
          console.log("Cargando datos para:", selectedConsortium.name);
          const unitsData = await FirestoreService.getUnits(selectedConsortium.id);
          setUnits(unitsData);

          const expensesData = await FirestoreService.getExpenses(selectedConsortium.id);
          setExpenses(expensesData);
          
          // Aquí podrías cargar también pagos e historial si creas esos servicios
        } catch (error) {
          console.error("Error cargando datos del consorcio:", error);
        }
      };
      loadConsortiumData();
    }
  }, [selectedConsortium]);

  // Handlers
  const handleCreateConsortium = async (newConsortium: Consortium) => {
    try {
      const created = await FirestoreService.createConsortium(newConsortium);
      setConsortiums([...consortiums, created]);
    } catch (error) {
      alert("Error al crear consorcio en base de datos");
    }
  };

  const handleSwitchConsortium = () => {
      setSelectedConsortium(null);
      setCurrentView(currentUserRole === 'USER' ? 'user_portal' : 'dashboard');
      // Limpiar estados
      setUnits([]);
      setExpenses([]);
  };

  const handleLogout = () => {
      setSelectedConsortium(null);
      setIsAuthenticated(false);
      setCurrentUserEmail('');
  };

  const updateReserveBalance = (newBalance: number) => {
    setSettings(prev => ({ ...prev, reserveFundBalance: newBalance }));
    // TODO: Guardar esto en Firebase en 'configuracion/general'
  };

  const handleCloseMonth = (record: SettlementRecord) => {
      // Tu lógica existente para cerrar mes...
      setHistory(prev => [record, ...prev]);
      setExpenses([]); // Limpiar localmente
      setCurrentView('history');
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

  const renderView = () => {
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
                  consortiumId={selectedConsortium?.id || ''} // ✅ PASAR EL ID
               />;
      case 'expenses':
        return <ExpensesView 
                  expenses={expenses} 
                  setExpenses={setExpenses} 
                  consortiumId={selectedConsortium?.id || ''} // ✅ PASAR EL ID
               />;
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
      case 'collections':
        return <CollectionsView payments={payments} units={units} setPayments={setPayments} />;
      case 'history':
        return <HistoryView history={history} consortiumName={selectedConsortium.name} units={units} />;
      case 'debtors':
        return <DebtorsView 
                  units={units} 
                  payments={payments} 
                  history={history} 
                  debtAdjustments={debtAdjustments} 
                  setDebtAdjustments={setDebtAdjustments}
                />;
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
                  {/* Títulos dinámicos según vista */}
                  Panel de Control
              </h1>
              <p className="text-slate-500 mt-1">
                  {selectedConsortium.name} <span className="text-xs bg-slate-200 px-2 py-0.5 rounded ml-2">{selectedConsortium.cuit}</span>
              </p>
            </div>
        </header>

        <div className="max-w-7xl mx-auto pb-10">
             {renderView()}
        </div>
      </main>
    </div>
  );
};

export default App;