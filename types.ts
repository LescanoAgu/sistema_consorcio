export enum ExpenseDistributionType {
  PRORATED = 'PRORATED',
  EQUAL_PARTS = 'EQUAL_PARTS',
  FROM_RESERVE = 'FROM_RESERVE'
}

/**
 * Roles del sistema:
 * - ADMIN: Administrador de consorcio con acceso total a gestión, contabilidad, cobros, etc.
 * - USER: Copropietario / Inquilino con acceso al portal de vecino (cupones, expensas, amenidades, etc.).
 * - DEVICE: Dispositivos de hardware genéricos IoT (porteros IP, cámaras, lectores de tarjetas).
 * - CONTROL_WIFI: Dispositivos de hardware específicos para control de acceso WiFi (relés ESP32, portones, molinetes).
 */
export type UserRole = 'ADMIN' | 'USER' | 'DEVICE' | 'CONTROL_WIFI';
export type MaintenanceStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE';

export interface ConsortiumDocument {
  id: string;
  title: string;
  category: 'Reglamento' | 'Acta' | 'Aviso' | 'Otro';
  url: string;
  date: string;
}

export interface Amenity {
  id: string;
  name: string;
  description: string;
  capacity: number;
  requiresApproval: boolean;
}

export interface Booking {
  id: string;
  amenityId: string;
  unitId: string;
  unitNumber: string;
  date: string;
  timeSlot: string;
  status: 'CONFIRMED' | 'PENDING' | 'REJECTED';
  createdAt: string;
}

/**
 * Registro individual en el historial evolutivo de intereses (Kárdex matricial).
 */
export interface InterestLog {
  dateApplied: string;
  rate: number;
  addedAmount: number;
  currentTotal: number;
}

/**
 * Item individual de deuda por período mensual.
 * Permite mantener la deuda separada por mes (Ej: Enero $50k, Febrero $60k),
 * imputar pagos a la más antigua y calcular interés simple sobre el baseAmount de cada período.
 */
export interface DebtItem {
  id: string;
  period: string;       
  baseAmount: number;   
  ordinaryAmount?: number;
  extraordinaryAmount?: number;
  reserveAmount?: number;
  interestRate: number; 
  interestAmount: number; 
  total: number;
  paidAmount?: number;
  createdAt?: string;
  interestLogs?: InterestLog[];
}

export interface Unit {
  id: string;
  block?: string; // NUEVO: Sector, Complejo o Torre (Ej: "Norte", "Sur")
  unitNumber: string;
  ownerName: string;
  authorizedEmails: string[]; 
  proratePercentage: number; 
  initialBalance: number; 
  creditBalance?: number; // Saldo a favor por pagos a cuenta / excedentes
  debts?: DebtItem[]; 
  isOccupied?: boolean; // Indica si la unidad está ocupada / alquilada
  contributesToReserve?: boolean; // Indica si aporta al Fondo de Reserva (default: true si está alquilada)
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  distributionType: ExpenseDistributionType;
  category: 'Ordinary' | 'Extraordinary';
  itemCategory: string; 
  attachmentUrl?: string; 
  liquidacionId?: string | null;
  affectedUnitIds?: string[]; 
}

export interface Payment {
  id: string;
  unitId: string;
  amount: number;
  date: string;
  method: 'Transferencia' | 'Efectivo' | 'Cheque';
  notes?: string;
  attachmentUrl?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  allocations?: {
    period: string;
    amount: number;
    basePaid?: number;
    interestPaid?: number;
    reservePaid?: number;
  }[];
  reserveContribution?: number;
  creditGenerated?: number;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  priority: 'NORMAL' | 'HIGH';
}

export interface MaintenanceRequest {
  id: string;
  unitId: string;
  title: string;
  description: string;
  status: MaintenanceStatus;
  date: string;
  photos?: string[];
  adminResponse?: string;
}

export interface ConsortiumSettings {
  reserveFundBalance: number;
  monthlyReserveContributionPercentage: number;
  interestRate: number;
  bankName: string;
  bankCBU: string;
  bankAlias: string;
  bankHolder: string;
  bankCuit: string;
  address?: string;
  cuit?: string; 
  adminName?: string;
  logoUrl?: string;
  showBankDetailsOnCoupon?: boolean; // Opción para mostrar u ocultar CBU/Alias en el cupón
}

export interface SettlementRecord {
  id: string;
  month: string;
  dateClosed: string;
  totalExpenses: number;
  totalCollected: number;
  reserveBalanceStart: number;
  reserveContribution: number;
  reserveExpense: number;
  reserveBalanceAtClose: number;
  firstExpirationDate?: string;
  secondExpirationDate?: string;
  snapshotExpenses: Expense[];
  snapshotPayments?: Payment[];
  couponMessage?: string;
  unitDetails: {
    unitId: string;
    totalToPay: number;
    ordinaryAmount?: number;
    extraordinaryAmount?: number;
    reserveAmount?: number;
    creditApplied?: number;
  }[]; 
}

export interface ReserveTransaction {
    id: string;
    date: string;
    amount: number; 
    description: string; 
    type: 'SYSTEM' | 'MANUAL' | 'INITIAL';
    paymentId?: string;
    expenseId?: string;
}

export interface Consortium {
  id: string;
  name: string;
  address: string;
  cuit?: string;
  image?: string;
  adminIds?: string[];
}

export interface AppSettings {
  reserveFundBalance: number;
  monthlyReserveContributionPercentage: number;
}

export interface ExpenseTemplate {
  id: string;
  alias: string;
  description: string;
  amount: number;
  category: 'Ordinary' | 'Extraordinary';
  itemCategory: string;
  distributionType: ExpenseDistributionType;
  affectedUnitIds?: string[]; 
}

export interface JoinRequest {
  id: string;
  userEmail: string;
  firstName: string; 
  lastName: string;  
  message: string;   
  consortiumId: string;
  consortiumName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  date: string;
}

export type ViewState = 'dashboard' | 'units' | 'expenses' | 'settlement' | 'collections' | 'history' | 'debtors' | 'user_portal' | 'settings' | 'announcements' | 'maintenance' | 'amenities' | 'profile' | 'documents' | 'management' | 'accounting';