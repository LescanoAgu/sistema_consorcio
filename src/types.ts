export type UserRole = 'ADMIN' | 'USER' | 'DEV';

export enum ExpenseDistributionType {
  PRORATED = 'PRORATED',
  EQUAL_PARTS = 'EQUAL_PARTS',
  FROM_RESERVE = 'FROM_RESERVE'
}

export interface Unit {
  id: string;
  unitNumber: string;
  ownerName: string;
  proratePercentage: number;
  initialBalance: number;
  linkedEmail?: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: 'Ordinary' | 'Extraordinary';
  distributionType: ExpenseDistributionType;
  itemCategory?: string;
  attachmentUrl?: string;
  liquidacionId?: string | null;
}

export interface SettlementRecord {
  id: string;
  month: string;
  dateClosed: string;
  
  // Totales Generales
  totalExpenses: number;
  totalCollected: number;
  
  // --- DESGLOSE FONDO DE RESERVA ---
  reserveBalanceStart: number;      // Saldo al inicio del mes
  reserveContribution: number;      // Aporte recaudado (ej: 5%)
  reserveExpense: number;           // Gastos pagados con el fondo
  reserveBalanceAtClose: number;    // Saldo final (Start + Contrib - Expense)
  // --------------------------------

  // Datos guardados (Snapshot)
  snapshotExpenses: Expense[];
  aiReportSummary?: string;
  unitDetails: {
      unitId: string;
      totalToPay: number;
  }[]; 
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

export interface Payment { 
  id: string; 
  unitId: string; 
  amount: number; 
  date: string; 
  method: string;
  notes?: string;
  attachmentUrl?: string;
}

export interface DebtAdjustment { 
  id: string; 
  unitId: string; 
  amount: number; 
  description: string; 
  date: string; 
}

export interface ReserveTransaction { 
  id: string; 
  date: string; 
  amount: number; 
  description: string; 
  balanceAfter: number; 
}

export type ViewState = 'dashboard' | 'units' | 'expenses' | 'settlement' | 'collections' | 'history' | 'debtors' | 'user_portal';