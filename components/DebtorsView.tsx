import React, { useState, useMemo, useRef } from 'react';
import { Unit, DebtItem, SettlementRecord, Payment, Consortium, InterestLog } from '../types';
import { 
  Search, Plus, Trash2, Save, Users, ChevronRight, AlertTriangle, 
  CheckSquare, Download, AlertCircle, Clock, FileSpreadsheet, 
  Upload, CheckCircle2, X, AlertOctagon, HelpCircle, ArrowRight, Loader2, Info
} from 'lucide-react';
import { generateDebtDetailPDF } from '../services/pdfService';
import * as XLSX from 'xlsx';
import { importDebtsBatch } from '../services/firestoreService';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
};

interface DebtorsViewProps {
  units: Unit[];
  setUnits?: React.Dispatch<React.SetStateAction<Unit[]>>;
  history: SettlementRecord[];
  payments: Payment[];
  consortium: Consortium;
  onUpdateUnit: (unitId: string, updates: Partial<Unit>) => Promise<void>;
}

interface ParsedDebtRow {
  rowNumber: number;
  unitNumber: string;
  period: string;
  baseAmount: number;
  accumulatedInterest: number;
  status: 'VALID' | 'UNIT_NOT_FOUND' | 'INVALID_DATA';
  errorMessage?: string;
  unitId?: string;
}

interface GroupedUnitDebts {
  unitId: string;
  unitNumber: string;
  ownerName: string;
  newDebts: DebtItem[];
  existingDebtsCount: number;
  subtotalBase: number;
  subtotalInterest: number;
  subtotalDebt: number;
}

interface ImportPreviewSummary {
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  unitNotFoundCount: number;
  affectedUnitsCount: number;
  totalBaseAmount: number;
  totalInterestAmount: number;
  totalDebtAmount: number;
  groupedUpdates: GroupedUnitDebts[];
  ignoredRows: ParsedDebtRow[];
}

