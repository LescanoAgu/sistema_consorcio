import React, { useState } from 'react';
import { ConsortiumSettings } from '../types';
import { Save, Building, CreditCard, Upload, Loader2, Image as ImageIcon, Percent } from 'lucide-react';
import { uploadConsortiumLogo } from '../services/firestoreService';

interface SettingsViewProps {
  currentSettings: ConsortiumSettings;
  onSave: (settings: ConsortiumSettings) => Promise<void>;
}

const SettingsView: React.FC<SettingsViewProps> = ({ currentSettings, onSave }) => {
  const [formData, setFormData] = useState<ConsortiumSettings>(currentSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
        ...prev,
        [name]: ['reserveFundBalance', 'monthlyReserveContributionPercentage', 'interestRate'].includes(name) 
            ? parseFloat(value) || 0 
            : value
    }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setIsUploading(true);
          try {
              const url = await uploadConsortiumLogo(e.target.files[0]);
              setFormData(prev => ({ ...prev, logoUrl: url }));
          } catch (error) {
              alert("Error al subir logo");
          } finally {
              setIsUploading(false);
          }
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      await onSave(formData);
      setIsSaving(false);
      alert("Configuración guardada.");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Building className="w-6 h-6 text-indigo-600"/> Configuración del Consorcio
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* IDENTIDAD Y LOGO */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-700 mb-4 border-b pb-2">Identidad Visual</h3>
              <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="w-full md:w-1/3">
                      <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center min-h-[150px] bg-slate-50 relative">
                          {isUploading ? <Loader2 className="animate-spin text-indigo-600"/> : 
                           formData.logoUrl ? <img src={formData.logoUrl} alt="Logo" className="max-h-24 object-contain"/> : 
                           <div className="text-center text-slate-400"><ImageIcon className="w-8 h-8 mx-auto mb-2"/>Sin Logo</div>
                          }
                          <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={isUploading}/>
                      </div>
                      <p className="text-xs text-center text-slate-500 mt-2">Click para subir imagen</p>
                  </div>
                  <div className="w-full md:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className="block text-xs font-bold text-slate-500 uppercase">Administrador</label><input name="adminName" value={formData.adminName || ''} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Nombre completo" /></div>
                      <div><label className="block text-xs font-bold text-slate-500 uppercase">CUIT Consorcio</label><input name="cuit" value={formData.cuit || ''} onChange={handleChange} className="w-full p-2 border rounded" placeholder="20-12345678-9" /></div>
                      <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 uppercase">Dirección</label><input name="address" value={formData.address || ''} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Calle Falsa 123" /></div>
                  </div>
              </div>
          </div>

          {/* PARÁMETROS ECONÓMICOS */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-700 mb-4 border-b pb-2 flex items-center gap-2"><Percent className="w-5 h-5"/> Parámetros Económicos</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fondo Reserva Actual ($)</label>
                      <input type="number" step="0.01" name="reserveFundBalance" value={formData.reserveFundBalance} onChange={handleChange} className="w-full p-2 border rounded font-mono font-bold" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">% Aporte Mensual Reserva</label>
                      <div className="relative">
                          <input type="number" step="0.1" name="monthlyReserveContributionPercentage" value={formData.monthlyReserveContributionPercentage} onChange={handleChange} className="w-full p-2 border rounded" />
                          <span className="absolute right-3 top-2 text-slate-400">%</span>
                      </div>
                  </div>
                  
                  {/* --- NUEVO CAMPO: INTERÉS --- */}
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">% Interés 2do Vto</label>
                      <div className="relative">
                          <input type="number" step="0.1" name="interestRate" value={formData.interestRate || 5} onChange={handleChange} className="w-full p-2 border rounded border-indigo-200 bg-indigo-50 text-indigo-700 font-bold" />
                          <span className="absolute right-3 top-2 text-indigo-400">%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Recargo aplicado al cupón</p>
                  </div>
                  {/* --------------------------- */}

              </div>
          </div>

          {/* DATOS BANCARIOS */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-700 mb-4 border-b pb-2 flex items-center gap-2"><CreditCard className="w-5 h-5"/> Datos Bancarios (Para el Cupón)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 uppercase">Banco</label><input name="bankName" value={formData.bankName} onChange={handleChange} className="w-full p-2 border rounded" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 uppercase">Titular Cuenta</label><input name="bankHolder" value={formData.bankHolder} onChange={handleChange} className="w-full p-2 border rounded" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 uppercase">CBU / CVU</label><input name="bankCBU" value={formData.bankCBU} onChange={handleChange} className="w-full p-2 border rounded font-mono" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 uppercase">Alias</label><input name="bankAlias" value={formData.bankAlias} onChange={handleChange} className="w-full p-2 border rounded font-mono uppercase" /></div>
              </div>
          </div>

          <button type="submit" disabled={isSaving} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex justify-center items-center">
              {isSaving ? <Loader2 className="animate-spin w-5 h-5 mr-2"/> : <Save className="w-5 h-5 mr-2"/>}
              Guardar Configuración
          </button>
      </form>
    </div>
  );
};

export default SettingsView;