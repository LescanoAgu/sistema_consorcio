
import React, { useState } from 'react';
import { SettlementRecord, Unit } from '../types';
import { ChevronDown, ChevronRight, FileText, Calendar, Download } from 'lucide-react';
import { generateSettlementPDF } from '../services/pdfService';

interface HistoryViewProps {
  history: SettlementRecord[];
  consortiumName: string;
  units: Unit[];
}

const HistoryView: React.FC<HistoryViewProps> = ({ history, consortiumName, units }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleDownloadPDF = (e: React.MouseEvent, record: SettlementRecord) => {
    e.stopPropagation(); // Prevent toggling expand
    generateSettlementPDF(record, consortiumName, units);
  };

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400">
          <HistoryIcon className="w-16 h-16 mb-4 opacity-20" />
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
                
                <div className="flex items-center gap-4 md:gap-8">
                     <div className="text-right hidden md:block">
                        <p className="text-xs text-slate-500 uppercase">Total Gastos</p>
                        <p className="font-bold text-slate-700">${record.totalExpenses.toFixed(2)}</p>
                    </div>
                    <div className="text-right hidden md:block">
                        <p className="text-xs text-slate-500 uppercase">A Recaudar</p>
                        <p className="font-bold text-slate-700">${record.totalCollected.toFixed(2)}</p>
                    </div>
                    
                    <button 
                        onClick={(e) => handleDownloadPDF(e, record)}
                        className="p-2 bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-600 rounded-lg transition-colors group"
                        title="Descargar PDF"
                    >
                        <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </button>

                    {expandedId === record.id ? <ChevronDown className="text-slate-400"/> : <ChevronRight className="text-slate-400"/>}
                </div>
            </div>

            {expandedId === record.id && (
                <div className="border-t border-slate-100 bg-slate-50 p-6 animate-fade-in">
                    
                    {record.aiReportSummary && (
                        <div className="mb-6 bg-white p-4 rounded-lg border border-indigo-100">
                            <h4 className="text-xs font-bold text-indigo-500 uppercase mb-2 flex items-center">
                                <FileText className="w-3 h-3 mr-1" /> Resumen IA
                            </h4>
                            <p className="text-sm text-slate-600 whitespace-pre-line">{record.aiReportSummary}</p>
                        </div>
                    )}

                    <h4 className="text-sm font-bold text-slate-700 uppercase mb-3">Detalle de Gastos</h4>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left bg-white rounded-lg border border-slate-200">
                            <thead className="bg-slate-100 text-slate-500">
                                <tr>
                                    <th className="px-4 py-2">Fecha</th>
                                    <th className="px-4 py-2">Descripción</th>
                                    <th className="px-4 py-2">Rubro</th>
                                    <th className="px-4 py-2">Categoría</th>
                                    <th className="px-4 py-2 text-right">Monto</th>
                                    <th className="px-4 py-2 text-center">Adjunto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {record.snapshotExpenses.map(exp => (
                                    <tr key={exp.id} className="border-b border-slate-100 last:border-0">
                                        <td className="px-4 py-2 text-slate-500">{exp.date}</td>
                                        <td className="px-4 py-2 font-medium text-slate-700">{exp.description}</td>
                                        <td className="px-4 py-2 text-slate-600">{exp.itemCategory || '-'}</td>
                                        <td className="px-4 py-2">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${exp.category === 'Ordinary' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                {exp.category === 'Ordinary' ? 'Ordinario' : 'Extraordinario'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-right font-medium">${exp.amount.toFixed(2)}</td>
                                        <td className="px-4 py-2 text-center text-xs text-indigo-600">
                                            {exp.attachmentUrl ? 'Ver PDF' : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const HistoryIcon = (props: any) => (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="M3 3v5h5"/>
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
      <path d="M12 7v5l4 2"/>
    </svg>
)

export default HistoryView;
