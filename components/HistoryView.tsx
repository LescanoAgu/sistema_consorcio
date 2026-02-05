import React, { useState } from 'react';
import { SettlementRecord, Unit, ConsortiumSettings } from '../types';
import { ChevronDown, ChevronRight, FileText, Calendar, Download, User } from 'lucide-react';
// IMPORTANTE: Importamos los generadores
import { generateSettlementPDF, generateIndividualCouponPDF } from '../services/pdfService';

interface HistoryViewProps {
  history: SettlementRecord[];
  consortiumName: string;
  units: Unit[];
  settings: ConsortiumSettings; // <--- Agregado para recibir la configuración
}

const HistoryView: React.FC<HistoryViewProps> = ({ history, consortiumName, units, settings }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleDownloadGeneral = (e: React.MouseEvent, record: SettlementRecord) => {
    e.stopPropagation();
    // Pasamos settings al generador
    generateSettlementPDF(record, consortiumName, units, settings);
  };

  const handleDownloadCoupon = (e: React.MouseEvent, record: SettlementRecord, unitId: string) => {
      e.stopPropagation();
      // Pasamos settings al generador
      generateIndividualCouponPDF(record, unitId, consortiumName, units, settings);
  };

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400">
          <Calendar className="w-16 h-16 mb-4 opacity-20" />
          <h3 className="text-lg font-semibold">No hay historial</h3>
          <p>Aún no se han cerrado liquidaciones.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <FileText className="w-6 h-6 text-indigo-600"/> Historial de Liquidaciones
      </h2>
      <div className="space-y-4">
        {history.map(record => (
          <div key={record.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleExpand(record.id)}
            >
                <div className="flex items-center gap-4">
                    {expandedId === record.id ? <ChevronDown className="w-5 h-5 text-indigo-500"/> : <ChevronRight className="w-5 h-5 text-slate-400"/>}
                    <div>
                        <h3 className="font-bold text-slate-700">{record.month}</h3>
                        <p className="text-xs text-slate-500">Cerrado el {new Date(record.dateClosed).toLocaleDateString()}</p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right hidden md:block">
                        <p className="text-xs text-slate-400 uppercase">Total Gastos</p>
                        <p className="font-bold text-slate-700">${record.totalExpenses.toFixed(2)}</p>
                    </div>
                    <button 
                        onClick={(e) => handleDownloadGeneral(e, record)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-100 transition-colors"
                    >
                        <Download className="w-4 h-4" /> Expensa General
                    </button>
                </div>
            </div>

            {expandedId === record.id && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                        <User className="w-4 h-4"/> Cupones Individuales
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {record.unitDetails?.map(detail => {
                            const unit = units.find(u => u.id === detail.unitId);
                            return (
                                <div key={detail.unitId} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-indigo-300 transition-colors">
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{unit?.unitNumber} - {unit?.ownerName}</p>
                                        <p className="text-xs text-slate-500">A Pagar: <span className="font-semibold text-indigo-600">${detail.totalToPay.toFixed(2)}</span></p>
                                    </div>
                                    <button 
                                        onClick={(e) => handleDownloadCoupon(e, record, detail.unitId)}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                                        title="Descargar Cupón de Pago"
                                    >
                                        <Download className="w-5 h-5" />
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryView;