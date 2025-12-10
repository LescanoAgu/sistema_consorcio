
import React, { useState } from 'react';
import { Unit } from '../types';
import { Plus, Trash2, Save, X, Mail, Upload, FileText, Download, AlertCircle, CheckCircle2 } from 'lucide-react';

interface UnitsViewProps {
  units: Unit[];
  setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
}

const UnitsView: React.FC<UnitsViewProps> = ({ units, setUnits }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [newUnit, setNewUnit] = useState<Partial<Unit>>({ unitNumber: '', ownerName: '', proratePercentage: 0, initialBalance: 0, linkedEmail: '' });

  const totalPercentage = units.reduce((acc, u) => acc + u.proratePercentage, 0);

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleAdd = () => {
    if (!newUnit.unitNumber || !newUnit.ownerName) {
        alert("Por favor complete el Número de Unidad y el Nombre del Propietario.");
        return;
    }

    if (newUnit.linkedEmail && !isValidEmail(newUnit.linkedEmail)) {
        alert("El correo electrónico ingresado no tiene un formato válido.");
        return;
    }

    const unit: Unit = {
      id: crypto.randomUUID(),
      unitNumber: newUnit.unitNumber,
      ownerName: newUnit.ownerName,
      proratePercentage: Number(newUnit.proratePercentage),
      initialBalance: Number(newUnit.initialBalance || 0),
      linkedEmail: newUnit.linkedEmail || '',
    };
    setUnits([...units, unit]);
    setNewUnit({ unitNumber: '', ownerName: '', proratePercentage: 0, initialBalance: 0, linkedEmail: '' });
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Está seguro de eliminar esta unidad?')) {
      setUnits(units.filter(u => u.id !== id));
    }
  };

  const handleProcessImport = () => {
    if(!importText.trim()) return;

    try {
        const lines = importText.split(/\r?\n/);
        const newUnits: Unit[] = [];
        
        lines.forEach(line => {
            if(!line.trim()) return;
            // Support comma or semicolon or tab separator
            const parts = line.split(/[,;\t]/); 
            if(parts.length >= 2) {
                const unitNumber = parts[0]?.trim();
                const ownerName = parts[1]?.trim();
                const proratePercentage = parseFloat(parts[2]?.trim() || '0');
                const initialBalance = parseFloat(parts[3]?.trim() || '0');
                const linkedEmail = parts[4]?.trim() || '';

                if(unitNumber && ownerName) {
                    newUnits.push({
                        id: crypto.randomUUID(),
                        unitNumber,
                        ownerName,
                        proratePercentage: isNaN(proratePercentage) ? 0 : proratePercentage,
                        initialBalance: isNaN(initialBalance) ? 0 : initialBalance,
                        linkedEmail: isValidEmail(linkedEmail) ? linkedEmail : ''
                    });
                }
            }
        });

        if (newUnits.length > 0) {
            if(confirm(`Se detectaron ${newUnits.length} unidades válidas. ¿Desea reemplazar la lista actual o agregar al final?\n\nOK: Reemplazar lista actual\nCancelar: Agregar al final`)) {
                setUnits(newUnits);
            } else {
                setUnits([...units, ...newUnits]);
            }
            setShowImport(false);
            setImportText('');
        } else {
            alert('No se pudieron detectar unidades válidas. Verifique el formato.');
        }

    } catch (e) {
        alert('Error al procesar el texto. Verifique el formato.');
    }
  };

  const downloadExample = () => {
      const text = "1A, Juan Perez, 5.25, 0, juan@email.com\n1B, Maria Gonzalez, 5.25, 1000, maria@email.com\n2A, Pedro Lopez, 8.50, 0, \n2B, Ana Silva, 8.50, 0, ana@email.com";
      const element = document.createElement("a");
      const file = new Blob([text], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = "ejemplo_carga_unidades.txt";
      document.body.appendChild(element);
      element.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Unidades Funcionales</h2>
        <div className="flex gap-2">
            <button
            onClick={() => setShowImport(true)}
            className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 px-4 py-2 rounded-lg flex items-center shadow-sm transition-colors"
            >
            <Upload className="w-4 h-4 mr-2" />
            Importar / Carga Masiva
            </button>
            <button
            onClick={() => setIsAdding(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center shadow-sm transition-colors"
            >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Unidad
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <span className="text-sm font-medium text-slate-600">Total Porcentual:</span>
            <span className={`text-sm font-bold flex items-center ${Math.abs(totalPercentage - 100) < 0.1 ? 'text-emerald-600' : 'text-red-500'}`}>
                {Math.abs(totalPercentage - 100) < 0.1 ? <CheckCircle2 className="w-4 h-4 mr-1"/> : <AlertCircle className="w-4 h-4 mr-1"/>}
                {totalPercentage.toFixed(2)}% {Math.abs(totalPercentage - 100) >= 0.1 && '(Debe sumar 100%)'}
            </span>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
              <th className="px-6 py-3 font-medium">Unidad</th>
              <th className="px-6 py-3 font-medium">Propietario / Email</th>
              <th className="px-6 py-3 font-medium text-right">Saldo Inicial</th>
              <th className="px-6 py-3 font-medium text-right">Prorrateo (%)</th>
              <th className="px-6 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {isAdding && (
              <tr className="bg-indigo-50/50 animate-fade-in">
                <td className="px-6 py-4 align-top">
                  <input
                    type="text"
                    placeholder="Ej: 1A"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all"
                    value={newUnit.unitNumber}
                    onChange={e => setNewUnit({ ...newUnit, unitNumber: e.target.value })}
                  />
                </td>
                <td className="px-6 py-4 space-y-2 align-top">
                  <input
                    type="text"
                    placeholder="Nombre Completo"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all"
                    value={newUnit.ownerName}
                    onChange={e => setNewUnit({ ...newUnit, ownerName: e.target.value })}
                  />
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                        type="email"
                        placeholder="email@login.com (opcional)"
                        className={`w-full pl-9 px-3 py-2 bg-white border rounded-lg text-slate-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm ${newUnit.linkedEmail && !isValidEmail(newUnit.linkedEmail) ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-slate-300 focus:border-indigo-500'}`}
                        value={newUnit.linkedEmail}
                        onChange={e => setNewUnit({ ...newUnit, linkedEmail: e.target.value })}
                    />
                  </div>
                </td>
                 <td className="px-6 py-4 align-top">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 text-right focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all"
                    value={newUnit.initialBalance}
                    onChange={e => setNewUnit({ ...newUnit, initialBalance: parseFloat(e.target.value) })}
                  />
                </td>
                <td className="px-6 py-4 align-top">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 text-right focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all"
                    value={newUnit.proratePercentage}
                    onChange={e => setNewUnit({ ...newUnit, proratePercentage: parseFloat(e.target.value) })}
                  />
                </td>
                <td className="px-6 py-4 text-right align-top">
                  <div className="flex justify-end gap-2">
                    <button onClick={handleAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg transition-colors shadow-sm" title="Guardar">
                        <Save className="w-5 h-5" />
                    </button>
                    <button onClick={() => setIsAdding(false)} className="bg-white border border-slate-300 text-slate-500 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors shadow-sm" title="Cancelar">
                        <X className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {units.map((unit) => (
              <tr key={unit.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-700">{unit.unitNumber}</td>
                <td className="px-6 py-4 text-slate-600">
                    <div className="font-medium text-slate-800">{unit.ownerName}</div>
                    {unit.linkedEmail ? (
                        <div className="text-xs text-indigo-500 flex items-center mt-1">
                            <Mail className="w-3 h-3 mr-1" /> {unit.linkedEmail}
                        </div>
                    ) : (
                        <div className="text-xs text-slate-400 mt-1">- Sin email -</div>
                    )}
                </td>
                <td className="px-6 py-4 text-slate-600 text-right font-medium">${unit.initialBalance?.toFixed(2) || '0.00'}</td>
                <td className="px-6 py-4 text-slate-600 text-right">{unit.proratePercentage.toFixed(2)}%</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleDelete(unit.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
            {units.length === 0 && !isAdding && (
                <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center">
                            <Plus className="w-12 h-12 mb-3 opacity-20" />
                            <p className="font-medium">No hay unidades cargadas</p>
                            <p className="text-sm">Comience agregando el primer departamento.</p>
                        </div>
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Import Modal */}
      {showImport && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl animate-fade-in flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-xl font-bold text-slate-800">Carga Masiva de Unidades</h3>
                      <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-red-500">
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto">
                      <div className="bg-indigo-50 p-4 rounded-lg mb-4 text-sm text-indigo-900 border border-indigo-100">
                          <p className="font-bold mb-2 flex items-center"><FileText className="w-4 h-4 mr-2"/> Instrucciones:</p>
                          <ul className="list-disc list-inside space-y-1 ml-1 opacity-90">
                              <li>Copie y pegue los datos desde Excel o un archivo de texto.</li>
                              <li>Formato requerido: <strong>Unidad, Propietario, %, SaldoInicial, Email</strong></li>
                              <li>Separadores soportados: Coma (,) Punto y coma (;) o Tabulación.</li>
                          </ul>
                          <button onClick={downloadExample} className="mt-3 text-indigo-600 underline text-xs font-semibold flex items-center">
                              <Download className="w-3 h-3 mr-1"/> Descargar ejemplo .txt
                          </button>
                      </div>

                      <textarea 
                          className="w-full h-48 p-4 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          placeholder={`1A, Juan Perez, 12.5, 0, juan@email.com\n1B, Maria Gomez, 12.5, 5000, maria@email.com\n...`}
                          value={importText}
                          onChange={(e) => setImportText(e.target.value)}
                      ></textarea>
                  </div>

                  <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
                       <button 
                          onClick={() => setShowImport(false)}
                          className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-200 rounded-lg transition-colors"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={handleProcessImport}
                          disabled={!importText.trim()}
                          className={`px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm flex items-center transition-colors ${!importText.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                          <Save className="w-4 h-4 mr-2" />
                          Procesar Datos
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default UnitsView;
