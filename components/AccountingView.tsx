import React, { useState } from 'react';
import { Unit, Expense, SettlementRecord, ConsortiumSettings, Consortium, ReserveTransaction } from '../types';
import ExpensesView from './ExpensesView';
import SettlementView from './SettlementView';
import HistoryView from './HistoryView';
import ReserveView from './ReserveView';
import { Calculator, Receipt, History as HistoryIcon, PieChart, Vault } from 'lucide-react';

interface AccountingViewProps {
  units: Unit[];
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  history: SettlementRecord[];
  settings: ConsortiumSettings;
  consortiumId: string;
  consortiumName: string;
  consortium: Consortium; 
  reserveTransactions: ReserveTransaction[]; 
  onAddReserveTransaction: (t: Omit<ReserveTransaction, 'id'>) => Promise<void>; 
  onDeleteReserveTransaction: (id: string) => Promise<void>; 
  updateReserveBalance: (val: number) => void;
  onUpdateBankSettings: (newBankData: any) => void;
  onCloseMonth: (record: SettlementRecord) => Promise<void>;
}

const AccountingView: React.FC<AccountingViewProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'GASTOS' | 'LIQUIDACION' | 'HISTORIAL' | 'RESERVA'>('GASTOS');

  const handleChangeView = (view: string) => {
      if (view === 'history') setActiveTab('HISTORIAL');
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-3">
                <PieChart className="w-8 h-8 text-emerald-400" />
                Contabilidad y Liquidación
            </h1>
            <p className="text-slate-400 mt-1">Gestión de gastos, emisión de expensas, historial y libro de reservas.</p>
          </div>
          
          <div className="flex bg-slate-800 p-1.5 rounded-xl w-full xl:w-auto flex-wrap md:flex-nowrap">
              <button onClick={() => setActiveTab('GASTOS')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'GASTOS' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}>
                  <Receipt className="w-4 h-4"/> Gastos
              </button>
              <button onClick={() => setActiveTab('LIQUIDACION')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'LIQUIDACION' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}>
                  <Calculator className="w-4 h-4"/> Liquidación
              </button>
              <button onClick={() => setActiveTab('HISTORIAL')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'HISTORIAL' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}>
                  <HistoryIcon className="w-4 h-4"/> Historial
              </button>
              <button onClick={() => setActiveTab('RESERVA')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'RESERVA' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}>
                  <Vault className="w-4 h-4"/> Reserva
              </button>
          </div>
      </div>

      <div className="animate-fade-in">
          {activeTab === 'GASTOS' && <ExpensesView expenses={props.expenses} setExpenses={props.setExpenses} reserveBalance={props.settings.reserveFundBalance} consortiumId={props.consortiumId} units={props.units} />}
          {activeTab === 'LIQUIDACION' && <SettlementView units={props.units} expenses={props.expenses} settings={props.settings} setExpenses={props.setExpenses} consortiumId={props.consortiumId} consortiumName={props.consortiumName} updateReserveBalance={props.updateReserveBalance} onUpdateBankSettings={props.onUpdateBankSettings} onCloseMonth={props.onCloseMonth} onChangeView={handleChangeView as any} />}
          {activeTab === 'HISTORIAL' && <HistoryView history={props.history} consortium={props.consortium} units={props.units} settings={props.settings} />}
          {activeTab === 'RESERVA' && <ReserveView transactions={props.reserveTransactions} consortium={props.consortium} onAddTransaction={props.onAddReserveTransaction} onDeleteTransaction={props.onDeleteReserveTransaction} />}
      </div>
    </div>
  );
};

export default AccountingView;