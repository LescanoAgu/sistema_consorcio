import React, { useState } from 'react';
import { Announcement, Unit } from '../types';
import { Bell, Plus, Trash2, Megaphone, AlertTriangle, Calendar, Mail } from 'lucide-react';
import { sendAnnouncementEmail } from '../services/emailService';

interface AnnouncementsViewProps {
  announcements: Announcement[];
  units: Unit[]; // Recibimos unidades para los emails
  onAdd: (data: Omit<Announcement, 'id'>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const AnnouncementsView: React.FC<AnnouncementsViewProps> = ({ announcements, units, onAdd, onDelete }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH'>('NORMAL');
  const [notifyByEmail, setNotifyByEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    
    setIsSubmitting(true);
    
    try {
        // 1. Guardar en Base de Datos
        await onAdd({
            title,
            content,
            priority,
            date: new Date().toISOString()
        });

        // 2. Enviar Emails (Si se marcó la opción)
        if (notifyByEmail) {
            await sendAnnouncementEmail(units, title, content);
            alert("Anuncio publicado y correos enviados exitosamente.");
        } else {
            alert("Anuncio publicado correctamente.");
        }
        
        setTitle('');
        setContent('');
        setPriority('NORMAL');
        setNotifyByEmail(false);
    } catch (error) {
        console.error(error);
        alert("Hubo un error al publicar.");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <Megaphone className="w-6 h-6 text-indigo-600" /> Tablón de Anuncios
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Formulario */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Plus className="w-4 h-4"/> Nueva Publicación</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                      <input type="text" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ej: Fumigación" value={title} onChange={e => setTitle(e.target.value)} required />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Mensaje</label>
                      <textarea className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" rows={4} placeholder="Detalles..." value={content} onChange={e => setContent(e.target.value)} required />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Prioridad</label>
                      <div className="flex gap-2">
                          <button type="button" onClick={() => setPriority('NORMAL')} className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${priority === 'NORMAL' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-500'}`}>Normal</button>
                          <button type="button" onClick={() => setPriority('HIGH')} className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${priority === 'HIGH' ? 'bg-red-50 border-red-200 text-red-700' : 'border-slate-200 text-slate-500'}`}>Urgente</button>
                      </div>
                  </div>

                  {/* CHECKBOX EMAIL */}
                  <div className="flex items-center gap-2 pt-2 pb-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <input 
                        type="checkbox" 
                        id="notify" 
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                        checked={notifyByEmail}
                        onChange={e => setNotifyByEmail(e.target.checked)}
                      />
                      <label htmlFor="notify" className="text-sm text-slate-600 flex items-center cursor-pointer select-none">
                          <Mail className="w-4 h-4 mr-2 text-slate-400"/> Notificar por Email a todos
                      </label>
                  </div>

                  <button type="submit" disabled={isSubmitting} className="w-full py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                      {isSubmitting ? 'Procesando...' : 'Publicar'}
                  </button>
              </form>
          </div>

          {/* Lista */}
          <div className="md:col-span-2 space-y-4">
              {announcements.length === 0 ? (
                  <div className="text-center p-10 bg-slate-50 rounded-xl border border-slate-200 text-slate-400">
                      <Bell className="w-12 h-12 mx-auto mb-2 opacity-20"/>
                      <p>No hay anuncios publicados.</p>
                  </div>
              ) : (
                  announcements.map(ann => (
                      <div key={ann.id} className={`bg-white p-5 rounded-xl shadow-sm border relative ${ann.priority === 'HIGH' ? 'border-red-200' : 'border-slate-200'}`}>
                          <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3 mb-2">
                                  {ann.priority === 'HIGH' && <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> URGENTE</span>}
                                  <span className="text-xs text-slate-400 flex items-center gap-1"><Calendar className="w-3 h-3"/> {new Date(ann.date).toLocaleDateString()}</span>
                              </div>
                              <button onClick={() => onDelete(ann.id)} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                          </div>
                          <h3 className={`text-lg font-bold mb-1 ${ann.priority === 'HIGH' ? 'text-red-800' : 'text-slate-800'}`}>{ann.title}</h3>
                          <p className="text-slate-600 text-sm whitespace-pre-wrap">{ann.content}</p>
                      </div>
                  ))
              )}
          </div>
      </div>
    </div>
  );
};

export default AnnouncementsView;