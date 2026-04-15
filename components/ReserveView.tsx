import React, { useState, useMemo } from 'react';
import { ReserveTransaction, Consortium } from '../types';
import { Plus, Download, Upload, Trash2, FileSpreadsheet, Vault, TrendingUp, TrendingDown } from 'lucide-react';
import { generateReserveLedgerPDF } from '../services/pdfService';
import * as XLSX from 'xlsx';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
};

interface ReserveViewProps {
  transactions: ReserveTransaction[];
  consortium: Consortium;
  onAddTransaction: (t: Omit<ReserveTransaction, 'id'>) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
}

const ReserveView: React.FC<ReserveViewProps> = ({ transactions, consortium, onAddTransaction, onDeleteTransaction }) => {
  const [showModal, setShowModal] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<'IN' | 'OUT'>('IN');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calcula el saldo arrastrado fila por fila
  const ledgerData = useMemo(() => {
      // Ordenamos por fecha ascendente (del más viejo al más nuevo)
      const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      let runningBalance = 0;
      return sorted.map(t => {
          runningBalance += t.amount;
          return { ...t, runningBalance };
      }).reverse(); // Lo invertimos para mostrar el más reciente arriba
  }, [transactions]);

  const currentBalance = ledgerData.length > 0 ? ledgerData[0].runningBalance : 0;

  const handleManualAdd = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newDesc || !newAmount) return;
      setIsSubmitting(true);
      try {
          let finalAmount = Math.abs(parseFloat(newAmount));
          if (type === 'OUT') finalAmount = -finalAmount;

          await onAddTransaction({
              date: newDate,
              description: newDesc,
              amount: finalAmount,
              type: 'MANUAL'
          });
          setShowModal(false);
          setNewDesc(''); setNewAmount('');
      } catch (error) {
          alert("Error al registrar el movimiento.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!confirm("Se importarán movimientos históricos al Fondo de Reserva. Asegúrese de tener columnas: 'Fecha', 'Concepto', 'Ingreso', 'Egreso'.")) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const bstr = evt.target?.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

              let count = 0;
              for (const row of (data as any[])) {
                  const desc = row['Concepto'] || row['Descripcion'];
                  const ingreso = parseFloat(row['Ingreso'] || 0);
                  const egreso = parseFloat(row['Egreso'] || 0);
                  const date = row['Fecha'] ? new Date(row['Fecha']).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

                  if (desc && (ingreso > 0 || egreso > 0)) {
                      await onAddTransaction({
                          date,
                          description: String(desc),
                          amount: ingreso > 0 ? ingreso : -egreso,
                          type: 'INITIAL'
                      });
                      count++;
                  }
              }
              alert(`¡Importación exitosa! Se cargaron ${count} movimientos al fondo.`);
          } catch (error) {
              alert("Error al procesar el Excel.");
          } finally {
              e.target.value = '';
          }
      };
      reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <Vault className="w-6 h-6 text-amber-500" /> Libro Mayor: Fondo de Reserva
              </h2>
              <p className="text-slate-500">Historial completo de ingresos y egresos de la caja de ahorro.</p>
          </div>
          <div className="text-right bg-white px-6 py-3 rounded-xl shadow-sm border border-amber-100">
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Saldo Actual Disponible</p>
              <p className={`text-2xl font-black ${currentBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(currentBalance)}
              </p>
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex gap-2">
                  <button onClick={() => generateReserveLedgerPDF(ledgerData, consortium)} className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors shadow-sm">
                      <Download className="w-4 h-4"/> Exportar PDF
                  </button>
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-bold hover:bg-emerald-100 transition-colors shadow-sm">
                      <FileSpreadsheet className="w-4 h-4"/> Importar Histórico
                      <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} />
                  </label>
              </div>
              <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 transition-colors shadow-sm shadow-amber-200">
                  <Plus className="w-4 h-4"/> Ajuste Manual
              </button>
          </div>

          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                      <tr>
                          <th className="px-6 py-4">Fecha</th>
                          <th className="px-6 py-4">Concepto</th>
                          <th className="px-6 py-4 text-right">Ingreso (+)</th>
                          <th className="px-6 py-4 text-right">Egreso (-)</th>
                          <th className="px-6 py-4 text-right">Saldo</th>
                          <th className="px-4 py-4 text-center">Acción</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {ledgerData.length === 0 && (
                          <tr><td colSpan={6} className="text-center py-12 text-slate-400">No hay movimientos registrados en el fondo de reserva.</td></tr>
                      )}
                      {ledgerData.map(t => (
                          <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-3 text-slate-500 font-medium w-32">{new Date(t.date).toLocaleDateString()}</td>
                              <td className="px-6 py-3 font-bold text-slate-700 flex items-center gap-2">
                                  {t.type === 'SYSTEM' && <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded uppercase">Sistema</span>}
                                  {t.description}
                              </td>
                              <td className="px-6 py-3 text-right font-bold text-emerald-600">
                                  {t.amount > 0 ? formatCurrency(t.amount) : '-'}
                              </td>
                              <td className="px-6 py-3 text-right font-bold text-red-600">
                                  {t.amount < 0 ? formatCurrency(Math.abs(t.amount)) : '-'}
                              </td>
                              <td className="px-6 py-3 text-right font-black text-slate-800 bg-slate-50">
                                  {formatCurrency(t.runningBalance)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                  {t.type !== 'SYSTEM' && (
                                      <button onClick={() => { if(confirm("¿Eliminar este registro? Alterará el saldo actual.")) onDeleteTransaction(t.id); }} className="text-slate-400 hover:text-red-500 p-1">
                                          <Trash2 className="w-4 h-4"/>
                                      </button>
                                  )}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>

      {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                  <div className="bg-amber-500 p-4 text-white flex justify-between items-center">
                      <h3 className="font-bold flex items-center gap-2"><Vault className="w-5 h-5"/> Ajuste Manual de Reserva</h3>
                  </div>
                  <form onSubmit={handleManualAdd} className="p-6 space-y-4">
                      <div className="flex gap-2 p-1 bg-slate-100 rounded-lg mb-4">
                          <button type="button" onClick={() => setType('IN')} className={`flex-1 py-2 flex items-center justify-center gap-2 text-sm font-bold rounded-md transition-all ${type === 'IN' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>
                              <TrendingUp className="w-4 h-4"/> Ingreso
                          </button>
                          <button type="button" onClick={() => setType('OUT')} className={`flex-1 py-2 flex items-center justify-center gap-2 text-sm font-bold rounded-md transition-all ${type === 'OUT' ? 'bg-white shadow text-red-600' : 'text-slate-500 hover:text-slate-700'}`}>
                              <TrendingDown className="w-4 h-4"/> Egreso
                          </button>
                      </div>
                      
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Concepto / Descripción</label>
                          <input type="text" className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-amber-500" placeholder="Ej: Saldo Inicial / Ajuste de caja" value={newDesc} onChange={e => setNewDesc(e.target.value)} required />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Monto ($)</label>
                              <input type="number" step="0.01" className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-amber-500 font-bold" placeholder="0.00" value={newAmount} onChange={e => setNewAmount(e.target.value)} required />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                              <input type="date" className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-amber-500" value={newDate} onChange={e => setNewDate(e.target.value)} required />
                          </div>
                      </div>

                      <div className="flex gap-3 pt-4 border-t border-slate-100 mt-2">
                          <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                          <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 shadow-lg shadow-amber-200 transition-colors">Guardar</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default ReserveView;