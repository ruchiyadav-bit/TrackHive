import { useState, useEffect } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import api from '../../api/client';
import { buildPostbackUrl, toBaseUrl } from '../../utils/postbackUrl';

/**
 * The ONE Add / Edit Advertiser form.
 *
 * The Advertisers list and the advertiser's own page used to carry two
 * separate copies of this modal, and they had drifted: different fields,
 * different order, one with a postback preview and one without. Both pages
 * now render this component, so the form is identical wherever it is opened.
 */

const FALLBACK_NETWORKS = [
  ['impact', 'Impact.com'], ['everflow', 'Everflow'], ['affise', 'Affise'], ['trackier', 'Trackier'],
  ['cellxpert', 'Cellxpert'], ['katalys', 'Katalys'], ['smartadv', 'SmartAdv'], ['oasisads', 'Oasis Ads'],
  ['vipresponse', 'VIP Response'], ['blueaff', 'BlueAff'], ['salegains', 'SaleGains'], ['maxbounty', 'MaxBounty'],
  ['maxweb', 'MaxWeb'], ['flexoffers', 'FlexOffers'], ['fanfuel', 'FanFuel'],
  ['musketeers', 'Musketeers (Trackier)'], ['somicreative', 'Somi Creative (Affise)'], ['custom', 'Custom / Other'],
];

const EMPTY = {
  name: '', company: '', website: '', status: 'active', network: 'custom',
  clickIdParam: 'click_id', trackingDomain: '', contactName: '', contactEmail: '', notes: '',
};

function fromAdvertiser(adv) {
  if (!adv) return { ...EMPTY };
  return {
    name: adv.name || '', company: adv.company || '', website: adv.website || '',
    status: adv.status || 'active', network: adv.network || 'custom',
    clickIdParam: adv.clickIdParam || 'click_id',
    trackingDomain: (typeof adv.trackingDomain === 'object' ? adv.trackingDomain?._id : adv.trackingDomain) || '',
    contactName: adv.contactName || '', contactEmail: adv.contactEmail || '', notes: adv.notes || '',
  };
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white';

export default function AdvertiserFormModal({ open, editing, presets, verifiedDomains = [], onClose, onSaved }) {
  const [form, setForm] = useState(fromAdvertiser(editing));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setForm(fromAdvertiser(editing)); setError(''); }
  }, [open, editing]);

  if (!open) return null;

  const set = (patch) => { setForm(prev => ({ ...prev, ...patch })); setError(''); };

  const handleNetworkChange = (networkKey) => {
    const preset = presets?.[networkKey];
    set({ network: networkKey, clickIdParam: preset ? preset.clickIdParam : form.clickIdParam });
  };

  const save = async () => {
    if (!form.name.trim()) { setError('Advertiser name is required'); return; }
    // Required, no default: the postback URL is built on this domain.
    if (!form.trackingDomain) { setError('Tracking domain is required'); return; }
    setSaving(true);
    try {
      if (editing?._id) await api.put(`/advertisers/${editing._id}`, form);
      else await api.post('/advertisers', form);
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save advertiser');
    } finally {
      setSaving(false);
    }
  };

  const preset = presets?.[form.network] || presets?.custom;
  const picked = verifiedDomains.find(d => d._id === form.trackingDomain);
  const previewUrl = preset && picked
    ? buildPostbackUrl({
        trackingDomain: toBaseUrl(picked.domain),
        preset,
        secret: editing?.postbackSecret || '{auto-generated}',
        clickIdParam: form.clickIdParam,
      })
    : '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <h2 className="text-lg font-semibold text-gray-900 px-6 pt-6 pb-4 shrink-0">
          {editing ? 'Edit Advertiser' : 'Add Advertiser'}
        </h2>
        {/* Only the form scrolls; the action bar stays pinned. */}
        <div className="space-y-4 px-6 overflow-y-auto flex-1 pb-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Advertiser Name *</label>
            <input value={form.name} onChange={e => set({ name: e.target.value })} placeholder="Impact.com" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Network</label>
              <select value={form.network} onChange={e => handleNetworkChange(e.target.value)} className={inputCls}>
                {presets
                  ? Object.entries(presets).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)
                  : FALLBACK_NETWORKS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={e => set({ status: e.target.value })} className={inputCls}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tracking Domain * <span className="font-normal text-gray-400">(postback URL is built on this)</span>
            </label>
            <select value={form.trackingDomain} onChange={e => set({ trackingDomain: e.target.value })}
              className={`${inputCls} ${error && !form.trackingDomain ? 'border-red-400' : ''}`}>
              <option value="">{verifiedDomains.length ? 'Select tracking domain...' : 'No domain available'}</option>
              {verifiedDomains.map(d => <option key={d._id} value={d._id}>{d.domain}</option>)}
            </select>
            <p className="text-[11px] text-gray-400 mt-1 flex items-start gap-1">
              <Info size={10} className="mt-0.5 shrink-0" />
              <span>Pick one and keep it. The postback URL is registered once on the network, so changing this later means re-pasting it there.</span>
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Click ID Param <span className="font-normal text-gray-400">(in landing page URL)</span>
            </label>
            <input value={form.clickIdParam} onChange={e => set({ clickIdParam: e.target.value })} placeholder="click_id" className={inputCls} />
            <p className="mt-1 text-xs text-gray-400 flex items-center gap-1">
              <Info size={10} /> Added to the advertiser's tracking link, e.g. ?{form.clickIdParam || 'click_id'}={'{click_id}'}
            </p>
          </div>

          {/* Postback URL preview: the exact URL that will be shown on the list. */}
          {presets && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Postback URL Preview</label>
              <code className="text-xs text-gray-700 break-all block mb-2">
                {previewUrl || 'Select a tracking domain to see the postback URL'}
              </code>
              {preset?.instruction && <p className="text-[11px] text-gray-400">{preset.instruction}</p>}
              {form.network === 'custom' && (
                <p className="text-[11px] text-amber-500 mt-1 flex items-center gap-1">
                  <AlertTriangle size={10} /> Default macros, verify with your advertiser's docs, otherwise conversions won't match
                </p>
              )}
              {form.network !== 'custom' && presets[form.network]?.verified === false && (
                <p className="text-[11px] text-amber-500 mt-1 flex items-start gap-1">
                  <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                  <span>These macros are unverified. Confirm them against the network docs before sending live traffic.</span>
                </p>
              )}
            </div>
          )}

          <div className="pt-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Other details (optional)</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company / Brand</label>
              <input value={form.company} onChange={e => set({ company: e.target.value })} placeholder="BetMGM" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input value={form.website} onChange={e => set({ website: e.target.value })} placeholder="https://impact.com" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <input value={form.contactName} onChange={e => set({ contactName: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
              <input value={form.contactEmail} onChange={e => set({ contactEmail: e.target.value })} type="email" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => set({ notes: e.target.value })} rows={3} className={`${inputCls} resize-y`} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 shrink-0 bg-white rounded-b-xl">
          {error && (
            <p className="mr-auto text-sm text-red-600 flex items-center gap-1"><AlertTriangle size={14} /> {error}</p>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button onClick={save} disabled={saving || !form.name.trim() || !form.trackingDomain}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Advertiser'}
          </button>
        </div>
      </div>
    </div>
  );
}
