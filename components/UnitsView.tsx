import React, { useState } from 'react';
import { Unit, Payment, SettlementRecord, Consortium } from '../types';
import { Plus, Edit2, Trash2, Search, Mail, Home, User, X, Upload, FileSpreadsheet, Loader2, FileText, Download } from 'lucide-react';
import { addUnit, updateUnit, deleteUnit } from '../services/firestoreService';
import { generateUnitLedgerPDF } from '../services/pdfService';
import * as XLSX from 'xlsx';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
};

interface UnitsViewProps {
  units: Unit[];
  setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
  consortiumId: string;
  payments?: Payment[]; 
  history?: SettlementRecord[];
  consortium?: Consortium;
  onUpdateUnit: (id: string, updates: Partial<Unit>) => Promise<void>;
  onDeletePayment: (id: string) => Promise<void>;
}

const UnitsView: React.FC<UnitsViewProps> = ({ 
    units, setUnits, consortiumId, payments = [], history = [], consortium, onUpdateUnit, onDeletePayment
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  // Estado del formulario manual ajustado
  const [formData, setFormData] = useState({
    block: '', // Campo para Complejo Norte/Sur
    unitNumber: '',
    ownerName: '',
    proratePercentage: '',
    initialBalance: '',
    authorizedEmailsStr: ''
  });

  // --- FUNCIÓN PARA DESCARGAR EL EXCEL DE PRUEBA (PLANTILLA) ---
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Sector": "Complejo Norte",
        "Unidad": "Local 1",
        "Propietario": "Juan Pérez",
        "Porcentaje Prorrateo": 5,
        "Saldo Inicial": 0,
        "Emails Autorizados": "juan.perez@email.com"
      },
      {
        "Sector": "Complejo Sur",
        "Unidad": "Local 14",
        "Propietario": "Ana López",
        "Porcentaje Prorrateo": 4.5,
        "Saldo Inicial": -15000,
        "Emails Autorizados": "ana.lopez@email.com"
      },
      {
        "Sector": "General",
        "Unidad": "Administración",
        "Propietario": "Consorcio",
        "Porcentaje Prorrateo": 0,
        "Saldo Inicial": 0,
        "Emails Autorizados": ""
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla Unidades");

    worksheet['!cols'] = [
      { wch: 18 }, // Sector
      { wch: 12 }, // Unidad
      { wch: 25 }, // Propietario
      { wch: 22 }, // Porcentaje Prorrateo
      { wch: 15 }, // Saldo Inicial
      { wch: 45 }  // Emails Autorizados
    ];

    XLSX.writeFile(workbook, "plantilla_importar_unidades.xlsx");
  };

  // --- FUNCIÓN PARA IMPORTAR EL EXCEL ---
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const importedUnits: Unit[] = [];

        for (const row of json) {
          const block = String(row["Sector"] || row["Bloque"] || "").trim();
          const unitNumber = String(row["Unidad"] || "").trim();
          const ownerName = String(row["Propietario"] || "").trim();
          const proratePercentage = parseFloat(row["Porcentaje Prorrateo"] || row["Coeficiente"]) || 0;
          const initialBalance = parseFloat(row["Saldo Inicial"]) || 0;
          const emailsStr = String(row["Emails Autorizados"] || "").trim();

          if (!unitNumber || !ownerName) continue;

          const authorizedEmails = emailsStr
            ? emailsStr.split(',').map(email => email.trim().toLowerCase()).filter(Boolean)
            : [];

          const newUnitData = {
            block,
            unitNumber,
            ownerName,
            proratePercentage,
            initialBalance,
            authorizedEmails
          };

          const createdUnit = await addUnit(consortiumId, newUnitData);
          importedUnits.push(createdUnit as Unit);
        }

        setUnits(prev => [...prev, ...importedUnits].sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true })));
        alert(`¡Importación exitosa! Se cargaron ${importedUnits.length} unidades correctamente.`);
      } catch (err) {
        console.error(err);
        alert("Ocurrió un error al procesar el archivo Excel. Verifica el formato.");
      } finally {
        setIsImporting(false);
        e.target.value = ''; 
      }
    };

    reader.readAsBinaryString(file);
  };

  // --- BUSCADOR Y ACCIONES MANUALES ---
  const filteredUnits = units.filter(u => 
    u.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.block && u.block.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.unitNumber.trim() || !formData.ownerName.trim()) return;

    setIsSubmitting(true);
    try {
      const authorizedEmails = formData.authorizedEmailsStr
        ? formData.authorizedEmailsStr.split(',').map(em => em.trim().toLowerCase()).filter(Boolean)
        : [];

      const unitData = {
        block: formData.block.trim(),
        unitNumber: formData.unitNumber.trim(),
        ownerName: formData.ownerName.trim(),
        proratePercentage: parseFloat(formData.proratePercentage) || 0,
        initialBalance: parseFloat(formData.initialBalance) || 0,
        authorizedEmails
      };

      if (editingUnit) {
        await onUpdateUnit(editingUnit.id, unitData);
        setUnits(prev => prev.map(u => u.id === editingUnit.id ? { ...u, ...unitData } : u));
        setEditingUnit(null);
      } else {
        const created = await addUnit(consortiumId, unitData);
        setUnits(prev => [...prev, created as Unit].sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true })));
      }

      setIsModalOpen(false);
      setFormData({ block: '', unitNumber: '', ownerName: '', proratePercentage: '', initialBalance: '', authorizedEmailsStr: '' });
    } catch (err) {
      alert("Error al guardar la unidad.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (u: Unit) => {
    setEditingUnit(u);
    setFormData({
      block: u.block || '',
      unitNumber: u.unitNumber,
      ownerName: u.ownerName,
      proratePercentage: String(u.proratePercentage || 0),
      initialBalance: String(u.initialBalance || 0),
      authorizedEmailsStr: (u.authorizedEmails || []).join(', ')
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta unidad funcional? Esto no borrará sus pagos históricos de Firestore.")) return;
    try {
      await deleteUnit(consortiumId, id);
      setUnits(prev => prev.filter(u => u.id !== id));
    } catch (e) {
      alert("Error al eliminar.");
    }
  };

  return (
    <div className="space-y-6">
      
      {/* SECCIÓN DE BOTONES SUPERIORES */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full">
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
          <input 
            type="text" 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-700"
            placeholder="Buscar por UF, Propietario o Sector..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button 
            onClick={handleDownloadTemplate}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-200"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Plantilla</span>
          </button>

          <label className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-emerald-200 cursor-pointer">
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>{isImporting ? 'Importando...' : 'Importar Excel'}</span>
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelImport} disabled={isImporting} />
          </label>

          <button 
            onClick={() => {
              setEditingUnit(null);
              setFormData({ block: '', unitNumber: '', ownerName: '', proratePercentage: '', initialBalance: '', authorizedEmailsStr: '' });
              setIsModalOpen(true);
            }} 
            className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Unidad</span>
          </button>
        </div>
      </div>

      {/* TABLA DE UNIDADES */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Sector / Complejo</th>
                <th className="px-6 py-4">UF / Unidad</th>
                <th className="px-6 py-4">Propietario / Inquilino</th>
                <th className="px-6 py-4 text-right">Prorrateo (%)</th>
                <th className="px-6 py-4 text-right">Saldo Inicial</th>
                <th className="px-6 py-4">Emails Vinculados</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400 font-medium">No se encontraron unidades funcionales cargadas.</td>
                </tr>
              ) : (
                filteredUnits.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 font-bold text-indigo-600">
                      {u.block ? <span className="bg-indigo-50 px-2.5 py-1 rounded-md text-[11px] border border-indigo-100 uppercase tracking-wide">{u.block}</span> : <span className="text-slate-300 text-xs">-</span>}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">{u.unitNumber}</td>
                    <td className="px-6 py-4 text-slate-700 font-medium">{u.ownerName}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-600 font-semibold">{(u.proratePercentage || 0).toFixed(4)}</td>
                    <td className={`px-6 py-4 text-right font-mono font-bold ${u.initialBalance && u.initialBalance < 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                        {formatCurrency(u.initialBalance || 0)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {(u.authorizedEmails || []).length === 0 ? (
                          <span className="text-xs text-slate-400 italic">Ninguno asignado</span>
                        ) : (
                          u.authorizedEmails.map((em, idx) => (
                            <span key={idx} className="text-[11px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-200">
                              <Mail className="w-3 h-3 text-slate-400" /> {em}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center items-center gap-1">
                        <button onClick={() => handleEditClick(u)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar Unidad"><Edit2 className="w-4 h-4"/></button>
                        <button onClick={() => handleDeleteClick(u.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Eliminar Unidad"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CARGA MANUAL / EDICIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-slate-100">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
              <h3 className="font-black text-slate-800 text-lg">{editingUnit ? 'Modificar Unidad' : 'Registrar Nueva Unidad'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmitManual} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Sector / Complejo (Opcional)</label>
                <input type="text" value={formData.block} onChange={e => setFormData({...formData, block: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="Ej: Norte, Sur, Torre A..."/>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Nro Unidad / Local *</label>
                  <input type="text" required value={formData.unitNumber} onChange={e => setFormData({...formData, unitNumber: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="Local 1A"/>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Saldo Inicial ($)</label>
                  <input type="number" step="0.01" value={formData.initialBalance} onChange={e => setFormData({...formData, initialBalance: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="0.00"/>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Nombre Propietario *</label>
                <input type="text" required value={formData.ownerName} onChange={e => setFormData({...formData, ownerName: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="Carlos Gómez"/>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Porcentaje Prorrateo (%)</label>
                <input type="number" step="0.0001" value={formData.proratePercentage} onChange={e => setFormData({...formData, proratePercentage: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="5.0000"/>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Emails para Acceso Inquilino/Vecino</label>
                <input type="text" value={formData.authorizedEmailsStr} onChange={e => setFormData({...formData, authorizedEmailsStr: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="vecino@email.com, hijo@email.com"/>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 shadow-md flex justify-center items-center gap-2">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar Unidad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default UnitsView;