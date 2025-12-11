import React, { useState } from 'react';
import { SettlementRecord, Unit, ConsortiumSettings } from '../types';
import { ChevronDown, ChevronRight, FileText, Calendar, Download, User } from 'lucide-react';
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
          <h3 className="text-lg font-medium">No hay historial disponible</h3>
          <p className="text-sm">Cierre una liquidación mensual para verla aquí.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Historial de Liquidaciones</h2>
      
      <div className="space-y-4">
        {history.map((record) => (
          <div key={record.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            
            <div 
                className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleExpand(record.id)}
            >
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-100 p-3 rounded-full text-indigo-600">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">{record.month}</h3>
                        <p className="text-sm text-slate-500">Cerrado el: {new Date(record.dateClosed).toLocaleDateString()}</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                        <p className="text-xs text-slate-500 uppercase">Total Expensas</p>
                        <p className="font-bold text-slate-700">${record.totalCollected.toFixed(2)}</p>
                    </div>
                    
                    <button 
                        onClick={(e) => handleDownloadGeneral(e, record)}
                        className="flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium border border-indigo-200"
                        title="Descargar Resumen General"
                    >
                        <FileText className="w-4 h-4 mr-2" />
                        Resumen General
                    </button>

                    {expandedId === record.id ? <ChevronDown className="text-slate-400"/> : <ChevronRight className="text-slate-400"/>}
                </div>
            </div>

            {expandedId === record.id && (
                <div className="border-t border-slate-100 bg-slate-50 p-6 animate-fade-in">
                    
                    <h4 className="text-sm font-bold text-slate-700 uppercase mb-4 flex items-center">
                        <User className="w-4 h-4 mr-2"/>
                        Cupones Individuales (Privados)
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {record.unitDetails.map(detail => {
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