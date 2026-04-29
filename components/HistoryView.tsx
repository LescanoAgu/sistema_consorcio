import React, { useState, useMemo } from 'react';
import { SettlementRecord, Unit, ConsortiumSettings, Consortium } from '../types';
import { ChevronDown, ChevronRight, Calendar, Download, User, FolderArchive } from 'lucide-react';
import { generateSettlementPDF, generateIndividualCouponPDF } from '../services/pdfService';

interface HistoryViewProps {
  history: SettlementRecord[];
  consortium: Consortium; 
  units: Unit[];
  settings: ConsortiumSettings; 
}

const HistoryView: React.FC<HistoryViewProps> = ({ history, consortium, units, settings }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Por defecto, dejamos abierto el año en el que estamos actualmente
  const [expandedYears, setExpandedYears] = useState<string[]>([new Date().getFullYear().toString()]); 

  // --- MOTOR DE ORDENAMIENTO Y AGRUPACIÓN POR AÑO ---
  const { sortedHistory, groupedByYear, years } = useMemo(() => {
      // 1. Ordenamos por fecha de cierre exacta (El más reciente primero)
      const sorted = [...history].sort((a, b) => new Date(b.dateClosed).getTime() - new Date(a.dateClosed).getTime());

      // 2. Agrupamos en un objeto donde la llave es el AÑO
      const grouped = sorted.reduce((acc, record) => {
          const year = new Date(record.dateClosed).getFullYear().toString();
          if (!acc[year]) acc[year] = [];
          acc[year].push(record);
          return acc;
      }, {} as Record<string, SettlementRecord[]>);

      // 3. Extraemos los años y los ordenamos (2026, 2025, 2024...)
      const y = Object.keys(grouped).sort((a, b) => Number(b) - Number(a));

      return { sortedHistory: sorted, groupedByYear: grouped, years: y };
  }, [history]);

  const toggleExpandRecord = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const toggleExpandYear = (year: string) => {
      if (expandedYears.includes(year)) {
          setExpandedYears(expandedYears.filter(y => y !== year)); // Cerrar
      } else {
          setExpandedYears([...expandedYears, year]); // Abrir
      }
  };

  const handleDownloadGeneral = (e: React.MouseEvent, record: SettlementRecord) => {
    e.stopPropagation();
    generateSettlementPDF(record, consortium, units);
  };

  const handleDownloadCoupon = (e: React.MouseEvent, record: SettlementRecord, unitId: string) => {
      e.stopPropagation();
      const unit = units.find(u => u.id === unitId);
      if (unit) {
          generateIndividualCouponPDF(record, unit, consortium);
      }
  };

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] text-slate-400 bg-white rounded-xl shadow-sm border border-slate-200">
          <FolderArchive className="w-16 h-16 mb-4 opacity-20" />
          <h3 className="text-lg font-bold text-slate-700">No hay historial</h3>
          <p>Aún no se han cerrado liquidaciones en este consorcio.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <FolderArchive className="w-6 h-6 text-indigo-600"/> Archivo Histórico
            </h2>
            <p className="text-slate-500 text-sm">Liquidaciones cerradas y cupones ordenados por año.</p>
          </div>
      </div>

      <div className="space-y-6">
        {years.map(year => (
          <div key={year} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            
            {/* CABECERA DEL AÑO */}
            <button 
                onClick={() => toggleExpandYear(year)}
                className="w-full flex justify-between items-center p-5 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-200"
            >
                <div className="flex items-center gap-3">
                    {expandedYears.includes(year) ? <ChevronDown className="w-5 h-5 text-indigo-600" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                    <h3 className="text-xl font-black text-slate-800">Año {year}</h3>
                    <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-lg border border-indigo-200">
                        {groupedByYear[year].length} liquidaciones
                    </span>
                </div>
            </button>

            {/* LISTA DE LIQUIDACIONES DE ESE AÑO */}
            {expandedYears.includes(year) && (
                <div className="divide-y divide-slate-100">
                    {groupedByYear[year].map(record => (
                        <div key={record.id} className="flex flex-col">
                            
                            {/* FILA DE LA LIQUIDACIÓN */}
                            <div 
                                className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${expandedId === record.id ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}
                                onClick={() => toggleExpandRecord(record.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-xl transition-colors ${expandedId === record.id ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                        <Calendar className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-lg uppercase tracking-wide">{record.month}</h4>
                                        <p className="text-xs text-slate-500 font-medium">Cierre oficial: {new Date(record.dateClosed).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monto Distribuido</p>
                                        <p className="font-black text-slate-700">${record.totalExpenses.toLocaleString('es-AR', {minimumFractionDigits: 2})}</p>
                                    </div>
                                    <button 
                                        onClick={(e) => handleDownloadGeneral(e, record)}
                                        className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-lg text-sm font-bold hover:bg-indigo-50 transition-colors shadow-sm"
                                        title="Descargar Expensa General"
                                    >
                                        <Download className="w-4 h-4" /> General
                                    </button>
                                </div>
                            </div>

                            {/* DESPLEGABLE CON CUPONES INDIVIDUALES */}
                            {expandedId === record.id && (
                                <div className="bg-slate-50 p-6 border-t border-slate-100">
                                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <User className="w-4 h-4 text-indigo-400"/> Cupones Individuales de {record.month}
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                        {record.unitDetails?.map(detail => {
                                            const unit = units.find(u => u.id === detail.unitId);
                                            return (
                                                <div key={detail.unitId} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-300 transition-all group">
                                                    <div className="truncate pr-2">
                                                        <p className="font-bold text-slate-800 text-sm truncate">{unit?.unitNumber} - {unit?.ownerName}</p>
                                                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                                                            Total Cuota: <span className="font-bold text-emerald-600">${detail.totalToPay.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                                                        </p>
                                                    </div>
                                                    <button 
                                                        onClick={(e) => handleDownloadCoupon(e, record, detail.unitId)}
                                                        className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex-shrink-0"
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
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryView;