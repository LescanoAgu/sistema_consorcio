
export enum ExpenseDistributionType {
  PRORATED = 'PRORATED', // Segun porcentaje
  EQUAL_PARTS = 'EQUAL_PARTS', // Partes iguales
  FROM_RESERVE = 'FROM_RESERVE' // Sale del fondo, no se cobra
}

export type UserRole = 'DEV' | 'ADMIN' | 'USER';

export interface Unit {
  id: string;
  unitNumber: string;
  ownerName: string;
  linkedEmail?: string; // Para vincular el login de usuario
  proratePercentage: number; 
  initialBalance: number; // Saldo inicial (deuda previa o saldo a favor)
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  distributionType: ExpenseDistributionType;
  category: 'Ordinary' | 'Extraordinary';
  itemCategory: string; // New: Specific category (e.g. Mantenimiento, Servicios)
  attachmentUrl?: string; // New: PDF/Image link
}

export interface Payment {
  id: string;
  unitId: string;
  amount: number;
  date: string;
  method: 'Transferencia' | 'Efectivo' | 'Cheque';
  notes?: string;
  attachmentUrl?: string; // New: Proof of payment
}

// New: For Interest or Penalties
export interface DebtAdjustment {
  id: string;
  unitId: string;
  amount: number; // Positive increases debt
  date: string;
  description: string; // e.g. "Interés por mora Mayo 5%"
}

export interface SettlementRecord {
  id: string;
  month: string;
  dateClosed: string;
  totalExpenses: number;
  totalCollected: number; // The target amount to collect
  reserveBalanceStart: number;
  reserveContribution: number;
  reserveExpense: number;
  reserveBalanceAtClose: number;
  snapshotExpenses: Expense[]; // Snapshot of expenses for that month
  aiReportSummary?: string;
  // Snapshot of what each unit had to pay in this settlement
  unitDetails: { unitId: string; totalToPay: number }[]; 
}

// New: Reserve Fund History
export interface ReserveTransaction {
    id: string;
    date: string;
    amount: number; // Positive = Income, Negative = Expense
    description: string; // e.g. "Aporte Expensas Mayo", "Gasto Reparación Bomba"
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

export type ViewState = 'dashboard' | 'units' | 'expenses' | 'settlement' | 'collections' | 'history' | 'debtors' | 'user_portal';
