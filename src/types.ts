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
  liquidacionId?: string | null; // <--- AGREGADO: Para saber si ya se cobró
}

export interface SettlementRecord {
  id: string;
  month: string;
  dateClosed: string;
  totalExpenses: number;
  totalCollected: number;
  reserveBalanceAtClose: number;
  snapshotExpenses: Expense[];
  unitDetails: any[]; 
  aiReportSummary?: string;
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

// Interfaces adicionales que puedas necesitar...
export interface Payment { id: string; unitId: string; amount: number; date: string; method: string; }
export interface DebtAdjustment { id: string; unitId: string; amount: number; description: string; date: string; }
export interface ReserveTransaction { id: string; date: string; amount: number; description: string; balanceAfter: number; }
export type ViewState = 'dashboard' | 'units' | 'expenses' | 'settlement' | 'collections' | 'history' | 'debtors' | 'user_portal';