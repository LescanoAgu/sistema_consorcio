import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Menu } from 'lucide-react'; 
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
import SettingsView from './components/SettingsView';
import AnnouncementsView from './components/AnnouncementsView';
import MaintenanceView from './components/MaintenanceView';
import AmenitiesView from './components/AmenitiesView'; 
import ProfileView from './components/ProfileView';
import DocumentsView from './components/DocumentsView'; 
import { Unit, Expense, Payment, ViewState, UserRole, Consortium, SettlementRecord, DebtAdjustment, ConsortiumSettings, Announcement, MaintenanceRequest, Amenity, Booking, ConsortiumDocument } from './types';
import { auth } from './src/config/firebase'; 
import { 
    getUnits, getExpenses, getHistory, createConsortium, 
    saveSettlement, getSettings, saveSettings, createPayment, uploadPaymentReceipt, getPayments, updatePayment,
    getAnnouncements, addAnnouncement, deleteAnnouncement,
    getDebtAdjustments, addDebtAdjustment, deleteDebtAdjustment,
    getMaintenanceRequests, addMaintenanceRequest, updateMaintenanceRequest, deleteMaintenanceRequest,
    getAmenities, addAmenity, deleteAmenity, getBookings, addBooking, deleteBooking,
    getAdminConsortiums, getUserConsortiums, 
    getDocuments, addDocument, deleteDocument
} from './services/firestoreService';

