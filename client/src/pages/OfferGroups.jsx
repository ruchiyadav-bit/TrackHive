import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, Plus, Trash2, Edit2, BarChart3, X } from 'lucide-react';
import api from '../api/client';

export default function OfferGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editGroup, setEditGroup] = useState(null);
  const [offers, setOffers] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', offers: [], color: '#6366f1' });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [reportData, setReportData] = useState(null);

  const fetchGroups = async () => {
    try {
      const { data } = await api.get('/offer-groups');
      setGroups(data.groups || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOffers = async () => {
    try {
      const { data } = await api.get('/offers');
      setOffers(data.offers || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchGroups(); }, []);

  const openForm = (group) => {
    fetchOffers();
    if (group) {
      setEditGroup(group);
      setForm({
        name: group.name,
        description: group.description || '',
        offers: group.offers?.map(o => o._id || o) || [],
        color: group.color || '#6366f1',
      });
    } else {
      setEditGroup(null);
      setForm({ name: '', description: '', offers: [], color: '#6366f1' });
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || form.offers.length < 2) return;
    setSaving(true);
    try {
      if (editGroup) {
        await api.put(`/offer-groups/${editGroup._id}`, form);
      } else {
        await api.post('/offer-groups', form);
      }
      setShowForm(false);
      fetchGroups();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this group?')) return;
    try {
      await api.delete(`/offer-groups/${id}`);
      fetchGroups();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleOffer = (offerId) => {
    setForm(prev => ({
      ...prev,
      offers: prev.offers.includes(offerId)
        ? prev.offers.filter(id => id !== offerId)
        : [...prev.offers, offerId],
    }));
  };

  const viewReport = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      setReportData(null);
      return;
    }
    try {
      const { data } = await api.get(`/offer-groups/${id}/report`);
      setReportData(data);
      setExpandedId(id);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading groups...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Offer Groups</h1>
        <button onClick={() => openForm(null)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus size={16} /> New Group
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FolderOpen size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No offer groups yet. Create one to combine reporting for related offers.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => (
            <div key={g._id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color || '#6366f1' }} />
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{g.name}</h3>
                    <p className="text-xs text-gray-500">{g.offers?.length || 0} offers{g.description ? ` — ${g.description}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => viewReport(g._id)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-gray-50" title="View Report">
                    <BarChart3 size={16} />
                  </button>
                  <button onClick={() => openForm(g)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50" title="Edit">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(g._id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-50" title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Offers list */}
              {g.offers?.length > 0 && (
                <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                  {g.offers.map(o => (
                    <span key={o._id || o} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                      {o.name || o}
                    </span>
                  ))}
                </div>
              )}

              {/* Report */}
              {expandedId === g._id && reportData && (
                <div className="border-t border-gray-200 p-4">
                  <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">Group Report (last 30 days)</h4>
                  {reportData.data?.length === 0 ? (
                    <p className="text-xs text-gray-400">No data available</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left px-2 py-1 font-medium text-gray-600">Date</th>
                            <th className="text-right px-2 py-1 font-medium text-gray-600">Clicks</th>
                            <th className="text-right px-2 py-1 font-medium text-gray-600">Conv</th>
                            <th className="text-right px-2 py-1 font-medium text-gray-600">Revenue</th>
                            <th className="text-right px-2 py-1 font-medium text-gray-600">Payout</th>
                            <th className="text-right px-2 py-1 font-medium text-gray-600">Profit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {reportData.data.slice(0, 15).map(d => (
                            <tr key={d.date}>
                              <td className="px-2 py-1 text-gray-600">{d.date}</td>
                              <td className="px-2 py-1 text-right">{d.clicks}</td>
                              <td className="px-2 py-1 text-right">{d.conversions}</td>
                              <td className="px-2 py-1 text-right text-green-600">${d.revenue?.toFixed(2)}</td>
                              <td className="px-2 py-1 text-right text-blue-600">${d.payout?.toFixed(2)}</td>
                              <td className="px-2 py-1 text-right font-medium">${d.profit?.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{editGroup ? 'Edit Group' : 'New Group'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                  className="w-10 h-10 p-0 border border-gray-300 rounded cursor-pointer" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Offers (min 2) *</label>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                  {offers.filter(o => o.status !== 'deleted').map(o => (
                    <label key={o._id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={form.offers.includes(o._id)} onChange={() => toggleOffer(o._id)} className="rounded text-indigo-600" />
                      <span className="text-sm text-gray-700">{o.name}</span>
                      <span className={`ml-auto px-1.5 py-0.5 rounded-full text-xs ${o.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {o.status}
                      </span>
                    </label>
                  ))}
                  {offers.length === 0 && <p className="text-xs text-gray-400 p-2">No offers found</p>}
                </div>
                <p className="text-xs text-gray-400 mt-1">{form.offers.length} selected</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name || form.offers.length < 2}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving...' : editGroup ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
