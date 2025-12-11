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
import { Unit, Expense, Payment, ViewState, UserRole, Consortium, SettlementRecord, DebtAdjustment, ConsortiumSettings } from './types';
import { getUnits, getExpenses, getHistory, getConsortiums, createConsortium, saveSettlement, getSettings, saveSettings } from './services/firestoreService';

function App() {
  const [user, setUser] = useState<{email: string, role: UserRole} | null>(null);
  const [consortium, setConsortium] = useState<Consortium | null>(null);
  const [consortiumList, setConsortiumList] = useState<Consortium[]>([]);
  
  const [units, setUnits] = useState<Unit[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [history, setHistory] = useState<SettlementRecord[]>([]);
  const [debtAdjustments, setDebtAdjustments] = useState<DebtAdjustment[]>([]);
  const [settings, setSettings] = useState<ConsortiumSettings>({
      reserveFundBalance: 0, monthlyReserveContributionPercentage: 5, bankName: '', bankCBU: '', bankAlias: '', bankHolder: '', bankCuit: ''
  });

  const [view, setView] = useState<ViewState>('dashboard');
  const [loading, setLoading] = useState(false);

  useEffect(() => { getConsortiums().then(setConsortiumList); }, []);

  useEffect(() => {
      if (consortium) {
          setLoading(true);
          Promise.all([getUnits(consortium.id), getExpenses(consortium.id), getHistory(consortium.id), getSettings(consortium.id)])
          .then(([u, e, h, s]) => { setUnits(u); setExpenses(e); setHistory(h); setSettings(s); setLoading(false); });
      }
  }, [consortium]);

  const handleCloseMonth = async (record: SettlementRecord) => {
    if (!consortium) return;
    try {
        await saveSettlement(consortium.id, record, expenses.map(e => e.id));
        const newHistory = await getHistory(consortium.id);
        setHistory(newHistory);
        setExpenses([]); 
        setSettings({...settings, reserveFundBalance: record.reserveBalanceAtClose});
        setView('history');
    } catch (e) { alert("Error al cerrar."); }
  };

  const handleUpdateSettings = async (newSettings: ConsortiumSettings) => {
      if(!consortium) return;
      await saveSettings(consortium.id, newSettings);
      setSettings(newSettings);
  };

  if (!user) return <AuthView isAuthenticated={false} onLoginSuccess={(e,r) => { setUser({email:e, role:r}); setView(r === 'USER' ? 'user_portal' : 'dashboard'); }} onSelectConsortium={setConsortium} consortiums={consortiumList} onCreateConsortium={async (c) => { const s = await createConsortium(c); setConsortiumList([...consortiumList, s as Consortium]); }} onLogout={() => {}} userRole={'ADMIN'} userEmail={''} />;
  if (!consortium) return null;

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar currentView={view} onChangeView={setView} consortiumName={consortium.name} onSwitchConsortium={() => setConsortium(null)} onLogout={() => setUser(null)} userRole={user.role} />
      <main className="flex-1 overflow-y-auto p-8 ml-64">
        <div className="max-w-7xl mx-auto">
          {view === 'dashboard' && <Dashboard units={units} expenses={expenses} settings={settings} reserveHistory={[]} />}
          {view === 'units' && <UnitsView units={units} setUnits={setUnits} consortiumId={consortium.id} />}
          {view === 'expenses' && <ExpensesView expenses={expenses} setExpenses={setExpenses} reserveBalance={settings.reserveFundBalance} />}
          {view === 'settlement' && <SettlementView units={units} expenses={expenses} setExpenses={setExpenses} settings={settings} consortiumId={consortium.id} updateReserveBalance={(val) => handleUpdateSettings({...settings, reserveFundBalance: val})} onCloseMonth={handleCloseMonth} />}
          {view === 'history' && <HistoryView history={history} consortiumName={consortium.name} units={units} settings={settings} />}
          {view === 'user_portal' && <UserPortal userEmail={user.email} units={units} expenses={expenses} history={history} payments={payments} />}
          {view === 'debtors' && <DebtorsView units={units} payments={payments} history={history} debtAdjustments={debtAdjustments} setDebtAdjustments={setDebtAdjustments} />}
          {view === 'collections' && <CollectionsView payments={payments} units={units} setPayments={setPayments} />}
        </div>
      </main>
    </div>
  );
}
export default App;