import React, { useState } from 'react';
import { Unit, SettlementRecord, Payment, DebtAdjustment, Consortium } from '../types';
import CollectionsView from './CollectionsView';
import DebtorsView from './DebtorsView';
import UnitsView from './UnitsView';
import { Wallet, AlertTriangle, Users, LayoutTemplate } from 'lucide-react';

interface ManagementViewProps {
  units: Unit[];
  setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
  consortiumId: string;
  history: SettlementRecord[];
  payments: Payment[];
  debtAdjustments: DebtAdjustment[];
  consortium: Consortium;
  onUpdateUnit: (id: string, updates: Partial<Unit>) => Promise<void>;
  onAddPayment: (p: Omit<Payment, 'id'>) => Promise<void>;
  onUpdateStatus: (id: string, s: 'APPROVED' | 'REJECTED') => Promise<void>;
  onDeletePayment: (id: string) => Promise<void>; // NUEVO
}

const ManagementView: React.FC<ManagementViewProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'COBROS' | 'DEUDAS' | 'UNIDADES'>('COBROS');

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-3">
                <LayoutTemplate className="w-8 h-8 text-indigo-400" />
                Gestión Integral
            </h1>
            <p className="text-slate-400 mt-1">Administración centralizada de cobros, morosidad y datos de unidades.</p>
          </div>
          
          <div className="flex bg-slate-800 p-1.5 rounded-xl w-full md:w-auto">
              <button 
                  onClick={() => setActiveTab('COBROS')} 
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'COBROS' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
              >
                  <Wallet className="w-4 h-4"/> Cobros
              </button>
              <button 
                  onClick={() => setActiveTab('DEUDAS')} 
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'DEUDAS' ? 'bg-red-500 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
              >
                  <AlertTriangle className="w-4 h-4"/> Deudas
              </button>
              <button 
                  onClick={() => setActiveTab('UNIDADES')} 
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'UNIDADES' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
              >
                  <Users className="w-4 h-4"/> Unidades
              </button>
          </div>
      </div>

      <div className="animate-fade-in">
          {activeTab === 'COBROS' && (
              <CollectionsView 
                  payments={props.payments} 
                  units={props.units} 
                  history={props.history} 
                  debtAdjustments={props.debtAdjustments} 
                  onAddPayment={props.onAddPayment} 
                  onUpdateStatus={props.onUpdateStatus} 
              />
          )}
          {activeTab === 'DEUDAS' && (
              <DebtorsView 
                  units={props.units} 
                  history={props.history} 
                  payments={props.payments} 
                  consortium={props.consortium} 
                  onUpdateUnit={props.onUpdateUnit} 
              />
          )}
          {activeTab === 'UNIDADES' && (
              <UnitsView 
                  units={props.units} 
                  setUnits={props.setUnits} 
                  consortiumId={props.consortiumId} 
                  payments={props.payments}
                  history={props.history}
                  consortium={props.consortium}
                  onUpdateUnit={props.onUpdateUnit} // NUEVO
                  onDeletePayment={props.onDeletePayment} // NUEVO
              />
          )}
      </div>
    </div>
  );
};

export default ManagementView;