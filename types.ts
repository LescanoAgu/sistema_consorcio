export enum ExpenseDistributionType {
  PRORATED = 'PRORATED',
  EQUAL_PARTS = 'EQUAL_PARTS',
  FROM_RESERVE = 'FROM_RESERVE'
}

export type UserRole = 'DEV' | 'ADMIN' | 'USER';

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
}

export interface DebtAdjustment {
  id: string;
  unitId: string;
  amount: number; 
  date: string;
  description: string; 
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

export type ViewState = 'dashboard' | 'units' | 'expenses' | 'settlement' | 'collections' | 'history' | 'debtors' | 'user_portal' | 'settings';