const DebtorsView: React.FC<DebtorsViewProps> = ({ units, setUnits, history, payments, consortium, onUpdateUnit }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [editingDebts, setEditingDebts] = useState<DebtItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedDebtIds, setSelectedDebtIds] = useState<string[]>([]);
  const [bulkInterestRate, setBulkInterestRate] = useState<number | ''>('');

  // Estados para Importación Masiva Excel y Kárdex de Intereses
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportingToFirebase, setIsImportingToFirebase] = useState(false);
  const [importMode, setImportMode] = useState<'REPLACE' | 'APPEND'>('REPLACE');
  const [previewSummary, setPreviewSummary] = useState<ImportPreviewSummary | null>(null);
  const [viewingLogsDebt, setViewingLogsDebt] = useState<DebtItem | null>(null);

  const handleSelectUnit = (unit: Unit) => {
    setSelectedUnit(unit);
    setEditingDebts(unit.debts || []);
    setSelectedDebtIds([]);
    setBulkInterestRate('');
  };

  const getUnitDebt = (unit: Unit | null) => {
    if (!unit) return { historical: 0, current: 0, total: 0, pendingPeriod: '' };

    const historical = (unit.debts || []).reduce((acc, d) => acc + d.total, 0) + (unit.initialBalance || 0);

    let current = 0;
    let pendingPeriod = '';

    if (history.length > 0) {
      const lastSettlement = history[0];
      const unitDetail = lastSettlement.unitDetails?.find(d => d.unitId === unit.id);

      if (unitDetail) {
        const isAlreadyInDebts = (unit.debts || []).some(d => d.period === lastSettlement.month);
        if (!isAlreadyInDebts) {
          const settlementDate = new Date(lastSettlement.dateClosed).getTime();
          const paidSinceThen = payments
            .filter(p => p.unitId === unit.id && p.status === 'APPROVED' && new Date(p.date).getTime() >= settlementDate)
            .reduce((sum, p) => sum + p.amount, 0);

          const amountOwed = unitDetail.totalToPay - paidSinceThen;
          if (amountOwed > 1) {
            current = amountOwed;
            pendingPeriod = lastSettlement.month;
          }
        }
      }
    }

    return { historical, current, total: historical + current, pendingPeriod };
  };

  const addSuggestedDebt = () => {
    if (!selectedUnit) return;
    const debtObj = getUnitDebt(selectedUnit);
    if (debtObj.current <= 0) return;

    const exists = editingDebts.some(d => d.period === debtObj.pendingPeriod);
    if (exists) {
      alert("El período ya está en la lista de deudas.");
      return;
    }
    const newDebt: DebtItem = {
      id: Math.random().toString(36).substr(2, 9),
      period: debtObj.pendingPeriod,
      baseAmount: Number(debtObj.current.toFixed(2)),
      interestRate: 0,
      interestAmount: 0,
      total: Number(debtObj.current.toFixed(2))
    };
    setEditingDebts([...editingDebts, newDebt]);
  };

  const addDebtRow = () => {
    const newDebt: DebtItem = {
      id: Math.random().toString(36).substr(2, 9),
      period: '', baseAmount: 0, interestRate: 0, interestAmount: 0, total: 0
    };
    setEditingDebts([...editingDebts, newDebt]);
  };

  const removeDebtRow = (idOrPeriod: string) => {
    setEditingDebts(editingDebts.filter(d => (d.id || d.period) !== idOrPeriod));
    setSelectedDebtIds(selectedDebtIds.filter(selectedId => selectedId !== idOrPeriod));
  };

  const clearAllDebts = () => {
    if (confirm('⚠️ ¿Estás seguro de eliminar TODAS las deudas de esta unidad?\n\n(Debes hacer click en "Guardar Sistema" luego para confirmar)')) {
      setEditingDebts([]);
      setSelectedDebtIds([]);
    }
  };

  const updateDebtField = (idOrPeriod: string, field: keyof DebtItem, value: string) => {
    const updated = editingDebts.map((debt, index) => {
      const safeId = debt.id || debt.period || String(index);
      if (safeId === idOrPeriod) {
        const newDebt = { ...debt };
        if (field === 'period') {
          newDebt.period = value;
        } else if (field === 'baseAmount') {
          const numValue = Math.max(0, parseFloat(value) || 0);
          newDebt.baseAmount = numValue;
          // Interés simple calculado sobre el nuevo monto base del período
          newDebt.interestAmount = Number((numValue * ((newDebt.interestRate || 0) / 100)).toFixed(2));
          newDebt.total = Number((numValue + newDebt.interestAmount).toFixed(2));
        } else if (field === 'interestRate') {
          const numValue = Math.max(0, parseFloat(value) || 0);
          newDebt.interestRate = numValue;
          // Interés simple: baseAmount * rate%
          newDebt.interestAmount = Number((newDebt.baseAmount * (numValue / 100)).toFixed(2));
          newDebt.total = Number((newDebt.baseAmount + newDebt.interestAmount).toFixed(2));
        } else if (field === 'interestAmount') {
          const numValue = Math.max(0, parseFloat(value) || 0);
          newDebt.interestAmount = numValue;
          // Deducir el porcentaje simple a partir del monto en pesos
          newDebt.interestRate = newDebt.baseAmount > 0 ? Number(((numValue / newDebt.baseAmount) * 100).toFixed(2)) : 0;
          newDebt.total = Number((newDebt.baseAmount + numValue).toFixed(2));
        }
        return newDebt;
      }
      return debt;
    });
    setEditingDebts(updated);
  };

  const toggleSelection = (safeId: string) => {
    if (selectedDebtIds.includes(safeId)) {
      setSelectedDebtIds(selectedDebtIds.filter(itemId => itemId !== safeId));
    } else {
      setSelectedDebtIds([...selectedDebtIds, safeId]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedDebtIds.length === editingDebts.length) {
      setSelectedDebtIds([]);
    } else {
      setSelectedDebtIds(editingDebts.map((d, i) => d.id || d.period || String(i)));
    }
  };

  const applyBulkInterest = () => {
    if (bulkInterestRate === '' || selectedDebtIds.length === 0) return;
    const rate = Number(bulkInterestRate);
    const dateApplied = new Date().toISOString();

    const updated = editingDebts.map((debt, i) => {
      const safeId = debt.id || debt.period || String(i);
      if (selectedDebtIds.includes(safeId)) {
        // Interés simple calculado sobre el capital base original del período
        const addedAmount = Number((debt.baseAmount * (rate / 100)).toFixed(2));
        const newInterestAmount = Number(((debt.interestAmount || 0) + addedAmount).toFixed(2));
        const newTotal = Number((debt.baseAmount + newInterestAmount).toFixed(2));
        const newRate = debt.baseAmount > 0 
          ? Number(((newInterestAmount / debt.baseAmount) * 100).toFixed(2)) 
          : rate;

        const currentLogs: InterestLog[] = debt.interestLogs ? [...debt.interestLogs] : [];
        const newLog: InterestLog = {
          dateApplied,
          rate,
          addedAmount,
          currentTotal: newTotal
        };

        return { 
          ...debt, 
          interestRate: newRate, 
          interestAmount: newInterestAmount, 
          total: newTotal,
          interestLogs: [...currentLogs, newLog]
        };
      }
      return debt;
    });

    setEditingDebts(updated);
    setSelectedDebtIds([]);
    setBulkInterestRate('');
  };

  const removeBulkInterest = () => {
    if (selectedDebtIds.length === 0) return;
    const updated = editingDebts.map((debt, i) => {
      const safeId = debt.id || debt.period || String(i);
      if (selectedDebtIds.includes(safeId)) {
        return {
          ...debt,
          interestRate: 0,
          interestAmount: 0,
          total: Number(debt.baseAmount.toFixed(2)),
          interestLogs: []
        };
      }
      return debt;
    });
    setEditingDebts(updated);
    setSelectedDebtIds([]);
  };

  const saveDebts = async () => {
    if (!selectedUnit) return;
    setIsSaving(true);
    try {
      // Se guardan los intereses aplicados para que queden reflejados en el PDF y el Kárdex
      const cleanDebts = editingDebts.map(d => ({
        id: d.id,
        period: d.period || '',
        baseAmount: Number(d.baseAmount) || 0,
        paidAmount: Number(d.paidAmount) || 0,
        interestRate: Number(d.interestRate) || 0,
        interestAmount: Number(d.interestAmount) || 0,
        total: Number(d.total) || 0,
        createdAt: d.createdAt || new Date().toISOString(),
        interestLogs: d.interestLogs || []
      }));

      await onUpdateUnit(selectedUnit.id, { debts: cleanDebts });
      alert("¡Guardado exitoso!\n\nLos intereses se han guardado y quedarán reflejados en el detalle y en el PDF.");

      setSelectedUnit({ ...selectedUnit, debts: cleanDebts });
      setEditingDebts(cleanDebts);
      if (setUnits) {
        setUnits(prev => prev.map(u => u.id === selectedUnit.id ? { ...u, debts: cleanDebts } : u));
      }
    } catch (error) {
      alert("Error al guardar el historial de deuda.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- DESCARGAR PLANTILLA EXCEL ---
  const handleDownloadBlankTemplate = () => {
    const templateData = [
      {
        "Unidad": "1A",
        "Periodo": "Enero 2024",
        "MontoBase": 45000,
        "InteresAcumulado": 4500
      },
      {
        "Unidad": "1A",
        "Periodo": "Febrero 2024",
        "MontoBase": 48000,
        "InteresAcumulado": 2400
      },
      {
        "Unidad": "2B",
        "Periodo": "Marzo 2024",
        "MontoBase": 52000,
        "InteresAcumulado": 0
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Deudas");
    worksheet['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 20 }];
    XLSX.writeFile(workbook, "plantilla_deudas_historicas.xlsx");
  };

  // --- IMPORTACIÓN MASIVA EXCEL ---
  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
          return;
        }

        const cleanKey = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
        const getRowValue = (row: any, ...aliases: string[]): any => {
          const rowKeys = Object.keys(row);
          for (const alias of aliases) {
            const cleanedAlias = cleanKey(alias);
            const foundKey = rowKeys.find(k => cleanKey(k) === cleanedAlias);
            if (foundKey && row[foundKey] !== undefined) {
              return row[foundKey];
            }
          }
          return undefined;
        };

        const parsedRows: ParsedDebtRow[] = [];
        rows.forEach((row, idx) => {
          const unitVal = String(getRowValue(row, "Unidad", "Depto", "UF", "Unidad Funcional") || "").trim();
          const periodVal = String(getRowValue(row, "Periodo", "Período", "Mes") || "").trim();
          const baseAmountRaw = getRowValue(row, "MontoBase", "Monto Base", "Capital", "Base", "Importe");
          const interestRaw = getRowValue(row, "InteresAcumulado", "Interés Acumulado", "Interes", "Interés");

          if (!unitVal && !periodVal && baseAmountRaw === undefined) {
            return;
          }

          const baseAmount = Math.max(0, typeof baseAmountRaw === 'number' ? baseAmountRaw : parseFloat(String(baseAmountRaw || '').replace(/[^0-9.-]/g, '')) || 0);
          const interestAmount = Math.max(0, typeof interestRaw === 'number' ? interestRaw : parseFloat(String(interestRaw || '').replace(/[^0-9.-]/g, '')) || 0);
          const rowNum = idx + 2;

          if (!unitVal) {
            parsedRows.push({
              rowNumber: rowNum,
              unitNumber: 'Desconocida',
              period: periodVal || 'Sin período',
              baseAmount,
              accumulatedInterest: interestAmount,
              status: 'INVALID_DATA',
              errorMessage: 'Falta especificar la columna Unidad.'
            });
            return;
          }

          const targetUnit = units.find(u => u.unitNumber.trim().toLowerCase() === unitVal.toLowerCase());
          if (!targetUnit) {
            parsedRows.push({
              rowNumber: rowNum,
              unitNumber: unitVal,
              period: periodVal || '-',
              baseAmount,
              accumulatedInterest: interestAmount,
              status: 'UNIT_NOT_FOUND',
              errorMessage: `La unidad "${unitVal}" no existe en el consorcio actual.`
            });
            return;
          }

          if (!periodVal || baseAmount <= 0) {
            parsedRows.push({
              rowNumber: rowNum,
              unitNumber: unitVal,
              period: periodVal || '-',
              baseAmount,
              accumulatedInterest: interestAmount,
              status: 'INVALID_DATA',
              errorMessage: 'Debe contener un período válido y un MontoBase mayor a 0.'
            });
            return;
          }

          parsedRows.push({
            rowNumber: rowNum,
            unitNumber: targetUnit.unitNumber,
            period: periodVal,
            baseAmount,
            accumulatedInterest: interestAmount,
            status: 'VALID',
            unitId: targetUnit.id
          });
        });

        const validRows = parsedRows.filter(r => r.status === 'VALID');
        const ignoredRows = parsedRows.filter(r => r.status !== 'VALID');

        if (validRows.length === 0) {
          alert("No se encontraron filas válidas para importar. Verifica que los nombres de unidad coincidan exactamente con los registrados en el consorcio.");
          return;
        }

        // Agrupar filas válidas por unidad
        const groupsMap = new Map<string, GroupedUnitDebts>();
        validRows.forEach(r => {
          const u = units.find(unit => unit.id === r.unitId)!;
          if (!groupsMap.has(u.id)) {
            groupsMap.set(u.id, {
              unitId: u.id,
              unitNumber: u.unitNumber,
              ownerName: u.ownerName,
              newDebts: [],
              existingDebtsCount: (u.debts || []).length,
              subtotalBase: 0,
              subtotalInterest: 0,
              subtotalDebt: 0
            });
          }

          const group = groupsMap.get(u.id)!;
          const interestRate = r.baseAmount > 0 
            ? Number(((r.accumulatedInterest / r.baseAmount) * 100).toFixed(2)) 
            : 0;
          const total = Number((r.baseAmount + r.accumulatedInterest).toFixed(2));
          const createdAt = new Date().toISOString();
          const interestLogs: InterestLog[] = r.accumulatedInterest > 0 ? [{
            dateApplied: createdAt,
            rate: interestRate,
            addedAmount: r.accumulatedInterest,
            currentTotal: total
          }] : [];

          const newDebt: DebtItem = {
            id: `debt_imp_${Date.now()}_${group.newDebts.length}_${Math.random().toString(36).substr(2, 6)}`,
            period: r.period,
            baseAmount: r.baseAmount,
            interestRate,
            interestAmount: r.accumulatedInterest,
            total,
            paidAmount: 0,
            createdAt,
            interestLogs
          };

          group.newDebts.push(newDebt);
          group.subtotalBase += r.baseAmount;
          group.subtotalInterest += r.accumulatedInterest;
          group.subtotalDebt += total;
        });

        const groupedUpdates = Array.from(groupsMap.values());
        const totalBaseAmount = validRows.reduce((sum, r) => sum + r.baseAmount, 0);
        const totalInterestAmount = validRows.reduce((sum, r) => sum + r.accumulatedInterest, 0);
        const totalDebtAmount = totalBaseAmount + totalInterestAmount;

        setPreviewSummary({
          totalRows: parsedRows.length,
          validRowsCount: validRows.length,
          invalidRowsCount: parsedRows.filter(r => r.status === 'INVALID_DATA').length,
          unitNotFoundCount: parsedRows.filter(r => r.status === 'UNIT_NOT_FOUND').length,
          affectedUnitsCount: groupedUpdates.length,
          totalBaseAmount,
          totalInterestAmount,
          totalDebtAmount,
          groupedUpdates,
          ignoredRows
        });

        setImportMode('REPLACE');
        setIsImportModalOpen(true);
      } catch (err) {
        console.error("Error al procesar el archivo Excel:", err);
        alert("Ocurrió un error al leer el archivo Excel. Verifica que tenga un formato válido (.xlsx).");
      } finally {
        if (e.target) e.target.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (!previewSummary || !consortium) return;
    setIsImportingToFirebase(true);

    try {
      const finalUpdates = previewSummary.groupedUpdates.map(group => {
        const unit = units.find(u => u.id === group.unitId);
        const existingDebts = unit?.debts || [];
        const finalDebts = importMode === 'REPLACE'
          ? group.newDebts
          : [...existingDebts, ...group.newDebts];
        return {
          unitId: group.unitId,
          debts: finalDebts
        };
      });

      await importDebtsBatch(consortium.id, finalUpdates);

      // Actualizar estado en memoria
      if (setUnits) {
        setUnits(prevUnits => prevUnits.map(u => {
          const match = finalUpdates.find(up => up.unitId === u.id);
          return match ? { ...u, debts: match.debts } : u;
        }));
      }

      if (selectedUnit) {
        const match = finalUpdates.find(up => up.unitId === selectedUnit.id);
        if (match) {
          setSelectedUnit({ ...selectedUnit, debts: match.debts });
          setEditingDebts(match.debts);
        }
      }

      setIsImportModalOpen(false);
      const alertMsg = importMode === 'REPLACE'
        ? `¡Saneamiento exitoso!\n\nSe reemplazó el historial de ${finalUpdates.length} unidades funcionales (${previewSummary.validRowsCount} períodos de deuda) por un total de ${formatCurrency(previewSummary.totalDebtAmount)}.`
        : `¡Importación exitosa!\n\nSe anexaron ${previewSummary.validRowsCount} períodos de deuda a ${finalUpdates.length} unidades funcionales por un total de ${formatCurrency(previewSummary.totalDebtAmount)}.`;

      alert(alertMsg);
      setPreviewSummary(null);
    } catch (error) {
      console.error("Error al guardar en Firebase:", error);
      alert("Error al guardar la importación en Firebase. Revisa tu conexión a internet.");
    } finally {
      setIsImportingToFirebase(false);
    }
  };

  const exportPDF = () => {
    if (!selectedUnit) return;
    const tempUnit = { ...selectedUnit, debts: editingDebts };
    generateDebtDetailPDF(tempUnit, consortium);
  };

  const currentUnitDebt = getUnitDebt(selectedUnit);
  const realTimeHistoricalDebt = editingDebts.reduce((sum, d) => sum + d.total, 0) + (selectedUnit?.initialBalance || 0);
  const totalBaseDebt = editingDebts.reduce((sum, d) => sum + (d.baseAmount || 0), 0) + (selectedUnit?.initialBalance || 0);
  const totalInterestDebt = editingDebts.reduce((sum, d) => sum + (d.interestAmount || 0), 0);

  const filteredUnits = units.filter(u =>
    u.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.ownerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            Gestión de Deudas y Pendientes
          </h2>
          <p className="text-slate-500">Visualiza saldos pendientes del mes y administra la morosidad histórica.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadBlankTemplate}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors border border-slate-200 shadow-sm"
            title="Descargar plantilla de Excel con formato de ejemplo"
          >
            <Download className="w-4 h-4 text-slate-600" />
            Plantilla Excel
          </button>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
            title="Importar deudas históricas masivas desde Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Importar Deudas (Excel)
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleExcelFileSelect}
            accept=".xlsx, .xls"
            className="hidden"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LISTADO DE UNIDADES */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[700px]">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar unidad..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filteredUnits.map(unit => {
              const uDebtObj = getUnitDebt(unit);
              return (
                <button
                  key={unit.id}
                  onClick={() => handleSelectUnit(unit)}
                  className={`w-full p-4 flex items-center justify-between border-b border-slate-50 transition-colors ${selectedUnit?.id === unit.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-slate-50 border-l-4 border-transparent'
                    }`}
                >
                  <div className="text-left flex-1">
                    <p className="font-bold text-slate-800">{unit.unitNumber}</p>
                    <p className="text-xs text-slate-500 truncate w-32">{unit.ownerName}</p>
                  </div>

                  <div className="text-right flex flex-col items-end gap-1 pr-2">
                    {uDebtObj.historical > 0 && (
                      <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-200 shadow-sm flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {formatCurrency(uDebtObj.historical)}
                      </span>
                    )}
                    {uDebtObj.current > 0 && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200 shadow-sm flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatCurrency(uDebtObj.current)}
                      </span>
                    )}
                    {uDebtObj.total <= 0 && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        Al día
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedUnit ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-[700px]">

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Detalle: {selectedUnit.unitNumber}</h2>
                  <p className="text-sm text-slate-500">{selectedUnit.ownerName}</p>
                </div>

                <div className="flex gap-4 text-right">
                  {currentUnitDebt.current > 0 && (
                    <div className="bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                      <p className="text-[10px] text-amber-600 uppercase font-bold tracking-wider">Mes Pendiente</p>
                      <p className="text-xl font-black text-amber-600">{formatCurrency(currentUnitDebt.current)}</p>
                    </div>
                  )}
                  <div className="bg-red-50 px-3 py-2 rounded-lg border border-red-100 text-right">
                    <p className="text-[10px] text-red-600 uppercase font-bold tracking-wider">Deuda Histórica</p>
                    <p className="text-xl font-black text-red-600">{formatCurrency(realTimeHistoricalDebt)}</p>
                    <p className="text-[10px] text-slate-500 font-medium">Base: {formatCurrency(totalBaseDebt)} | Int: {formatCurrency(totalInterestDebt)}</p>
                  </div>
                </div>
              </div>

              {currentUnitDebt.current > 0 && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-amber-800">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-sm">Saldo impago del mes actual detectado</p>
                      <p className="text-xs text-amber-700">Período {currentUnitDebt.pendingPeriod}: {formatCurrency(currentUnitDebt.current)}</p>
                    </div>
                  </div>
                  <button
                    onClick={addSuggestedDebt}
                    className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-lg transition-colors border border-amber-300 shadow-sm"
                  >
                    + Pasar a Morosidad
                  </button>
                </div>
              )}

              {editingDebts.length > 0 && (
                <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm font-bold text-indigo-800">
                      {selectedDebtIds.length} seleccionados
                    </span>
                  </div>
                  <div className="h-6 w-px bg-indigo-200 mx-2 hidden sm:block"></div>
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <span className="text-sm text-indigo-700">Aplicar interés:</span>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Ej: 7.3"
                      className="w-20 p-1.5 border border-indigo-200 rounded text-sm outline-none focus:border-indigo-500"
                      value={bulkInterestRate}
                      onChange={(e) => setBulkInterestRate(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                    <span className="text-sm font-bold text-indigo-700">%</span>
                    <button
                      onClick={applyBulkInterest}
                      disabled={selectedDebtIds.length === 0 || bulkInterestRate === ''}
                      className="ml-auto px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      Aplicar Lote
                    </button>
                    <button
                      onClick={removeBulkInterest}
                      disabled={selectedDebtIds.length === 0}
                      className="px-3 py-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300 text-xs font-bold rounded disabled:opacity-50 transition-colors shadow-sm"
                      title="Quitar intereses de los períodos seleccionados"
                    >
                      Quitar Interés
                    </button>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto pr-2 space-y-3 mb-6">
                <div className="grid grid-cols-12 gap-2 px-2 text-[10px] font-bold text-slate-400 uppercase items-center">
                  <div className="col-span-1 flex justify-center">
                    <input
                      type="checkbox"
                      checked={editingDebts.length > 0 && selectedDebtIds.length === editingDebts.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                  <div className="col-span-3">Período / Mes</div>
                  <div className="col-span-2">Monto Base</div>
                  <div className="col-span-2">% Int</div>
                  <div className="col-span-2">Interés $</div>
                  <div className="col-span-2 text-right">Subtotal</div>
                </div>

                {selectedUnit.initialBalance > 0 && (
                  <div className="grid grid-cols-12 gap-2 items-center p-3 rounded-lg bg-orange-50 border border-orange-200 text-orange-800">
                    <div className="col-span-1"></div>
                    <div className="col-span-3 font-bold text-sm">Saldo Inicial</div>
                    <div className="col-span-2 font-medium">{formatCurrency(selectedUnit.initialBalance)}</div>
                    <div className="col-span-2">-</div>
                    <div className="col-span-2">-</div>
                    <div className="col-span-2 text-right font-bold">{formatCurrency(selectedUnit.initialBalance)}</div>
                  </div>
                )}

                {editingDebts.length === 0 && selectedUnit.initialBalance === 0 && (
                  <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                    <p className="text-slate-400 font-medium">Esta unidad no registra deuda histórica.</p>
                  </div>
                )}

                {editingDebts.map((debt, index) => {
                  const safeId = debt.id || debt.period || String(index);
                  return (
                    <div key={safeId} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg group border transition-colors ${selectedDebtIds.includes(safeId) ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="col-span-1 flex justify-center">
                        <input
                          type="checkbox"
                          checked={selectedDebtIds.includes(safeId)}
                          onChange={() => toggleSelection(safeId)}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                      <div className="col-span-3">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="Ej: Marzo 2026"
                            className="w-full bg-white border border-slate-200 rounded text-sm p-2 outline-none focus:border-indigo-500"
                            value={debt.period}
                            onChange={(e) => updateDebtField(safeId, 'period', e.target.value)}
                          />
                          {debt.interestLogs && debt.interestLogs.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setViewingLogsDebt(debt)}
                              className="flex-shrink-0 p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded border border-indigo-200 transition-colors"
                              title={`Ver ${debt.interestLogs.length} aplicaciones de interés histórico (Kárdex)`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="relative">
                          <span className="absolute left-2 top-2 text-slate-400 text-sm">$</span>
                          <input
                            type="number"
                            className="w-full pl-6 bg-white border border-slate-200 rounded text-sm p-2 outline-none focus:border-indigo-500"
                            value={debt.baseAmount === 0 ? '' : debt.baseAmount}
                            onChange={(e) => updateDebtField(safeId, 'baseAmount', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            className="w-full pr-6 bg-white border border-slate-200 rounded text-sm p-2 outline-none focus:border-indigo-500"
                            value={debt.interestRate === 0 ? '' : debt.interestRate}
                            onChange={(e) => updateDebtField(safeId, 'interestRate', e.target.value)}
                          />
                          <span className="absolute right-2 top-2 text-slate-400 text-sm">%</span>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="relative">
                          <span className="absolute left-2 top-2 text-slate-400 text-sm">$</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="w-full pl-6 bg-white border border-slate-200 rounded text-sm p-2 outline-none focus:border-indigo-500"
                            value={debt.interestAmount === 0 ? '' : debt.interestAmount}
                            onChange={(e) => updateDebtField(safeId, 'interestAmount', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <span className="text-sm font-bold text-slate-800">
                          {formatCurrency(debt.total)}
                        </span>
                        <button
                          onClick={() => removeDebtRow(safeId)}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={addDebtRow}
                    className="flex-1 py-3 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 text-sm font-bold hover:bg-slate-50 hover:text-indigo-600 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Agregar Deuda Manual
                  </button>

                  {editingDebts.length > 0 && (
                    <button
                      onClick={clearAllDebts}
                      className="px-4 py-3 border-2 border-red-200 bg-red-50 rounded-lg text-red-600 text-sm font-bold hover:bg-red-100 flex items-center justify-center gap-2 transition-colors shadow-sm"
                      title="Borrar todas las deudas de la lista"
                    >
                      <Trash2 className="w-4 h-4" /> Vaciar Lista
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  onClick={exportPDF}
                  className="flex items-center gap-2 px-6 py-3 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <Download className="w-4 h-4" /> PDF Deuda
                </button>
                <button
                  onClick={saveDebts}
                  disabled={isSaving}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50 transition-all"
                >
                  <Save className="w-5 h-5" /> {isSaving ? 'Guardando...' : 'Guardar Sistema'}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-[700px] flex flex-col items-center justify-center bg-white rounded-xl shadow-sm border border-slate-200 text-slate-400">
              <Users className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg">Selecciona una unidad en el panel izquierdo</p>
              <p className="text-sm">Para administrar y visualizar sus saldos</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL KÁRDEX MATRICIAL: HISTORIAL EVOLUTIVO DE INTERESES */}
      {viewingLogsDebt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Historial Evolutivo de Intereses</h3>
                  <p className="text-xs text-slate-500">Período: <span className="font-bold text-slate-700">{viewingLogsDebt.period}</span> — Base: <span className="font-bold text-slate-700">{formatCurrency(viewingLogsDebt.baseAmount)}</span></p>
                </div>
              </div>
              <button 
                onClick={() => setViewingLogsDebt(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 overflow-y-auto flex-1 pr-1">
              <div className="bg-slate-50 rounded-xl p-3 mb-4 flex justify-between items-center text-xs text-slate-600 border border-slate-200">
                <span>Total Actual: <strong className="text-indigo-700 text-sm">{formatCurrency(viewingLogsDebt.total)}</strong></span>
                <span>Interés Acumulado: <strong className="text-amber-700 text-sm">{formatCurrency(viewingLogsDebt.interestAmount)}</strong></span>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400 uppercase px-3 py-1">
                  <span className="col-span-4">Fecha</span>
                  <span className="col-span-2 text-center">Tasa</span>
                  <span className="col-span-3 text-right">Interés Aplicado</span>
                  <span className="col-span-3 text-right">Subtotal</span>
                </div>

                {(viewingLogsDebt.interestLogs || []).map((log, lIdx) => (
                  <div key={lIdx} className="grid grid-cols-12 items-center p-3 rounded-lg bg-white border border-slate-200 text-xs shadow-sm">
                    <div className="col-span-4 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-[10px]">{lIdx + 1}</span>
                      <span className="font-medium text-slate-700">
                        {log.dateApplied ? new Date(log.dateApplied).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                      </span>
                    </div>
                    <div className="col-span-2 text-center font-bold text-indigo-600">
                      +{log.rate}%
                    </div>
                    <div className="col-span-3 text-right font-semibold text-amber-700">
                      +{formatCurrency(log.addedAmount)}
                    </div>
                    <div className="col-span-3 text-right font-bold text-slate-800">
                      {formatCurrency(log.currentTotal)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewingLogsDebt(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESUMEN DE IMPORTACIÓN DE DEUDAS (EXCEL) */}
      {isImportModalOpen && previewSummary && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-xl">Resumen de Importación de Deudas</h3>
                  <p className="text-xs text-slate-500">Revisa los datos antes de actualizar la base de datos en Firebase.</p>
                </div>
              </div>
              <button 
                onClick={() => { setIsImportModalOpen(false); setPreviewSummary(null); }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 overflow-y-auto flex-1 pr-1 space-y-4">
              {/* Tarjetas de métricas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Unidades</p>
                  <p className="text-lg font-black text-slate-800">{previewSummary.affectedUnitsCount}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Períodos</p>
                  <p className="text-lg font-black text-indigo-600">{previewSummary.validRowsCount}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Capital Base</p>
                  <p className="text-base font-black text-slate-700">{formatCurrency(previewSummary.totalBaseAmount)}</p>
                </div>
                <div className="bg-red-50 p-3 rounded-xl border border-red-200">
                  <p className="text-[10px] text-red-600 uppercase font-bold tracking-wider">Deuda Total</p>
                  <p className="text-base font-black text-red-700">{formatCurrency(previewSummary.totalDebtAmount)}</p>
                </div>
              </div>

              {/* Advertencia de filas ignoradas / unidades inexistentes */}
              {previewSummary.ignoredRows.length > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Se omitirán {previewSummary.ignoredRows.length} fila(s) con errores o unidades no encontradas:</span>
                  </div>
                  <div className="max-h-24 overflow-y-auto pl-6 space-y-1 text-[11px]">
                    {previewSummary.ignoredRows.map((ign, idx) => (
                      <p key={idx}>
                        • Fila {ign.rowNumber} (Unidad: <strong>"{ign.unitNumber}"</strong>): {ign.errorMessage}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Selector de modo: Saneamiento vs Anexo */}
              <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <p className="text-xs font-bold text-indigo-900 mb-2">Selecciona el modo de actualización:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-2.5 ${importMode === 'REPLACE' ? 'bg-white border-indigo-500 shadow-sm ring-1 ring-indigo-500' : 'bg-slate-50/60 border-slate-200 hover:bg-white'}`}>
                    <input
                      type="radio"
                      name="importMode"
                      value="REPLACE"
                      checked={importMode === 'REPLACE'}
                      onChange={() => setImportMode('REPLACE')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-800">Reemplazar Historial (Saneamiento)</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Sobrescribe las deudas anteriores de las unidades del Excel por este nuevo desglose.</p>
                    </div>
                  </label>

                  <label className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-2.5 ${importMode === 'APPEND' ? 'bg-white border-indigo-500 shadow-sm ring-1 ring-indigo-500' : 'bg-slate-50/60 border-slate-200 hover:bg-white'}`}>
                    <input
                      type="radio"
                      name="importMode"
                      value="APPEND"
                      checked={importMode === 'APPEND'}
                      onChange={() => setImportMode('APPEND')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-800">Anexar a Deudas Existentes</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Conserva las deudas anteriores y agrega las del Excel como nuevos períodos.</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Vista previa de unidades a importar */}
              <div>
                <p className="text-xs font-bold text-slate-700 mb-2">Detalle de Unidades a Modificar:</p>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {previewSummary.groupedUpdates.map(group => (
                    <div key={group.unitId} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div>
                        <p className="font-bold text-slate-800">Unidad {group.unitNumber}</p>
                        <p className="text-slate-500 text-[11px]">{group.ownerName} • {group.newDebts.length} período(s) en Excel</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">{formatCurrency(group.subtotalDebt)}</p>
                        <p className="text-[10px] text-slate-400">Base: {formatCurrency(group.subtotalBase)} | Int: {formatCurrency(group.subtotalInterest)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => { setIsImportModalOpen(false); setPreviewSummary(null); }}
                disabled={isImportingToFirebase}
                className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={isImportingToFirebase}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 text-xs disabled:opacity-50"
              >
                {isImportingToFirebase ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando en Firebase...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar e Importar ({previewSummary.validRowsCount} deudas)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebtorsView;