import React, { useState, useMemo } from 'react';
import { Unit, Payment, SettlementRecord, Consortium } from '../types';
import { 
  Plus, Edit2, Trash2, Search, Mail, X, Upload, FileSpreadsheet, 
  Loader2, Download, CheckCircle2, AlertTriangle, ArrowRight, 
  Check, Layers
} from 'lucide-react';
import { addUnit, deleteUnit } from '../services/firestoreService';
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

interface FieldChange {
  field: string;
  label: string;
  before: string | number;
  after: string | number;
}

interface ParsedUnitChange {
  type: 'NEW' | 'MODIFIED' | 'UNCHANGED' | 'INVALID';
  rowNumber: number;
  unitNumber: string;
  block: string;
  ownerName: string;
  proratePercentage: number;
  initialBalance: number;
  authorizedEmails: string[];
  changes: FieldChange[];
  existingUnit?: Unit;
  errorReason?: string;
}

const UnitsView: React.FC<UnitsViewProps> = ({ 
    units, setUnits, consortiumId, payments = [], history = [], consortium, onUpdateUnit, onDeletePayment
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isApplyingChanges, setIsApplyingChanges] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  // Estado para el modal de revisión / diff de importación
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [parsedChanges, setParsedChanges] = useState<ParsedUnitChange[]>([]);
  const [reviewFilter, setReviewFilter] = useState<'ALL' | 'NEW' | 'MODIFIED' | 'UNCHANGED' | 'INVALID'>('ALL');

  // Estado del formulario manual
  const [formData, setFormData] = useState({
    block: '',
    unitNumber: '',
    ownerName: '',
    proratePercentage: '',
    initialBalance: '',
    authorizedEmailsStr: ''
  });

  // --- EXPORTAR A EXCEL (PLANILLA CON DATOS REALES / MODIFICABLE) ---
  const handleExportExcel = () => {
    let exportData: any[] = [];

    if (units.length > 0) {
      exportData = units.map(u => ({
        "Sector": u.block || '',
        "Unidad": u.unitNumber || '',
        "Propietario": u.ownerName || '',
        "Porcentaje Prorrateo": Number(u.proratePercentage || 0),
        "Saldo Inicial": Number(u.initialBalance || 0),
        "Emails Autorizados": (u.authorizedEmails || []).join(', ')
      }));
    } else {
      // Plantilla de ejemplo si aún no hay unidades
      exportData = [
        {
          "Sector": "Complejo Norte",
          "Unidad": "Local 1",
          "Propietario": "Juan Pérez",
          "Porcentaje Prorrateo": 5.0,
          "Saldo Inicial": 0,
          "Emails Autorizados": "juan.perez@email.com"
        },
        {
          "Sector": "Complejo Sur",
          "Unidad": "Local 2",
          "Propietario": "Ana López",
          "Porcentaje Prorrateo": 4.5,
          "Saldo Inicial": -15000,
          "Emails Autorizados": "ana.lopez@email.com"
        }
      ];
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Unidades");

    worksheet['!cols'] = [
      { wch: 18 }, // Sector
      { wch: 14 }, // Unidad
      { wch: 28 }, // Propietario
      { wch: 22 }, // Porcentaje Prorrateo
      { wch: 16 }, // Saldo Inicial
      { wch: 45 }  // Emails Autorizados
    ];

    const safeConsortiumName = (consortium?.name || 'consorcio').toLowerCase().replace(/[^a-z0-9]/gi, '_');
    XLSX.writeFile(workbook, `unidades_${safeConsortiumName}.xlsx`);
  };

  // --- DESCARGAR PLANTILLA VACÍA DE EJEMPLO ---
  const handleDownloadBlankTemplate = () => {
    const templateData = [
      {
        "Sector": "Torre A",
        "Unidad": "1A",
        "Propietario": "Juan Pérez",
        "Porcentaje Prorrateo": 5.0000,
        "Saldo Inicial": 0,
        "Emails Autorizados": "juan.perez@email.com"
      },
      {
        "Sector": "Torre B",
        "Unidad": "1B",
        "Propietario": "Ana López",
        "Porcentaje Prorrateo": 4.5000,
        "Saldo Inicial": -15000,
        "Emails Autorizados": "ana.lopez@email.com, inquilino@email.com"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla");
    worksheet['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 28 }, { wch: 22 }, { wch: 16 }, { wch: 45 }];
    XLSX.writeFile(workbook, "plantilla_unidades_vacia.xlsx");
  };

  // --- PARSEAR EXCEL Y GENERAR EL RESUMEN DE CAMBIOS (DIFF) ---
  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (!rows || rows.length === 0) {
          alert("El archivo Excel está vacío o no contiene filas con datos.");
          setIsImporting(false);
          return;
        }

        const changesList: ParsedUnitChange[] = [];

        rows.forEach((row, idx) => {
          const rowNumber = idx + 2; // Considerando encabezado en fila 1
          const block = String(row["Sector"] || row["Bloque"] || row["Complejo"] || row["Torre"] || "").trim();
          const unitNumber = String(row["Unidad"] || row["UF"] || row["Nro Unidad"] || "").trim();
          const ownerName = String(row["Propietario"] || row["Inquilino"] || row["Titular"] || "").trim();
          
          const rawProrate = row["Porcentaje Prorrateo"] ?? row["Prorrateo"] ?? row["Coeficiente"] ?? 0;
          const proratePercentage = parseFloat(String(rawProrate).replace(',', '.')) || 0;
          
          const rawInitialBalance = row["Saldo Inicial"] ?? row["Saldo"] ?? 0;
          const initialBalance = parseFloat(String(rawInitialBalance).replace(',', '.')) || 0;

          const emailsStr = String(row["Emails Autorizados"] || row["Emails"] || row["Email"] || "").trim();
          const authorizedEmails = emailsStr
            ? emailsStr.split(/[,;]/).map(em => em.trim().toLowerCase()).filter(Boolean)
            : [];

          // Validación básica
          if (!unitNumber || !ownerName) {
            changesList.push({
              type: 'INVALID',
              rowNumber,
              unitNumber: unitNumber || '(Sin Unidad)',
              block,
              ownerName: ownerName || '(Sin Propietario)',
              proratePercentage,
              initialBalance,
              authorizedEmails,
              changes: [],
              errorReason: !unitNumber ? 'Falta el número de Unidad' : 'Falta el nombre del Propietario'
            });
            return;
          }

          // Buscar unidad existente por nro de unidad
          const existing = units.find(u => 
            u.unitNumber.trim().toLowerCase() === unitNumber.toLowerCase()
          );

          if (!existing) {
            // Es una NUEVA UNIDAD
            changesList.push({
              type: 'NEW',
              rowNumber,
              unitNumber,
              block,
              ownerName,
              proratePercentage,
              initialBalance,
              authorizedEmails,
              changes: []
            });
          } else {
            // Unidad existente: verificar qué campos cambiaron
            const fieldChanges: FieldChange[] = [];

            const currentBlock = (existing.block || '').trim();
            if (currentBlock !== block) {
              fieldChanges.push({
                field: 'block',
                label: 'Sector / Complejo',
                before: currentBlock || '(Ninguno)',
                after: block || '(Ninguno)'
              });
            }

            const currentOwner = existing.ownerName.trim();
            if (currentOwner !== ownerName) {
              fieldChanges.push({
                field: 'ownerName',
                label: 'Propietario',
                before: currentOwner,
                after: ownerName
              });
            }

            const currentProrate = Number(existing.proratePercentage || 0);
            if (Math.abs(currentProrate - proratePercentage) > 0.00001) {
              fieldChanges.push({
                field: 'proratePercentage',
                label: 'Prorrateo (%)',
                before: `${currentProrate.toFixed(4)}%`,
                after: `${proratePercentage.toFixed(4)}%`
              });
            }

            const currentInitialBalance = Number(existing.initialBalance || 0);
            if (Math.abs(currentInitialBalance - initialBalance) > 0.01) {
              fieldChanges.push({
                field: 'initialBalance',
                label: 'Saldo Inicial',
                before: formatCurrency(currentInitialBalance),
                after: formatCurrency(initialBalance)
              });
            }

            const currentEmails = [...(existing.authorizedEmails || [])].map(e => e.trim().toLowerCase()).sort();
            const newEmails = [...authorizedEmails].sort();
            if (JSON.stringify(currentEmails) !== JSON.stringify(newEmails)) {
              fieldChanges.push({
                field: 'authorizedEmails',
                label: 'Emails Autorizados',
                before: currentEmails.length > 0 ? currentEmails.join(', ') : '(Ninguno)',
                after: newEmails.length > 0 ? newEmails.join(', ') : '(Ninguno)'
              });
            }

            if (fieldChanges.length > 0) {
              changesList.push({
                type: 'MODIFIED',
                rowNumber,
                unitNumber,
                block,
                ownerName,
                proratePercentage,
                initialBalance,
                authorizedEmails,
                changes: fieldChanges,
                existingUnit: existing
              });
            } else {
              changesList.push({
                type: 'UNCHANGED',
                rowNumber,
                unitNumber,
                block,
                ownerName,
                proratePercentage,
                initialBalance,
                authorizedEmails,
                changes: [],
                existingUnit: existing
              });
            }
          }
        });

        setParsedChanges(changesList);
        setReviewFilter('ALL');
        setIsReviewModalOpen(true);
      } catch (err) {
        console.error(err);
        alert("Ocurrió un error al leer el archivo Excel. Verifica que tenga el formato correcto.");
      } finally {
        setIsImporting(false);
        e.target.value = ''; 
      }
    };

    reader.readAsBinaryString(file);
  };

  // --- ESTADÍSTICAS DEL RESUMEN ---
  const summaryStats = useMemo(() => {
    const newCount = parsedChanges.filter(c => c.type === 'NEW').length;
    const modifiedCount = parsedChanges.filter(c => c.type === 'MODIFIED').length;
    const unchangedCount = parsedChanges.filter(c => c.type === 'UNCHANGED').length;
    const invalidCount = parsedChanges.filter(c => c.type === 'INVALID').length;
    
    // Prorrateo proyectado
    let totalProrate = 0;
    parsedChanges.forEach(c => {
      if (c.type !== 'INVALID') {
        totalProrate += c.proratePercentage;
      }
    });

    return {
      total: parsedChanges.length,
      newCount,
      modifiedCount,
      unchangedCount,
      invalidCount,
      totalProrate,
      hasActionableChanges: newCount > 0 || modifiedCount > 0
    };
  }, [parsedChanges]);

  // --- CONFIRMAR Y APLICAR CAMBIOS (DAR EL OK) ---
  const handleConfirmAndApplyChanges = async () => {
    if (!summaryStats.hasActionableChanges) {
      alert("No hay cambios nuevos ni modificaciones para aplicar.");
      setIsReviewModalOpen(false);
      return;
    }

    setIsApplyingChanges(true);
    try {
      const updatedUnitsMap = new Map<string, Unit>();
      units.forEach(u => updatedUnitsMap.set(u.id, { ...u }));

      // 1. Aplicar MODIFICACIONES
      const modifiedItems = parsedChanges.filter(c => c.type === 'MODIFIED' && c.existingUnit);
      for (const item of modifiedItems) {
        const unitUpdates: Partial<Unit> = {
          block: item.block,
          ownerName: item.ownerName,
          proratePercentage: item.proratePercentage,
          initialBalance: item.initialBalance,
          authorizedEmails: item.authorizedEmails
        };

        await onUpdateUnit(item.existingUnit!.id, unitUpdates);
        
        const current = updatedUnitsMap.get(item.existingUnit!.id);
        if (current) {
          updatedUnitsMap.set(item.existingUnit!.id, { ...current, ...unitUpdates });
        }
      }

      // 2. Aplicar NUEVAS UNIDADES
      const newItems = parsedChanges.filter(c => c.type === 'NEW');
      for (const item of newItems) {
        const newUnitData: Omit<Unit, 'id'> = {
          block: item.block,
          unitNumber: item.unitNumber,
          ownerName: item.ownerName,
          proratePercentage: item.proratePercentage,
          initialBalance: item.initialBalance,
          authorizedEmails: item.authorizedEmails
        };

        const created = await addUnit(consortiumId, newUnitData);
        updatedUnitsMap.set(created.id, created as Unit);
      }

      const finalList = Array.from(updatedUnitsMap.values())
        .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }));

      setUnits(finalList);
      setIsReviewModalOpen(false);
      setParsedChanges([]);

      alert(`¡Importación completada con éxito!\n\n• Nuevas unidades creadas: ${summaryStats.newCount}\n• Unidades actualizadas: ${summaryStats.modifiedCount}`);
    } catch (err) {
      console.error(err);
      alert("Ocurrió un error al aplicar los cambios en la base de datos.");
    } finally {
      setIsApplyingChanges(false);
    }
  };

  // --- BUSCADOR Y ACCIONES MANUALES ---
  const filteredUnits = units.filter(u => 
    u.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.block && u.block.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredReviewChanges = useMemo(() => {
    if (reviewFilter === 'ALL') return parsedChanges;
    return parsedChanges.filter(c => c.type === reviewFilter);
  }, [parsedChanges, reviewFilter]);

  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.unitNumber.trim() || !formData.ownerName.trim()) return;

    setIsSubmitting(true);
    try {
      const authorizedEmails = formData.authorizedEmailsStr
        ? formData.authorizedEmailsStr.split(/[,;]/).map(em => em.trim().toLowerCase()).filter(Boolean)
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
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
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

        <div className="flex flex-wrap gap-2 w-full xl:w-auto items-center">
          {/* BOTÓN EXPORTAR EXCEL */}
          <button 
            onClick={handleExportExcel}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
            title="Descargar la planilla actual con todas las unidades para editar en Excel"
          >
            <Download className="w-4 h-4" />
            <span>Exportar a Excel</span>
          </button>

          {/* BOTÓN IMPORTAR EXCEL */}
          <label className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-indigo-200 cursor-pointer shadow-sm">
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-indigo-600" />}
            <span>{isImporting ? 'Analizando...' : 'Importar Excel'}</span>
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelFileSelect} disabled={isImporting} />
          </label>

          {/* BOTÓN PLANTILLA VACÍA */}
          <button 
            onClick={handleDownloadBlankTemplate}
            className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 border border-slate-200"
            title="Descargar una plantilla vacía con formato de ejemplo"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Plantilla Vacía</span>
          </button>

          {/* BOTÓN NUEVA UNIDAD MANUAL */}
          <button 
            onClick={() => {
              setEditingUnit(null);
              setFormData({ block: '', unitNumber: '', ownerName: '', proratePercentage: '', initialBalance: '', authorizedEmailsStr: '' });
              setIsModalOpen(true);
            }} 
            className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
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
                  <td colSpan={7} className="text-center py-10 text-slate-400 font-medium">
                    No se encontraron unidades funcionales cargadas. Podés usar "Exportar a Excel" para descargar la planilla o "Importar Excel" para cargarlas.
                  </td>
                </tr>
              ) : (
                filteredUnits.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 font-bold text-indigo-600">
                      {u.block ? <span className="bg-indigo-50 px-2.5 py-1 rounded-md text-[11px] border border-indigo-100 uppercase tracking-wide">{u.block}</span> : <span className="text-slate-300 text-xs">-</span>}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">{u.unitNumber}</td>
                    <td className="px-6 py-4 text-slate-700 font-medium">{u.ownerName}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-600 font-semibold">{(u.proratePercentage || 0).toFixed(4)}%</td>
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

      {/* ========================================================================= */}
      {/* MODAL DE REVISIÓN Y CONFIRMACIÓN DE CAMBIOS (IMPORTACIÓN DIFF)            */}
      {/* ========================================================================= */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            
            {/* Header del Modal */}
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
                  <h3 className="font-black text-xl text-white">Revisar y Confirmar Importación</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Se analizaron las filas del archivo Excel. Revisa los cambios detectados antes de dar el OK.
                </p>
              </div>
              <button 
                onClick={() => { setIsReviewModalOpen(false); setParsedChanges([]); }}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tarjetas de Resumen Estadístico */}
            <div className="p-6 bg-slate-50 border-b border-slate-200">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Nuevas a Crear</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  </div>
                  <p className="text-2xl font-black text-emerald-700 mt-1">+{summaryStats.newCount}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Unidades no existentes</p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Modificadas</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  </div>
                  <p className="text-2xl font-black text-amber-700 mt-1">{summaryStats.modifiedCount}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Valores actualizados</p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Sin Cambios</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                  </div>
                  <p className="text-2xl font-black text-slate-700 mt-1">{summaryStats.unchangedCount}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Permanecen idénticas</p>
                </div>

                <div className={`p-3.5 rounded-xl border shadow-sm ${Math.abs(summaryStats.totalProrate - 100) < 0.01 ? 'bg-white border-indigo-200' : 'bg-amber-50 border-amber-300'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Prorrateo Total</span>
                    <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  </div>
                  <p className={`text-2xl font-black mt-1 ${Math.abs(summaryStats.totalProrate - 100) < 0.01 ? 'text-indigo-700' : 'text-amber-700'}`}>
                    {summaryStats.totalProrate.toFixed(2)}%
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {Math.abs(summaryStats.totalProrate - 100) < 0.01 ? 'Cuadra 100%' : 'No suma 100%'}
                  </p>
                </div>
              </div>

              {/* Pestañas de Filtro */}
              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-200">
                <button 
                  onClick={() => setReviewFilter('ALL')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${reviewFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border hover:bg-slate-100'}`}
                >
                  Todas ({summaryStats.total})
                </button>
                {summaryStats.newCount > 0 && (
                  <button 
                    onClick={() => setReviewFilter('NEW')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${reviewFilter === 'NEW' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'}`}
                  >
                    Nuevas ({summaryStats.newCount})
                  </button>
                )}
                {summaryStats.modifiedCount > 0 && (
                  <button 
                    onClick={() => setReviewFilter('MODIFIED')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${reviewFilter === 'MODIFIED' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'}`}
                  >
                    Modificadas ({summaryStats.modifiedCount})
                  </button>
                )}
                {summaryStats.unchangedCount > 0 && (
                  <button 
                    onClick={() => setReviewFilter('UNCHANGED')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${reviewFilter === 'UNCHANGED' ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-600 border hover:bg-slate-200'}`}
                  >
                    Sin Cambios ({summaryStats.unchangedCount})
                  </button>
                )}
                {summaryStats.invalidCount > 0 && (
                  <button 
                    onClick={() => setReviewFilter('INVALID')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${reviewFilter === 'INVALID' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'}`}
                  >
                    Con Errores ({summaryStats.invalidCount})
                  </button>
                )}
              </div>
            </div>

            {/* Lista detallada de cambios detectados */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {filteredReviewChanges.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  No hay elementos en esta categoría.
                </div>
              ) : (
                filteredReviewChanges.map((item, idx) => (
                  <div 
                    key={idx}
                    className={`p-4 rounded-xl border transition-all ${
                      item.type === 'NEW' 
                        ? 'bg-emerald-50/60 border-emerald-200 hover:border-emerald-300' 
                        : item.type === 'MODIFIED'
                        ? 'bg-amber-50/60 border-amber-200 hover:border-amber-300'
                        : item.type === 'INVALID'
                        ? 'bg-rose-50/60 border-rose-200'
                        : 'bg-white border-slate-200 opacity-75'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {item.block && (
                          <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                            {item.block}
                          </span>
                        )}
                        <span className="font-black text-slate-800 text-base">
                          {item.unitNumber}
                        </span>
                        <span className="text-slate-400 text-xs">•</span>
                        <span className="text-slate-700 font-medium text-sm">
                          {item.ownerName}
                        </span>
                      </div>

                      <div>
                        {item.type === 'NEW' && (
                          <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                            <Plus className="w-3 h-3" /> Nueva Unidad
                          </span>
                        )}
                        {item.type === 'MODIFIED' && (
                          <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                            <Edit2 className="w-3 h-3" /> {item.changes.length} {item.changes.length === 1 ? 'campo modificado' : 'campos modificados'}
                          </span>
                        )}
                        {item.type === 'UNCHANGED' && (
                          <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-600 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                            <Check className="w-3 h-3" /> Sin Cambios
                          </span>
                        )}
                        {item.type === 'INVALID' && (
                          <span className="inline-flex items-center gap-1 bg-rose-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> Error (Fila {item.rowNumber})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Detalle para NUEVAS */}
                    {item.type === 'NEW' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 pt-2 border-t border-emerald-100 text-xs text-slate-600">
                        <div>
                          <span className="text-slate-400 font-medium">Prorrateo:</span>{' '}
                          <strong className="text-slate-800">{item.proratePercentage.toFixed(4)}%</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium">Saldo Inicial:</span>{' '}
                          <strong className="text-slate-800">{formatCurrency(item.initialBalance)}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium">Emails:</span>{' '}
                          <span className="text-slate-800">{item.authorizedEmails.length > 0 ? item.authorizedEmails.join(', ') : 'Ninguno'}</span>
                        </div>
                      </div>
                    )}

                    {/* Detalle visual de DIFERENCIAS para MODIFICADAS */}
                    {item.type === 'MODIFIED' && (
                      <div className="mt-2 pt-2 border-t border-amber-200/60 space-y-1.5 text-xs">
                        {item.changes.map((ch, chIdx) => (
                          <div key={chIdx} className="flex flex-wrap items-center gap-2 bg-white/80 p-2 rounded-lg border border-amber-100">
                            <span className="font-bold text-slate-600 min-w-[120px]">{ch.label}:</span>
                            <span className="line-through text-rose-500 bg-rose-50 px-2 py-0.5 rounded font-mono">
                              {String(ch.before)}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono">
                              {String(ch.after)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Detalle para ERRORES */}
                    {item.type === 'INVALID' && (
                      <p className="text-xs text-rose-600 font-medium mt-1">
                        ⚠️ {item.errorReason}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer con Botones de Acción */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-xs text-slate-500 text-center sm:text-left">
                {summaryStats.hasActionableChanges ? (
                  <span>
                    Se aplicarán <strong className="text-slate-800">{summaryStats.newCount + summaryStats.modifiedCount} cambios</strong> al confirmar.
                  </span>
                ) : (
                  <span>No hay cambios detectados para aplicar.</span>
                )}
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => { setIsReviewModalOpen(false); setParsedChanges([]); }}
                  disabled={isApplyingChanges}
                  className="flex-1 sm:flex-none px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors text-sm"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleConfirmAndApplyChanges}
                  disabled={isApplyingChanges || !summaryStats.hasActionableChanges}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  {isApplyingChanges ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando Cambios...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Dar el OK y Aplicar Cambios</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

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
