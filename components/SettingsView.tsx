import React, { useState, useEffect } from 'react';
import { ConsortiumSettings } from '../types';
import { Save, Building, DollarSign, MapPin, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
// Importamos la función de subir logo
import { uploadConsortiumLogo } from '../services/firestoreService';

interface SettingsViewProps {
  currentSettings: ConsortiumSettings;
  onSave: (settings: ConsortiumSettings) => Promise<void>;
}

const SettingsView: React.FC<SettingsViewProps> = ({ currentSettings, onSave }) => {
  const [formData, setFormData] = useState<ConsortiumSettings>(currentSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [msg, setMsg] = useState('');

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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setIsUploadingLogo(true);
          try {
              const url = await uploadConsortiumLogo(e.target.files[0]);
              setFormData(prev => ({ ...prev, logoUrl: url }));
          } catch (error) {
              console.error(error);
              alert("Error al subir el logo.");
          } finally {
              setIsUploadingLogo(false);
          }
      }
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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Configuración General</h2>
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* IDENTIDAD DEL CONSORCIO */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-600"/> Identidad del Edificio
          </h3>
          
          {/* SUBIDA DE LOGO */}
          <div className="mb-6 flex items-center gap-4">
              <div className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50 relative">
                  {formData.logoUrl ? (
                      <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                      <ImageIcon className="w-8 h-8 text-slate-300" />
                  )}
                  {isUploadingLogo && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                      </div>
                  )}
              </div>
              <div>
                  <label className="cursor-pointer bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2">
                      <Upload className="w-4 h-4"/>
                      {formData.logoUrl ? 'Cambiar Logo' : 'Subir Logo'}
                      <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleLogoUpload} />
                  </label>
                  <p className="text-xs text-slate-400 mt-1">Recomendado: PNG transparente</p>
              </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Dirección Completa</label>
              <input name="address" value={formData.address || ''} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Ej: Av. Libertador 1234, CABA" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CUIT Consorcio</label>
              <input name="cuit" value={formData.cuit || ''} onChange={handleChange} className="w-full p-2 border rounded" placeholder="30-..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Administración</label>
              <input name="adminName" value={formData.adminName || ''} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Ej: Administración García" />
            </div>
          </div>
        </div>

        {/* DATOS BANCARIOS */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Building className="w-5 h-5 text-indigo-600"/> Datos Bancarios (Para Expensas)
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Banco</label>
                    <input name="bankName" value={formData.bankName} onChange={handleChange} className="w-full p-2 border rounded" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Titular</label>
                    <input name="bankHolder" value={formData.bankHolder} onChange={handleChange} className="w-full p-2 border rounded" />
                </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CBU / CVU</label>
              <input name="bankCBU" value={formData.bankCBU} onChange={handleChange} className="w-full p-2 border rounded bg-slate-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Alias</label>
              <input name="bankAlias" value={formData.bankAlias} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
          </div>
        </div>

        {/* PARAMETROS FINANCIEROS */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 md:col-span-2">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-indigo-600"/> Parámetros del Sistema
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Saldo Inicial Fondo Reserva</label>
              <input type="number" step="0.01" name="reserveFundBalance" value={formData.reserveFundBalance} onChange={handleChange} className="w-full p-2 border rounded bg-slate-50" />
              <p className="text-xs text-slate-500 mt-1">Este valor se actualiza automáticamente al cerrar liquidaciones.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">% Contribución Mensual al Fondo</label>
              <input type="number" step="0.1" name="monthlyReserveContributionPercentage" value={formData.monthlyReserveContributionPercentage} onChange={handleChange} className="w-full p-2 border rounded" />
              <p className="text-xs text-slate-500 mt-1">Porcentaje extra sobre gastos ordinarios.</p>
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