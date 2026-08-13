import { useState, useEffect } from 'react';
import { FileStack, Plus, Trash2, Edit2, Copy, X, Eye } from 'lucide-react';
import api from '../api/client';

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [viewTemplate, setViewTemplate] = useState(null);

  const fetchTemplates = async () => {
    try {
      const { data } = await api.get('/templates');
      setTemplates(data.templates || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleCreate = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (editTemplate) {
        await api.put(`/templates/${editTemplate._id}`, {
          name: form.name,
          description: form.description,
          templateData: editTemplate.templateData,
        });
      } else {
        await api.post('/templates', {
          name: form.name,
          description: form.description,
          templateData: {},
        });
      }
      setShowForm(false);
      fetchTemplates();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this template?')) return;
    try {
      await api.delete(`/templates/${id}`);
      fetchTemplates();
    } catch (err) {
      console.error(err);
    }
  };

  const openEdit = (t) => {
    setEditTemplate(t);
    setForm({ name: t.name, description: t.description || '' });
    setShowForm(true);
  };

  const openNew = () => {
    setEditTemplate(null);
    setForm({ name: '', description: '' });
    setShowForm(true);
  };

  const viewDetails = async (id) => {
    try {
      const { data } = await api.get(`/templates/${id}`);
      setViewTemplate(data.template);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading templates...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Offer Templates</h1>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus size={16} /> New Template
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Templates store reusable offer configurations. Use "Save as Template" on any offer form, then "Load from Template" to quickly create similar offers.
      </p>

      {templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileStack size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No templates yet. Create one from an offer's form or here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t._id} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-300 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{t.name}</h3>
                  {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                </div>
                <FileStack size={16} className="text-indigo-400 shrink-0" />
              </div>

              <div className="text-xs text-gray-400 mb-3">
                Created {new Date(t.createdAt).toLocaleDateString()}
              </div>

              {/* Template data summary */}
              {t.templateData && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {t.templateData.network && (
                    <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{t.templateData.network}</span>
                  )}
                  {t.templateData.category && (
                    <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{t.templateData.category}</span>
                  )}
                  {t.templateData.revenueType && (
                    <span className="px-1.5 py-0.5 bg-green-50 rounded text-xs text-green-700">{t.templateData.revenueType}</span>
                  )}
                  {t.templateData.payoutType && (
                    <span className="px-1.5 py-0.5 bg-blue-50 rounded text-xs text-blue-700">{t.templateData.payoutType}</span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1 border-t border-gray-100 pt-2">
                <button onClick={() => viewDetails(t._id)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded" title="View Details">
                  <Eye size={14} />
                </button>
                <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded" title="Edit">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => handleDelete(t._id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{editTemplate ? 'Edit Template' : 'New Template'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-y" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !form.name}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving...' : editTemplate ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Template Modal */}
      {viewTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{viewTemplate.name}</h2>
              <button onClick={() => setViewTemplate(null)} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            {viewTemplate.description && <p className="text-sm text-gray-500 mb-4">{viewTemplate.description}</p>}
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Template Data</h3>
            <pre className="bg-gray-50 p-3 rounded-lg text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(viewTemplate.templateData, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
