import { useState, useEffect } from 'react';
import { Globe, Save, CheckCircle, XCircle, Info } from 'lucide-react';
import api from '../../api/client';

/**
 * Google Ads Tracking Domain (Settings > Tracking, manager only).
 *
 * ONE domain, kept separate from the normal Tracking Domains list. It is the
 * host submitted for Google certification and the only host /gclick answers
 * on. The offer page's "Google Ads" box offers just this domain.
 */
export default function GoogleTrackingSettings() {
  const [domain, setDomain] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [check, setCheck] = useState(null);

  useEffect(() => {
    api.get('/google-tracking')
      .then(({ data }) => { setDomain(data.domain || ''); setSaved(data.domain || ''); })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true); setMsg(null); setCheck(null);
    try {
      const { data } = await api.put('/google-tracking', { domain });
      setDomain(data.domain || ''); setSaved(data.domain || '');
      setMsg({ ok: true, text: data.domain ? 'Saved' : 'Cleared, Google tracking is off' });
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.error || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  // Calls https://<domain>/gclick/health from the browser: proves DNS, SSL and
  // the server all answer on this exact host.
  const test = async () => {
    setCheck({ state: 'checking' });
    try {
      const r = await fetch(`https://${saved}/gclick/health`, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      setCheck(r.ok && j.ok ? { state: 'ok' } : { state: 'fail', text: `HTTP ${r.status}` });
    } catch (e) {
      setCheck({ state: 'fail', text: 'Not reachable (DNS / SSL / server)' });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mt-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Globe size={18} className="text-blue-600" /> Google Ads Tracking Domain
        </h2>
        <p className="text-xs text-gray-500 mt-1 flex items-start gap-1">
          <Info size={12} className="mt-0.5 shrink-0" />
          <span>
            One domain only, used for the Google Ads tracking template (/gclick). It is kept separate from the
            normal Tracking Domains list and is the domain submitted for Google certification. Point it with a
            CNAME to this server first. Leave empty to turn Google tracking off.
          </span>
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
          <input
            value={domain}
            onChange={e => setDomain(e.target.value)}
            placeholder="go.trackscales.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 font-mono"
          />
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          <Save size={14} /> {saving ? 'Saving...' : 'Save'}
        </button>
        {saved && (
          <button onClick={test}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            Test domain
          </button>
        )}
      </div>
      {msg && <p className={`text-sm ${msg.ok ? 'text-blue-700' : 'text-red-600'}`}>{msg.text}</p>}
      {check?.state === 'checking' && <p className="text-sm text-gray-500">Checking...</p>}
      {check?.state === 'ok' && (
        <p className="text-sm text-green-700 flex items-center gap-1"><CheckCircle size={14} /> {saved} is live (DNS, SSL and server OK)</p>
      )}
      {check?.state === 'fail' && (
        <p className="text-sm text-red-600 flex items-center gap-1"><XCircle size={14} /> {saved}: {check.text}</p>
      )}
    </div>
  );
}
