import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Loader2 } from 'lucide-react'; 
import Sidebar from './components/Sidebar';
import AuthView from './components/AuthView';
import { Unit, Expense, Payment, ViewState, UserRole, Consortium, SettlementRecord, ConsortiumSettings, Announcement, MaintenanceRequest, Amenity, Booking, ConsortiumDocument, ReserveTransaction } from './types';
import { auth } from './src/config/firebase'; 
import { 
    getUnits, getExpenses, getHistory, createConsortium, 
    saveSettlement, getSettings, saveSettings, createPayment, uploadPaymentReceipt, getPayments, updatePayment, deletePayment,
    getAnnouncements, addAnnouncement, deleteAnnouncement,
    getMaintenanceRequests, addMaintenanceRequest, updateMaintenanceRequest, deleteMaintenanceRequest,
    getAmenities, addAmenity, deleteAmenity, getBookings, addBooking, deleteBooking,
    getAdminConsortiums, getUserConsortiums, 
    getDocuments, addDocument, deleteDocument, updateUnit,
    getReserveTransactions, addReserveTransaction, deleteReserveTransaction
} from './services/firestoreService';
import { analyzePaymentReserve } from './utils/reserveAccounting';

// Code Splitting (Lazy Loaded Views)
const Dashboard = lazy(() => import('./components/Dashboard'));
const ManagementView = lazy(() => import('./components/ManagementView'));
const AccountingView = lazy(() => import('./components/AccountingView'));
const ExpensesView = lazy(() => import('./components/ExpensesView'));
const HistoryView = lazy(() => import('./components/HistoryView'));
const UserPortal = lazy(() => import('./components/UserPortal'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const AnnouncementsView = lazy(() => import('./components/AnnouncementsView'));
const MaintenanceView = lazy(() => import('./components/MaintenanceView'));
const AmenitiesView = lazy(() => import('./components/AmenitiesView'));
const ProfileView = lazy(() => import('./components/ProfileView'));
const DocumentsView = lazy(() => import('./components/DocumentsView'));
const CollectionsView = lazy(() => import('./components/CollectionsView'));

const VALID_VIEWS: ViewState[] = [
    'dashboard', 'accounting', 'management', 'collections', 'expenses',
    'history', 'announcements', 'documents', 'maintenance', 'amenities',
    'user_portal', 'settings', 'profile'
];

const pathToView = (pathname: string): ViewState => {
    const clean = pathname.replace(/^\/+/, '').split('/')[0] as ViewState;
    if (VALID_VIEWS.includes(clean)) return clean;
    return 'dashboard';
};

function App() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const [user, setUser] = useState<{email: string, uid: string} | null>(null);
  const [consortium, setConsortium] = useState<Consortium | null>(null);
  const [consortiumList, setConsortiumList] = useState<Consortium[]>([]);
  
  const [units, setUnits] = useState<Unit[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [history, setHistory] = useState<SettlementRecord[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]); 
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]); 
  const [bookings, setBookings] = useState<Booking[]>([]); 
  const [documents, setDocuments] = useState<ConsortiumDocument[]>([]); 
  const [reserveTransactions, setReserveTransactions] = useState<ReserveTransaction[]>([]); 
  
  const [settings, setSettings] = useState<ConsortiumSettings>({
      reserveFundBalance: 0, monthlyReserveContributionPercentage: 5, interestRate: 0,
      bankName: '', bankCBU: '', bankAlias: '', bankHolder: '', bankCuit: '',
      address: '', cuit: '', adminName: ''
  });

  const [view, setView] = useState<ViewState>(() => pathToView(location.pathname));
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Sync URL changes (back/forward button) with current view
  useEffect(() => {
      const urlView = pathToView(location.pathname);
      if (urlView !== view) {
          setView(urlView);
      }
  }, [location.pathname]);

  useEffect(() => {
      const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
          if (firebaseUser && firebaseUser.email) {
              setUser({ email: firebaseUser.email, uid: firebaseUser.uid });
              const adminList = await getAdminConsortiums(firebaseUser.uid);
              const userList = await getUserConsortiums(firebaseUser.email);
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

  useEffect(() => {
      const savedConsortiumId = localStorage.getItem('selectedConsortiumId');
      if (savedConsortiumId && consortiumList.length > 0 && !consortium) {
          const found = consortiumList.find(c => c.id === savedConsortiumId);
          if (found) setConsortium(found);
      }
  }, [consortiumList]);

  /**
   * Resolución de Roles de Usuario y Hardware IoT / Control de Accesos:
   * 
   * Se evalúa el perfil autenticado para otorgar permisos según su rol funcional:
   * - 'ADMIN': Administrador del consorcio con acceso total a contabilidad, cobranzas y liquidaciones.
   * - 'DEVICE': Microcontroladores o dispositivos embebidos (ESP32, Raspberry Pi, relés de portones,
   *             porteros IP, molinetes) que operan con credenciales de servicio IoT (@iot.consorcio.local).
   * - 'CONTROL_WIFI': Módulos de automatización de control de acceso Wi-Fi local (@wifi.consorcio.local).
   * - 'USER': Propietarios e inquilinos que acceden a "Mis Unidades", reservas y reportes de pago.
   */
  const isConsortiumAdmin = useMemo(() => consortium && user ? (consortium.adminIds || []).includes(user.uid) : false, [consortium, user]);

  const userRole: UserRole = useMemo(() => {
      if (!user) return 'USER';
      
      const emailLower = (user.email || '').toLowerCase().trim();
      
      // Verificación estricta por dominio reservado para dispositivos de hardware IoT / Automatización
      if (emailLower.endsWith('@wifi.consorcio.local')) {
          return 'CONTROL_WIFI';
      }
      if (emailLower.endsWith('@iot.consorcio.local')) {
          return 'DEVICE';
      }
      
      // Administrador
      if (isConsortiumAdmin) {
          return 'ADMIN';
      }
      
      // Rol por defecto para residentes y propietarios
      return 'USER';
  }, [user, isConsortiumAdmin]);

  const { data: fetchedUnits } = useQuery({
      queryKey: ['units', consortium?.id, user?.email, isConsortiumAdmin],
      queryFn: () => getUnits(consortium!.id, user!.email, isConsortiumAdmin),
      enabled: !!consortium && !!user,
      staleTime: 1000 * 60 * 5
  });

  const myUnitIds = useMemo(() => fetchedUnits ? fetchedUnits.filter(u => u.authorizedEmails?.some(e => e.toLowerCase() === user?.email.toLowerCase())).map(u => u.id) : [], [fetchedUnits, user]);

  const { data: fetchedExpenses } = useQuery({ queryKey: ['expenses', consortium?.id], queryFn: () => getExpenses(consortium!.id), enabled: !!consortium, staleTime: 1000 * 60 * 5 });
  const { data: fetchedHistory } = useQuery({ queryKey: ['history', consortium?.id], queryFn: () => getHistory(consortium!.id), enabled: !!consortium, staleTime: 1000 * 60 * 5 });
  const { data: fetchedSettings } = useQuery({ queryKey: ['settings', consortium?.id], queryFn: () => getSettings(consortium!.id), enabled: !!consortium, staleTime: 1000 * 60 * 5 });
  
  const { data: fetchedPayments } = useQuery({ 
      queryKey: ['payments', consortium?.id, isConsortiumAdmin, myUnitIds], 
      queryFn: () => getPayments(consortium!.id, isConsortiumAdmin, myUnitIds), 
      enabled: !!consortium && !!user && (isConsortiumAdmin || myUnitIds.length > 0),
      staleTime: 1000 * 60 * 5
  });

  const { data: fetchedAnnouncements } = useQuery({ queryKey: ['announcements', consortium?.id], queryFn: () => getAnnouncements(consortium!.id), enabled: !!consortium && ['dashboard', 'announcements', 'user_portal'].includes(view), staleTime: 1000 * 60 * 5 });
  const { data: fetchedMaintenance } = useQuery({
      queryKey: ['maintenance', consortium?.id, isConsortiumAdmin, myUnitIds],
      queryFn: () => getMaintenanceRequests(consortium!.id, isConsortiumAdmin, myUnitIds),
      enabled: !!consortium && !!user && ['dashboard', 'maintenance', 'user_portal'].includes(view) && (isConsortiumAdmin || myUnitIds.length > 0),
      staleTime: 1000 * 60 * 5
  });
  const { data: fetchedAmenities } = useQuery({ queryKey: ['amenities', consortium?.id], queryFn: () => getAmenities(consortium!.id), enabled: !!consortium && ['amenities', 'user_portal'].includes(view), staleTime: 1000 * 60 * 5 });
  const { data: fetchedBookings } = useQuery({ queryKey: ['bookings', consortium?.id], queryFn: () => getBookings(consortium!.id), enabled: !!consortium && ['amenities', 'user_portal'].includes(view), staleTime: 1000 * 60 * 5 });
  const { data: fetchedDocuments } = useQuery({ queryKey: ['documents', consortium?.id], queryFn: () => getDocuments(consortium!.id), enabled: !!consortium && ['documents', 'user_portal'].includes(view), staleTime: 1000 * 60 * 5 });
  const { data: fetchedReserve } = useQuery({ queryKey: ['reserve', consortium?.id], queryFn: () => getReserveTransactions(consortium!.id), enabled: !!consortium, staleTime: 1000 * 60 * 5 });

  useEffect(() => {
      if (fetchedUnits) setUnits(fetchedUnits);
      if (fetchedExpenses) setExpenses(fetchedExpenses);
      if (fetchedHistory) setHistory(fetchedHistory);
      if (fetchedSettings) setSettings(fetchedSettings);
      if (fetchedPayments) setPayments(fetchedPayments);
      if (fetchedAnnouncements) setAnnouncements(fetchedAnnouncements);
      if (fetchedMaintenance) setMaintenanceRequests(fetchedMaintenance);
      if (fetchedAmenities) setAmenities(fetchedAmenities);
      if (fetchedBookings) setBookings(fetchedBookings);
      if (fetchedDocuments) setDocuments(fetchedDocuments);
      if (fetchedReserve) setReserveTransactions(fetchedReserve);
      setLoading(false);
  }, [fetchedUnits, fetchedExpenses, fetchedHistory, fetchedSettings, fetchedPayments, fetchedAnnouncements, fetchedMaintenance, fetchedAmenities, fetchedBookings, fetchedDocuments, fetchedReserve]);

  useEffect(() => {
      if(consortium && user) setLoading(true);
  }, [consortium, user]);

  // Interceptor de navegación segura para prevenir accesos indebidos según el rol y sincronizar URL
  const handleSetViewSafe = (requestedView: ViewState) => {
      let targetView: ViewState = requestedView;
      switch (userRole) {
          case 'USER':
              if (['accounting', 'management', 'settings', 'expenses', 'collections'].includes(requestedView)) {
                  targetView = 'user_portal';
              }
              break;
          case 'DEVICE':
          case 'CONTROL_WIFI':
              if (!['dashboard', 'profile'].includes(requestedView)) {
                  targetView = 'dashboard';
              }
              break;
          case 'ADMIN':
          default:
              break;
      }
      setView(targetView);
      const targetPath = targetView === 'dashboard' ? '/' : `/${targetView}`;
      if (location.pathname !== targetPath) {
          navigate(targetPath);
      }
  };

  const handleSelectConsortium = (c: Consortium) => { localStorage.setItem('selectedConsortiumId', c.id); setConsortium(c); };
  const handleSwitchConsortium = () => { localStorage.removeItem('selectedConsortiumId'); setConsortium(null); };
  const handleLogout = () => { localStorage.removeItem('selectedConsortiumId'); auth.signOut(); };
  const handleCreateConsortium = async (c: Consortium, userId: string) => {
      const newC = await createConsortium(c, userId);
      setConsortiumList([...consortiumList, newC as Consortium]);
  };
  const handleLoginSuccess = () => handleSetViewSafe('dashboard');

  const handleRefreshReserve = async () => {
      if (!consortium) return;
      const updated = await getReserveTransactions(consortium.id);
      setReserveTransactions(updated);
      queryClient.setQueryData(['reserve', consortium.id], updated);
  };
  
  const handleCloseMonth = async (record: SettlementRecord) => {
    if (!consortium) return;
    try {
        await saveSettlement(consortium.id, record, expenses.map(e => e.id), units);
        const newHistory = await getHistory(consortium.id);
        
        setHistory(newHistory);
        setExpenses([]);
        queryClient.setQueryData(['history', consortium.id], newHistory);
        queryClient.setQueryData(['expenses', consortium.id], []);
        
        // Recargar las unidades inmediatamente para que los estados, deudas y saldos a favor aplicados se actualicen en vivo
        if (user) {
            const updatedUnits = await getUnits(consortium.id, user.email, isConsortiumAdmin);
            setUnits(updatedUnits);
            queryClient.setQueryData(['units', consortium.id, user.email, isConsortiumAdmin], updatedUnits);
        }

        if (view !== 'accounting') {
            handleSetViewSafe('history');
        }
    } catch (e) { alert("Error al cerrar la liquidación."); }
  };
  
  const handleUpdateSettings = async (newSettings: ConsortiumSettings) => {
      if(!consortium) return;
      await saveSettings(consortium.id, newSettings);
      setSettings(newSettings);
      queryClient.setQueryData(['settings', consortium.id], newSettings);
  };
  
  const handleReportPayment = async (data: any) => {
      if(!consortium || !user) return;
      const myUnit = units.find(u => u.id === data.unitId) || units.find(u => u.authorizedEmails?.some(e => e.toLowerCase() === user.email.toLowerCase()));
      if (!myUnit) { alert("Error de unidad."); return; }
      let attachmentUrl = '';
      if (data.file) attachmentUrl = await uploadPaymentReceipt(data.file);
      const newPayment = { unitId: myUnit.id, amount: data.amount, date: data.date, method: data.method, notes: data.notes, attachmentUrl, status: 'PENDING' as const };
      const created = await createPayment(consortium.id, newPayment);
      const nextPayments = [created as Payment, ...payments];
      setPayments(nextPayments);
      queryClient.invalidateQueries({ queryKey: ['payments', consortium.id] });
  };
  
  const handleAdminAddPayment = async (paymentData: Omit<Payment, 'id'>) => {
      if(!consortium) return;
      
      // Calcular el aporte exacto al fondo de reserva excluyendo MORA, extraordinarias y locales libres
      const rate = settings.monthlyReserveContributionPercentage;
      const tempAnalysis = analyzePaymentReserve(
          { id: 'temp', ...paymentData },
          units,
          history,
          rate
      );
      const reserveAmount = paymentData.reserveContribution !== undefined
          ? paymentData.reserveContribution
          : tempAnalysis.correctReserve;

      const created = await createPayment(consortium.id, {
          ...paymentData,
          reserveContribution: reserveAmount
      });
      const nextPayments = [created as Payment, ...payments];
      setPayments(nextPayments);
      queryClient.invalidateQueries({ queryKey: ['payments', consortium.id] });
      
      if (created.status === 'APPROVED' && reserveAmount > 0) {
          const unitObj = units.find(u => u.id === created.unitId);
          const unitLabel = unitObj ? `UF ${unitObj.unitNumber} - ` : '';
          const newTx = await addReserveTransaction(consortium.id, {
              date: created.date,
              amount: reserveAmount,
              description: `Aporte Reserva de Cobro (${unitLabel}#${created.id.slice(-4)})`,
              type: 'SYSTEM',
              paymentId: created.id
          });
          setReserveTransactions(prev => [newTx as ReserveTransaction, ...prev]);
          queryClient.invalidateQueries({ queryKey: ['reserve', consortium.id] });
      }
  };
  
  const handlePaymentStatusChange = async (id: string, newStatus: 'APPROVED' | 'REJECTED', approvalPayload?: Partial<Payment>) => {
      if(!consortium) return;
      const payment = payments.find(p => p.id === id);
      if (!payment) return;

      const updates: Partial<Payment> = {
          ...(approvalPayload || {}),
          status: newStatus
      };

      if (newStatus === 'APPROVED') {
          const mergedPayment: Payment = { ...payment, ...updates };
          const rate = settings.monthlyReserveContributionPercentage;
          const analysis = analyzePaymentReserve(mergedPayment, units, history, rate);
          const reserveAmount = updates.reserveContribution !== undefined
              ? updates.reserveContribution
              : analysis.correctReserve;

          updates.reserveContribution = reserveAmount;

          await updatePayment(consortium.id, id, updates);
          setPayments(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
          queryClient.invalidateQueries({ queryKey: ['payments', consortium.id] });

          if (reserveAmount > 0) {
              const unitObj = units.find(u => u.id === mergedPayment.unitId);
              const unitLabel = unitObj ? `UF ${unitObj.unitNumber} - ` : '';
              const newTx = await addReserveTransaction(consortium.id, {
                  date: mergedPayment.date || new Date().toISOString().split('T')[0],
                  amount: reserveAmount,
                  description: `Aporte Reserva de Cobro (${unitLabel}#${payment.id.slice(-4)})`,
                  type: 'SYSTEM',
                  paymentId: payment.id
              });
              setReserveTransactions(prev => [newTx as ReserveTransaction, ...prev]);
              queryClient.invalidateQueries({ queryKey: ['reserve', consortium.id] });
          }
      } else {
          await updatePayment(consortium.id, id, updates);
          setPayments(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
          queryClient.invalidateQueries({ queryKey: ['payments', consortium.id] });
      }
  };

  const handleDeletePayment = async (id: string) => {
      if(!consortium) return;
      const paymentToDelete = payments.find(p => p.id === id);
      
      await deletePayment(consortium.id, id);
      setPayments(prev => prev.filter(p => p.id !== id));
      queryClient.invalidateQueries({ queryKey: ['payments', consortium.id] });

      if (paymentToDelete && paymentToDelete.status === 'APPROVED') {
          // 1. Revertir Fondo de Reserva: buscar si existe transacción vinculada o calcular monto exacto sin mora
          const linkedTx = reserveTransactions.find(t =>
              t.paymentId === id ||
              (t.type === 'SYSTEM' && t.amount > 0 && t.description?.includes(`${id.slice(-4)})`))
          );

          const rate = settings.monthlyReserveContributionPercentage;
          const reserveAmount = linkedTx
              ? linkedTx.amount
              : (paymentToDelete.reserveContribution !== undefined
                  ? paymentToDelete.reserveContribution
                  : analyzePaymentReserve(paymentToDelete, units, history, rate).correctReserve);

          if (reserveAmount > 0) {
              const newTx = await addReserveTransaction(consortium.id, {
                  date: new Date().toISOString().split('T')[0],
                  amount: -reserveAmount,
                  description: `Reversión de Cobro (#${paymentToDelete.id.slice(-4)})`,
                  type: 'SYSTEM',
                  paymentId: paymentToDelete.id
              });
              setReserveTransactions(prev => [newTx as ReserveTransaction, ...prev]);
              queryClient.invalidateQueries({ queryKey: ['reserve', consortium.id] });
          }

          // 2. Revertir deudas y saldo a favor de la unidad
          const unit = units.find(u => u.id === paymentToDelete.unitId);
          if (unit) {
              let updatedDebts = [...(unit.debts || [])];
              let initialBalance = unit.initialBalance || 0;
              let creditBalance = unit.creditBalance || 0;

              if (paymentToDelete.creditGenerated && paymentToDelete.creditGenerated > 0) {
                  creditBalance = Math.max(0, Math.round((creditBalance - paymentToDelete.creditGenerated) * 100) / 100);
              }

              if (paymentToDelete.allocations && paymentToDelete.allocations.length > 0) {
                  paymentToDelete.allocations.forEach(alloc => {
                      if (alloc.period === 'initial-balance') {
                          initialBalance = Math.round((initialBalance + alloc.amount) * 100) / 100;
                      } else {
                          const existingDebt = updatedDebts.find(d => d.period === alloc.period);
                          const restoredBase = alloc.basePaid !== undefined ? alloc.basePaid : alloc.amount;
                          const restoredInterest = alloc.interestPaid !== undefined ? alloc.interestPaid : 0;

                          if (existingDebt) {
                              existingDebt.baseAmount = Math.round(((existingDebt.baseAmount || 0) + restoredBase) * 100) / 100;
                              existingDebt.interestAmount = Math.round(((existingDebt.interestAmount || 0) + restoredInterest) * 100) / 100;
                              existingDebt.total = Math.round((existingDebt.total + alloc.amount) * 100) / 100;
                          } else {
                              updatedDebts.push({
                                  id: `debt_${alloc.period}_${Date.now()}_rev`,
                                  period: alloc.period,
                                  baseAmount: restoredBase,
                                  interestRate: 0,
                                  interestAmount: restoredInterest,
                                  total: alloc.amount
                              });
                          }
                      }
                  });
              }

              await handleUpdateUnit(unit.id, { debts: updatedDebts, initialBalance, creditBalance });
          }
      }
  };
  
  const handleUpdateUnit = async (unitId: string, updates: Partial<Unit>) => {
      if (!consortium) return;
      await updateUnit(consortium.id, unitId, updates);
      setUnits(prev => prev.map(u => u.id === unitId ? { ...u, ...updates } : u));
      queryClient.invalidateQueries({ queryKey: ['units', consortium.id] });
  };

  const handleAddAnnouncement = async (data: any) => {
      if(!consortium) return;
      const created = await addAnnouncement(consortium.id, data);
      setAnnouncements([created as Announcement, ...announcements]);
      queryClient.invalidateQueries({ queryKey: ['announcements', consortium.id] });
  };
  const handleDeleteAnnouncement = async (id: string) => {
      if(!consortium) return;
      await deleteAnnouncement(consortium.id, id);
      setAnnouncements(announcements.filter(a => a.id !== id));
      queryClient.invalidateQueries({ queryKey: ['announcements', consortium.id] });
  };
  const handleAddMaintenance = async (data: any) => {
      if(!consortium) return;
      const created = await addMaintenanceRequest(consortium.id, data);
      setMaintenanceRequests([created as MaintenanceRequest, ...maintenanceRequests]);
      queryClient.invalidateQueries({ queryKey: ['maintenance', consortium.id] });
  };
  const handleUpdateMaintenance = async (id: string, updates: any) => {
      if(!consortium) return;
      await updateMaintenanceRequest(consortium.id, id, updates);
      setMaintenanceRequests(maintenanceRequests.map(m => m.id === id ? { ...m, ...updates } : m));
      queryClient.invalidateQueries({ queryKey: ['maintenance', consortium.id] });
  };
  const handleDeleteMaintenance = async (id: string) => {
      if(!consortium) return;
      await deleteMaintenanceRequest(consortium.id, id);
      setMaintenanceRequests(maintenanceRequests.filter(m => m.id !== id));
      queryClient.invalidateQueries({ queryKey: ['maintenance', consortium.id] });
  };
  const handleAddAmenity = async (data: any) => {
      if(!consortium) return;
      const created = await addAmenity(consortium.id, data);
      setAmenities([...amenities, created as Amenity]);
      queryClient.invalidateQueries({ queryKey: ['amenities', consortium.id] });
  };
  const handleDeleteAmenity = async (id: string) => {
      if(!consortium) return;
      await deleteAmenity(consortium.id, id);
      setAmenities(amenities.filter(a => a.id !== id));
      queryClient.invalidateQueries({ queryKey: ['amenities', consortium.id] });
  };
  const handleAddBooking = async (data: any) => {
      if(!consortium) return;
      const created = await addBooking(consortium.id, data);
      setBookings([created as Booking, ...bookings]);
      queryClient.invalidateQueries({ queryKey: ['bookings', consortium.id] });
  };
  const handleDeleteBooking = async (id: string) => {
      if(!consortium) return;
      await deleteBooking(consortium.id, id);
      setBookings(bookings.filter(b => b.id !== id));
      queryClient.invalidateQueries({ queryKey: ['bookings', consortium.id] });
  };
  const handleAddDocument = async (data: any) => {
      if(!consortium) return;
      const created = await addDocument(consortium.id, data);
      setDocuments([created as ConsortiumDocument, ...documents]);
      queryClient.invalidateQueries({ queryKey: ['documents', consortium.id] });
  };
  const handleDeleteDocument = async (id: string) => {
      if(!consortium) return;
      await deleteDocument(consortium.id, id);
      setDocuments(documents.filter(d => d.id !== id));
      queryClient.invalidateQueries({ queryKey: ['documents', consortium.id] });
  };

  const handleAddReserveTransaction = async (t: Omit<ReserveTransaction, 'id'>) => {
      if(!consortium) return;
      const created = await addReserveTransaction(consortium.id, t);
      setReserveTransactions([...reserveTransactions, created as ReserveTransaction]);
      queryClient.invalidateQueries({ queryKey: ['reserve', consortium.id] });
  };

  const handleDeleteReserveTransaction = async (id: string) => {
      if(!consortium) return;
      await deleteReserveTransaction(consortium.id, id);
      setReserveTransactions(reserveTransactions.filter(t => t.id !== id));
      queryClient.invalidateQueries({ queryKey: ['reserve', consortium.id] });
  };

  const menuBadges = useMemo(() => {
      const badges: { [key: string]: number } = {};
      if (userRole === 'ADMIN') {
          const pendingCount = payments.filter(p => p.status === 'PENDING').length;
          if (pendingCount > 0) badges['management'] = pendingCount;
          const pendingMaintenance = maintenanceRequests.filter(m => m.status === 'PENDING').length;
          if (pendingMaintenance > 0) badges['maintenance'] = pendingMaintenance;
      }
      const urgentCount = announcements.filter(a => a.priority === 'HIGH').length;
      if (urgentCount > 0) badges['announcements'] = urgentCount;
      return badges;
  }, [payments, announcements, maintenanceRequests, userRole]);

  if (!user || (!consortium && userRole !== 'ADMIN')) {
    return (
      <AuthView 
        isAuthenticated={!!user} onLoginSuccess={handleLoginSuccess}
        onSelectConsortium={handleSelectConsortium} consortiums={consortiumList}
        onCreateConsortium={handleCreateConsortium} onLogout={handleLogout}
        userRole={userRole} userEmail={user?.email || ''}
      />
    );
  }
  if (!consortium) {
       return (
        <AuthView 
            isAuthenticated={!!user} onLoginSuccess={handleLoginSuccess}
            onSelectConsortium={handleSelectConsortium} consortiums={consortiumList}
            onCreateConsortium={handleCreateConsortium} onLogout={handleLogout}
            userRole={userRole} userEmail={user?.email || ''}
        />
       );
  }

  const computedReserveBalance = Math.round(reserveTransactions.reduce((acc, t) => acc + t.amount, 0) * 100) / 100;
  const effectiveSettings = { ...settings, reserveFundBalance: computedReserveBalance };

  return (
    <div className="flex h-screen bg-slate-100 flex-col md:flex-row">
      <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between shadow-md z-20">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-300 hover:text-white"><Menu className="w-6 h-6" /></button>
          <span className="font-bold truncate">{consortium.name}</span><div className="w-6"></div>
      </div>

      <Sidebar 
        currentView={view} onChangeView={handleSetViewSafe} consortiumName={consortium.name} 
        onSwitchConsortium={handleSwitchConsortium} onLogout={handleLogout} 
        userRole={userRole} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} badges={menuBadges}
      />
      
      <main className="flex-1 overflow-y-auto p-4 md:p-8 md:ml-64 h-[calc(100vh-64px)] md:h-screen">
        <div className="max-w-7xl mx-auto pb-20 md:pb-0">
          {loading && (
              <div className="flex items-center justify-center p-12 text-slate-500 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  <span>Cargando datos del consorcio...</span>
              </div>
          )}

          <Suspense fallback={
              <div className="flex items-center justify-center p-12 text-slate-500 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  <span>Cargando módulo...</span>
              </div>
          }>
            {!loading && view === 'dashboard' && <Dashboard units={units} expenses={expenses} payments={payments} history={history} settings={effectiveSettings} reserveHistory={[]} userRole={userRole} consortiumId={consortium.id} onDataReset={() => {}} />}
            
            {!loading && view === 'announcements' && <AnnouncementsView announcements={announcements} units={units} onAdd={handleAddAnnouncement} onDelete={handleDeleteAnnouncement} />}
            {!loading && view === 'documents' && <DocumentsView documents={documents} userRole={userRole} onAdd={handleAddDocument} onDelete={handleDeleteDocument} />}
            {!loading && view === 'maintenance' && <MaintenanceView requests={maintenanceRequests} units={units} userRole={userRole} userEmail={user.email} onAdd={handleAddMaintenance} onUpdate={handleUpdateMaintenance} onDelete={handleDeleteMaintenance} />}
            {!loading && view === 'amenities' && <AmenitiesView amenities={amenities} bookings={bookings} units={units} userRole={userRole} userEmail={user.email} onAddAmenity={handleAddAmenity} onDeleteAmenity={handleDeleteAmenity} onAddBooking={handleAddBooking} onDeleteBooking={handleDeleteBooking} />}
            
            {!loading && view === 'expenses' && userRole === 'ADMIN' && <ExpensesView expenses={expenses} setExpenses={setExpenses} reserveBalance={effectiveSettings.reserveFundBalance} consortiumId={consortium.id} units={units} />}
            
            {!loading && view === 'history' && <HistoryView history={history} consortium={consortium} units={units} settings={effectiveSettings} />}
            
            {!loading && view === 'user_portal' && (
              <UserPortal userEmail={user.email} consortium={consortium} units={units} expenses={expenses} history={history} payments={payments} settings={effectiveSettings} announcements={announcements} myBookings={bookings} myTickets={maintenanceRequests} documents={documents} onReportPayment={handleReportPayment} />
            )}
            
            {!loading && view === 'accounting' && userRole === 'ADMIN' && (
              <AccountingView 
                  units={units} expenses={expenses} setExpenses={setExpenses} 
                  history={history} settings={effectiveSettings} payments={payments} 
                  consortiumId={consortium.id} consortiumName={consortium.name} 
                  consortium={consortium}
                  reserveTransactions={reserveTransactions}
                  onAddReserveTransaction={handleAddReserveTransaction}
                  onDeleteReserveTransaction={handleDeleteReserveTransaction}
                  onRefreshReserve={handleRefreshReserve}
                  onUpdateBankSettings={(newBankData) => handleUpdateSettings({...effectiveSettings, ...newBankData})} 
                  onCloseMonth={handleCloseMonth} 
              />
            )}

            {!loading && view === 'management' && userRole === 'ADMIN' && (
              <ManagementView 
                  units={units} setUnits={setUnits} consortiumId={consortium.id}
                  history={history} payments={payments} consortium={consortium}
                  settings={effectiveSettings}
                  onUpdateUnit={handleUpdateUnit} onAddPayment={handleAdminAddPayment} onUpdateStatus={handlePaymentStatusChange}
                  onDeletePayment={handleDeletePayment} 
              />
            )}

            {!loading && view === 'collections' && userRole === 'ADMIN' && (
              <CollectionsView 
                  payments={payments} units={units} history={history} 
                  settings={effectiveSettings}
                  onAddPayment={handleAdminAddPayment} onUpdateStatus={handlePaymentStatusChange} 
                  onUpdateUnit={handleUpdateUnit} onDeletePayment={handleDeletePayment} 
              />
            )}
            
            {!loading && view === 'settings' && userRole === 'ADMIN' && <SettingsView currentSettings={effectiveSettings} onSave={handleUpdateSettings} />}
            {!loading && view === 'profile' && <ProfileView userEmail={user.email} userRole={userRole} onLogout={handleLogout} />}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
export default App;