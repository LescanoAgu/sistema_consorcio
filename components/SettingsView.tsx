import React, { useState, useEffect } from 'react';
import { ConsortiumSettings } from '../types';
import { Save, Building, DollarSign } from 'lucide-react';

interface SettingsViewProps {
  currentSettings: ConsortiumSettings;
  onSave: (settings: ConsortiumSettings) => Promise<void>;
}

const SettingsView: React.FC<SettingsViewProps> = ({ currentSettings, onSave }) => {
  const [formData, setFormData] = useState<ConsortiumSettings>(currentSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Sincronizar estado si las props cambian externamente
  useEffect(() => {
    setFormData(currentSettings);
  }, [currentSettings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('Percentage') || name.includes('Balance') ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMsg('');
    try {
      await onSave(formData);
      setMsg('¡Configuración guardada correctamente!');
    } catch (error) {
      setMsg('Error al guardar la configuración.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <Building className="w-6 h-6 text-indigo-600" />
        Configuración del Consorcio
      </h2>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Sección Datos Bancarios */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Datos Bancarios (Para Expensas)
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Banco</label>
              <input type="text" name="bankName" value={formData.bankName} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Ej: Banco Nación" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CBU / CVU</label>
              <input type="text" name="bankCBU" value={formData.bankCBU} onChange={handleChange} className="w-full p-2 border rounded font-mono" placeholder="22 dígitos" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Alias</label>
              <input type="text" name="bankAlias" value={formData.bankAlias} onChange={handleChange} className="w-full p-2 border rounded font-mono uppercase" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Titular de la Cuenta</label>
              <input type="text" name="bankHolder" value={formData.bankHolder} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CUIT del Titular</label>
              <input type="text" name="bankCuit" value={formData.bankCuit} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
          </div>
        </div>

        {/* Sección Fondo de Reserva */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
          <h3 className="text-lg font-semibold text-slate-700 mb-4">Fondo de Reserva</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Saldo Actual del Fondo ($)</label>
              <input type="number" step="0.01" name="reserveFundBalance" value={formData.reserveFundBalance} onChange={handleChange} className="w-full p-2 border rounded bg-slate-50" />
              <p className="text-xs text-slate-500 mt-1">Este valor se actualiza automáticamente al cerrar liquidaciones, pero puedes ajustarlo manualmente aquí.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">% Contribución Mensual</label>
              <input type="number" step="0.1" name="monthlyReserveContributionPercentage" value={formData.monthlyReserveContributionPercentage} onChange={handleChange} className="w-full p-2 border rounded" />
              <p className="text-xs text-slate-500 mt-1">Porcentaje sobre gastos ordinarios que se recauda para el fondo.</p>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
            <button 
                type="submit" 
                disabled={isSaving}
                className="flex items-center justify-center gap-2 w-full md:w-auto px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
                <Save className="w-5 h-5" />
                {isSaving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
            {msg && <p className={`mt-3 text-center font-medium ${msg.includes('Error') ? 'text-red-600' : 'text-emerald-600'}`}>{msg}</p>}
        </div>

      </form>
    </div>
  );
};

export default SettingsView;