function App() {
  const [user, setUser] = useState<{email: string, role: UserRole, uid: string} | null>(null);
  const [consortium, setConsortium] = useState<Consortium | null>(null);
  const [consortiumList, setConsortiumList] = useState<Consortium[]>([]);
  
  const [units, setUnits] = useState<Unit[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [history, setHistory] = useState<SettlementRecord[]>([]);
  const [debtAdjustments, setDebtAdjustments] = useState<DebtAdjustment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]); 
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]); 
  const [bookings, setBookings] = useState<Booking[]>([]); 
  const [documents, setDocuments] = useState<ConsortiumDocument[]>([]); 
  
  const [settings, setSettings] = useState<ConsortiumSettings>({
      reserveFundBalance: 0, monthlyReserveContributionPercentage: 5, 
      bankName: '', bankCBU: '', bankAlias: '', bankHolder: '', bankCuit: '',
      address: '', cuit: '', adminName: ''
  });

  const [view, setView] = useState<ViewState>('dashboard');
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // 1. Escuchar Auth y cargar lista de consorcios
  useEffect(() => {
      const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
          if (firebaseUser && firebaseUser.email) {
              setUser({ email: firebaseUser.email, role: 'ADMIN', uid: firebaseUser.uid });
              const adminList = await getAdminConsortiums(firebaseUser.uid);
              const userList = await getUserConsortiums(firebaseUser.email);
              
              // Unificamos listas y eliminamos duplicados
              const combinedMap = new Map();
              [...adminList, ...userList].forEach(c => combinedMap.set(c.id, c));
              setConsortiumList(Array.from(combinedMap.values()));
          } else {
              setUser(null);
              setConsortium(null);
          }
      });
      return () => unsubscribe();
  }, []);

  // 2. NUEVO: Recuperar sesión del consorcio al recargar la página
  useEffect(() => {
      const savedConsortiumId = localStorage.getItem('selectedConsortiumId');
      // Solo intentamos recuperar si ya tenemos la lista de consorcios y no hay uno seleccionado
      if (savedConsortiumId && consortiumList.length > 0 && !consortium) {
          const found = consortiumList.find(c => c.id === savedConsortiumId);
          if (found) {
              console.log("Restaurando sesión de consorcio:", found.name);
              setConsortium(found);
          }
      }
  }, [consortiumList]); // Se ejecuta cada vez que cargan los consorcios disponibles

  // 3. Cargar datos del consorcio seleccionado (BLINDADO)
  useEffect(() => {
    // Verificamos que consortium exista Y que tenga ID válido antes de llamar a Firebase
    if (consortium && consortium.id) {
        setLoading(true);
        Promise.all([
            getUnits(consortium.id), 
            getExpenses(consortium.id), 
            getHistory(consortium.id), 
            getSettings(consortium.id),
            getPayments(consortium.id),
            getAnnouncements(consortium.id),
            getDebtAdjustments(consortium.id),
            getMaintenanceRequests(consortium.id),
            getAmenities(consortium.id), 
            getBookings(consortium.id),
            getDocuments(consortium.id)
        ])
        .then(([u, e, h, s, p, a, d, m, am, b, docs]) => { 
            setUnits(u); 
            setExpenses(e); 
            setHistory(h); 
            setSettings(s); 
            setPayments(p);
            setAnnouncements(a);
            setDebtAdjustments(d);
            setMaintenanceRequests(m);
            setAmenities(am);
            setBookings(b);
            setDocuments(docs);
            setLoading(false); 
        })
        .catch(err => {
            console.error("Error cargando datos:", err);
            setLoading(false);
        });
    }
  }, [consortium]);

  // 4. Determinar Rol (Admin vs User)
  useEffect(() => {
      if (user && units.length > 0) {
          const ownerUnit = units.find(u => u.linkedEmail === user.email);
          if (ownerUnit && user.role !== 'USER') {
              setUser(prev => prev ? ({ ...prev, role: 'USER' }) : null);
              setView('user_portal');
          } 
      }
  }, [units, user?.email]);

  // --- NUEVOS HANDLERS DE SELECCIÓN CON MEMORIA ---
  const handleSelectConsortium = (c: Consortium) => {
      localStorage.setItem('selectedConsortiumId', c.id); // Guardamos en memoria
      setConsortium(c);
  };

  const handleSwitchConsortium = () => {
      localStorage.removeItem('selectedConsortiumId'); // Borramos al salir
      setConsortium(null);
  };

  const handleLogout = () => {
      localStorage.removeItem('selectedConsortiumId'); // Borramos al cerrar sesión
      auth.signOut();
  };

  // --- RESTO DE HANDLERS ---

  const handleCreateConsortium = async (c: Consortium, userId: string) => {
      const newC = await createConsortium(c, userId);
      setConsortiumList([...consortiumList, newC as Consortium]);
  };

  const handleLoginSuccess = (email: string, role: UserRole) => {
      setView('dashboard');
  };

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

  const handleReportPayment = async (data: { amount: number, date: string, method: 'Transferencia' | 'Efectivo' | 'Cheque', notes: string, file: File | null }) => {
      if(!consortium || !user) return;
      const myUnit = units.find(u => u.linkedEmail === user.email) || units.find(u => u.ownerName === 'Usuario Demo');
      if (!myUnit) { alert("Sin unidad asignada."); return; }

      let attachmentUrl = '';
      if (data.file) attachmentUrl = await uploadPaymentReceipt(data.file);

      const newPayment: Omit<Payment, 'id'> = {
          unitId: myUnit.id, amount: data.amount, date: data.date, method: data.method, notes: data.notes, attachmentUrl, status: 'PENDING'
      };
      const created = await createPayment(consortium.id, newPayment);
      setPayments([created as Payment, ...payments]);
  };

  const handleAdminAddPayment = async (paymentData: Omit<Payment, 'id'>) => {
      if(!consortium) return;
      const created = await createPayment(consortium.id, paymentData);
      setPayments([created as Payment, ...payments]);
  };

  const handlePaymentStatusChange = async (id: string, newStatus: 'APPROVED' | 'REJECTED') => {
      if(!consortium) return;
      await updatePayment(consortium.id, id, { status: newStatus });
      setPayments(payments.map(p => p.id === id ? { ...p, status: newStatus } : p));
  };

  const handleAddAnnouncement = async (data: Omit<Announcement, 'id'>) => {
      if(!consortium) return;
      const created = await addAnnouncement(consortium.id, data);
      setAnnouncements([created as Announcement, ...announcements]);
  };

  const handleDeleteAnnouncement = async (id: string) => {
      if(!consortium) return;
      await deleteAnnouncement(consortium.id, id);
      setAnnouncements(announcements.filter(a => a.id !== id));
  };

  const handleAddDebtAdjustment = async (data: Omit<DebtAdjustment, 'id'>) => {
      if(!consortium) return;
      const created = await addDebtAdjustment(consortium.id, data);
      setDebtAdjustments([created as DebtAdjustment, ...debtAdjustments]);
  };

  const handleDeleteDebtAdjustment = async (id: string) => {
      if(!consortium) return;
      await deleteDebtAdjustment(consortium.id, id);
      setDebtAdjustments(debtAdjustments.filter(d => d.id !== id));
  };

  const handleAddMaintenance = async (data: Omit<MaintenanceRequest, 'id'>) => {
      if(!consortium) return;
      const created = await addMaintenanceRequest(consortium.id, data);
      setMaintenanceRequests([created as MaintenanceRequest, ...maintenanceRequests]);
  };

  const handleUpdateMaintenance = async (id: string, updates: Partial<MaintenanceRequest>) => {
      if(!consortium) return;
      await updateMaintenanceRequest(consortium.id, id, updates);
      setMaintenanceRequests(maintenanceRequests.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const handleDeleteMaintenance = async (id: string) => {
      if(!consortium) return;
      await deleteMaintenanceRequest(consortium.id, id);
      setMaintenanceRequests(maintenanceRequests.filter(m => m.id !== id));
  };

  const handleAddAmenity = async (data: Omit<Amenity, 'id'>) => {
      if(!consortium) return;
      const created = await addAmenity(consortium.id, data);
      setAmenities([...amenities, created as Amenity]);
  };

  const handleDeleteAmenity = async (id: string) => {
      if(!consortium) return;
      await deleteAmenity(consortium.id, id);
      setAmenities(amenities.filter(a => a.id !== id));
  };

  const handleAddBooking = async (data: Omit<Booking, 'id'>) => {
      if(!consortium) return;
      const created = await addBooking(consortium.id, data);
      setBookings([created as Booking, ...bookings]);
  };

  const handleDeleteBooking = async (id: string) => {
      if(!consortium) return;
      await deleteBooking(consortium.id, id);
      setBookings(bookings.filter(b => b.id !== id));
  };

  const handleAddDocument = async (data: Omit<ConsortiumDocument, 'id'>) => {
      if(!consortium) return;
      const created = await addDocument(consortium.id, data);
      setDocuments([created as ConsortiumDocument, ...documents]);
  };

  const handleDeleteDocument = async (id: string) => {
      if(!consortium) return;
      await deleteDocument(consortium.id, id);
      setDocuments(documents.filter(d => d.id !== id));
  };

  const menuBadges = useMemo(() => {
      const badges: { [key: string]: number } = {};
      if (user?.role === 'ADMIN') {
          const pendingCount = payments.filter(p => p.status === 'PENDING').length;
          if (pendingCount > 0) badges['collections'] = pendingCount;
          const pendingMaintenance = maintenanceRequests.filter(m => m.status === 'PENDING').length;
          if (pendingMaintenance > 0) badges['maintenance'] = pendingMaintenance;
      }
      const urgentCount = announcements.filter(a => a.priority === 'HIGH').length;
      if (urgentCount > 0) badges['announcements'] = urgentCount;
      return badges;
  }, [payments, announcements, maintenanceRequests, user]);

  // --- VISTAS ---

  // Si no hay usuario, o hay usuario pero no consorcio seleccionado (y es ADMIN, que puede elegir)
  if (!user || (!consortium && user.role !== 'ADMIN')) {
    return (
      <AuthView 
        isAuthenticated={!!user} 
        onLoginSuccess={handleLoginSuccess}
        onSelectConsortium={handleSelectConsortium} // <--- USAMOS EL NUEVO HANDLER
        consortiums={consortiumList}
        onCreateConsortium={handleCreateConsortium}
        onLogout={handleLogout} // <--- USAMOS EL NUEVO LOGOUT
        userRole={user?.role || 'ADMIN'}
        userEmail={user?.email || ''}
      />
    );
  }
  
  // Caso de seguridad extra por si falla la carga
  if (!consortium) {
       return (
        <AuthView 
            isAuthenticated={!!user} 
            onLoginSuccess={handleLoginSuccess}
            onSelectConsortium={handleSelectConsortium} // <--- USAMOS EL NUEVO HANDLER
            consortiums={consortiumList}
            onCreateConsortium={handleCreateConsortium}
            onLogout={handleLogout}
            userRole={user?.role || 'ADMIN'}
            userEmail={user?.email || ''}
        />
       );
  }

  return (
    <div className="flex h-screen bg-slate-100 flex-col md:flex-row">
      <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between shadow-md z-20">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-300 hover:text-white">
              <Menu className="w-6 h-6" />
          </button>
          <span className="font-bold truncate">{consortium.name}</span>
          <div className="w-6"></div>
      </div>

      <Sidebar 
        currentView={view} 
        onChangeView={setView} 
        consortiumName={consortium.name} 
        onSwitchConsortium={handleSwitchConsortium} // <--- USAMOS EL NUEVO HANDLER
        onLogout={handleLogout} 
        userRole={user.role}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        badges={menuBadges}
      />
      
      <main className="flex-1 overflow-y-auto p-4 md:p-8 md:ml-64 h-[calc(100vh-64px)] md:h-screen">
        <div className="max-w-7xl mx-auto pb-20 md:pb-0">
          {loading && <div className="text-center p-4">Cargando datos...</div>}

          {!loading && view === 'dashboard' && (
            <Dashboard 
                units={units} expenses={expenses} payments={payments} settings={settings} reserveHistory={[]} userRole={user.role} consortiumId={consortium.id} onDataReset={() => {}}
            />
          )}

          {!loading && view === 'announcements' && (
             <AnnouncementsView 
                announcements={announcements} 
                units={units} 
                onAdd={handleAddAnnouncement} 
                onDelete={handleDeleteAnnouncement} 
             />
          )}

          {!loading && view === 'documents' && (
             <DocumentsView 
                documents={documents}
                userRole={user.role}
                onAdd={handleAddDocument}
                onDelete={handleDeleteDocument}
             />
          )}

          {!loading && view === 'maintenance' && (
             <MaintenanceView 
                requests={maintenanceRequests}
                units={units}
                userRole={user.role}
                userEmail={user.email}
                onAdd={handleAddMaintenance}
                onUpdate={handleUpdateMaintenance}
                onDelete={handleDeleteMaintenance}
             />
          )}

          {!loading && view === 'amenities' && (
             <AmenitiesView 
                amenities={amenities}
                bookings={bookings}
                units={units}
                userRole={user.role}
                userEmail={user.email}
                onAddAmenity={handleAddAmenity}
                onDeleteAmenity={handleDeleteAmenity}
                onAddBooking={handleAddBooking}
                onDeleteBooking={handleDeleteBooking}
             />
          )}

          {!loading && view === 'units' && <UnitsView units={units} setUnits={setUnits} consortiumId={consortium.id} />}
          
          {!loading && view === 'expenses' && (
            <ExpensesView expenses={expenses} setExpenses={setExpenses} reserveBalance={settings.reserveFundBalance} consortiumId={consortium.id} />
          )}
          
          {!loading && view === 'settlement' && (
            <SettlementView 
                units={units} expenses={expenses} setExpenses={setExpenses} settings={settings} consortiumId={consortium.id} consortiumName={consortium.name}
                updateReserveBalance={(val) => handleUpdateSettings({...settings, reserveFundBalance: val})}
                onUpdateBankSettings={(newBankData) => handleUpdateSettings({...settings, ...newBankData})}
                onCloseMonth={handleCloseMonth}
                onChangeView={setView}
            />
          )}

          {!loading && view === 'history' && <HistoryView history={history} consortiumName={consortium.name} units={units} settings={settings} />}
          
          {!loading && view === 'user_portal' && (
            <UserPortal 
                userEmail={user.email} units={units} expenses={expenses} history={history} payments={payments} settings={settings} announcements={announcements}
                debtAdjustments={debtAdjustments} 
                myBookings={bookings} 
                myTickets={maintenanceRequests} 
                documents={documents} 
                onReportPayment={handleReportPayment} 
            />
          )}
          
          {!loading && view === 'debtors' && (
            <DebtorsView 
                units={units} payments={payments} history={history} 
                debtAdjustments={debtAdjustments} 
                onAddAdjustment={handleAddDebtAdjustment} 
                onDeleteAdjustment={handleDeleteDebtAdjustment} 
            />
          )}
          
          {!loading && view === 'collections' && (
             <CollectionsView payments={payments} units={units} onAddPayment={handleAdminAddPayment} onUpdateStatus={handlePaymentStatusChange} />
          )}
          
          {!loading && view === 'settings' && (
             <SettingsView currentSettings={settings} onSave={handleUpdateSettings} />
          )}
          
          {!loading && view === 'profile' && (
             <ProfileView userEmail={user.email} userRole={user.role} onLogout={handleLogout} />
          )}
        </div>
      </main>
    </div>
  );
}
export default App;