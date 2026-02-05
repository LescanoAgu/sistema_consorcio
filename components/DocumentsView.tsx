import React, { useState } from 'react';
import { ConsortiumDocument, UserRole } from '../types';
import { FileText, Download, Plus, Trash2, X, Upload, Loader2, FolderOpen } from 'lucide-react';
import { uploadDocumentFile } from '../services/firestoreService';

interface DocumentsViewProps {
  documents: ConsortiumDocument[];
  userRole: UserRole;
  onAdd: (doc: Omit<ConsortiumDocument, 'id'>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const DocumentsView: React.FC<DocumentsViewProps> = ({ documents, userRole, onAdd, onDelete }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newDoc, setNewDoc] = useState<{title: string, category: ConsortiumDocument['category'], file: File | null}>({
      title: '',
      category: 'Reglamento',
      file: null
  });

  const handleUpload = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newDoc.file || !newDoc.title) return;
      
      setIsUploading(true);
      try {
          const url = await uploadDocumentFile(newDoc.file);
          await onAdd({
              title: newDoc.title,
              category: newDoc.category,
              url: url,
              date: new Date().toISOString()
          });
          setIsModalOpen(false);
          setNewDoc({ title: '', category: 'Reglamento', file: null });
      } catch (error) {
          alert("Error al subir documento");
      } finally {
          setIsUploading(false);
      }
  };

  const categories = ['Reglamento', 'Acta', 'Aviso', 'Otro'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FolderOpen className="w-6 h-6 text-indigo-600"/> Documentos del Consorcio
          </h2>
          {userRole === 'ADMIN' && (
              <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition-colors shadow-sm">
                  <Plus className="w-4 h-4 mr-2"/> Subir Documento
              </button>
          )}
      </div>

      {documents.length === 0 ? (
          <div className="text-center p-12 bg-slate-50 border-2 border-dashed rounded-xl text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-20"/>
              <p>No hay documentos públicos disponibles.</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map(doc => (
                  <div key={doc.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                  <FileText className="w-6 h-6"/>
                              </div>
                              <div>
                                  <h3 className="font-bold text-slate-800 line-clamp-1" title={doc.title}>{doc.title}</h3>
                                  <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 rounded text-slate-500">{doc.category}</span>
                              </div>
                          </div>
                          {userRole === 'ADMIN' && (
                              <button onClick={() => onDelete(doc.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                  <Trash2 className="w-4 h-4"/>
                              </button>
                          )}
                      </div>
                      <div className="flex justify-between items-end mt-2">
                          <span className="text-xs text-slate-400">{new Date(doc.date).toLocaleDateString()}</span>
                          <a 
                            href={doc.url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="flex items-center text-sm font-bold text-indigo-600 hover:underline"
                          >
                              <Download className="w-4 h-4 mr-1"/> Descargar
                          </a>
                      </div>
                  </div>
              ))}
          </div>
      )}

      {/* MODAL UPLOAD */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg">Subir Documento</h3>
                      <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-slate-400"/></button>
                  </div>
                  <form onSubmit={handleUpload} className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                          <input className="w-full p-2 border rounded" placeholder="Ej: Reglamento Interno" value={newDoc.title} onChange={e => setNewDoc({...newDoc, title: e.target.value})} required/>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                          <select className="w-full p-2 border rounded" value={newDoc.category} onChange={e => setNewDoc({...newDoc, category: e.target.value as any})}>
                              {categories.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Archivo (PDF)</label>
                          <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:bg-slate-50 relative cursor-pointer">
                              <input type="file" accept="application/pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => setNewDoc({...newDoc, file: e.target.files ? e.target.files[0] : null})}/>
                              <div className="flex flex-col items-center">
                                  {newDoc.file ? (
                                      <span className="text-emerald-600 font-medium text-sm flex items-center"><FileText className="w-4 h-4 mr-2"/> {newDoc.file.name}</span>
                                  ) : (
                                      <span className="text-slate-500 text-sm flex items-center"><Upload className="w-4 h-4 mr-2"/> Seleccionar Archivo</span>
                                  )}
                              </div>
                          </div>
                      </div>
                      <button type="submit" disabled={isUploading || !newDoc.file} className="w-full bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700 disabled:opacity-50 flex justify-center">
                          {isUploading ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Subir'}
                      </button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default DocumentsView;