export enum ExpenseDistributionType {
  PRORATED = 'PRORATED',
  EQUAL_PARTS = 'EQUAL_PARTS',
  FROM_RESERVE = 'FROM_RESERVE'
}

export type UserRole = 'DEV' | 'ADMIN' | 'USER';
export type MaintenanceStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE';

// --- NUEVO: Espacios Comunes y Reservas ---
export interface Amenity {
  id: string;
  name: string; // Ej: "Quincho", "SUM"
  description: string;
  capacity: number;
  requiresApproval: boolean; // Si requiere ok del admin
}

export interface Booking {
  id: string;
  amenityId: string;
  unitId: string;
  unitNumber: string; // Para mostrar rápido quién reservó
  date: string; // YYYY-MM-DD
  timeSlot: string; // "Mediodía" | "Noche" | u horario específico
  status: 'CONFIRMED' | 'PENDING' | 'REJECTED';
  createdAt: string;
}

export interface Unit {
  id: string;
  unitNumber: string;
  ownerName: string;
  linkedEmail?: string;
  proratePercentage: number; 
  initialBalance: number; 
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
}

export interface DebtAdjustment {
  id: string;
  unitId: string;
  amount: number; 
  date: string;
  description: string; 
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
  bankName: string;
  bankCBU: string;
  bankAlias: string;
  bankHolder: string;
  bankCuit: string;
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
  reserveDeficitCovered?: number;

  firstExpirationDate?: string;
  secondExpirationDate?: string;
  secondExpirationSurcharge?: number;

  snapshotExpenses: Expense[];
  aiReportSummary?: string;
  couponMessage?: string;
  unitDetails: { unitId: string; totalToPay: number }[]; 
}

export interface ReserveTransaction {
    id: string;
    date: string;
    amount: number; 
    description: string; 
    balanceAfter: number;
}

export interface Consortium {
  id: string;
  name: string;
  address: string;
  cuit?: string;
  image?: string;
}

export interface AppSettings {
  reserveFundBalance: number;
  monthlyReserveContributionPercentage: number;
}

// Agregamos 'amenities' a las vistas
export type ViewState = 'dashboard' | 'units' | 'expenses' | 'settlement' | 'collections' | 'history' | 'debtors' | 'user_portal' | 'settings' | 'announcements' | 'maintenance' | 'amenities';