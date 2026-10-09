import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle, XCircle, Clock, Shield, Copy, RefreshCw } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { isReadOnly } from '../utils/roles';

const statusConfig = {
 verified: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100 text-green-800', label: 'Verified' },
 pending: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
 failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100 text-red-800', label: 'Failed' },
};

export default function TrackingDomains() {
 const [domains, setDomains] = useState([]);
 const [loading, setLoading] = useState(true);
 const { user } = useAuth();
 // Team members open this page to READ which domain an offer runs on. Every
 // control that changes the list is hidden; the server refuses them anyway.
 const canEdit = !isReadOnly(user);
 const [showAdd, setShowAdd] = useState(false);
 const [newDomain, setNewDomain] = useState('');
 const [verifying, setVerifying] = useState(null);
 const [verifyResult, setVerifyResult] = useState(null);
 const [copied, setCopied] = useState(false);

 const fetchDomains = async () => {
 try {
 const { data } = await api.get('/tracking-domains');
 setDomains(data.domains || []);
 } catch (err) {
 console.error(err);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => { fetchDomains(); }, []);

 const addDomain = async () => {
 if (!newDomain.trim()) return;
 try {
 await api.post('/tracking-domains', { domain: newDomain.trim() });
 setNewDomain('');
 setShowAdd(false);
 fetchDomains();
 } catch (err) {
 alert(err.response?.data?.error || 'Error adding domain');
 }
 };

 const verifyDomain = async (id) => {
 setVerifying(id);
 setVerifyResult(null);
 try {
 const { data } = await api.post(`/tracking-domains/${id}/verify`);
 setVerifyResult({ id, checks: data.checks, domain: data.domain });
 fetchDomains();
 } catch (err) {
 console.error(err);
 } finally {
 setVerifying(null);
 }
 };

 const removeDomain = async (id) => {
 if (!window.confirm('Delete this tracking domain?')) return;
 try {
 await api.delete(`/tracking-domains/${id}`);
 fetchDomains();
 } catch (err) {
 console.error(err);
 }
 };

 const copyDNS = (d) => {
  const r = d.setup || {};
  const text = [
    `Type: ${r.type || 'CNAME'}`,
    `Name: ${r.name || ''}`,
    `Value: ${r.value || d.targetCname || ''}`,
    `TTL: ${r.ttl || 'Auto'}`,
  ].join('\n');
  navigator.clipboard.writeText(text);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-gray-900">Tracking Domains</h1>
 <p className="text-sm text-gray-500 mt-1">Add and verify custom tracking domains for your offers</p>
 </div>
 {canEdit && (
 <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
 <Plus size={16} /> Add Domain
 </button>
 )}
 </div>

 {/* Add Domain Form */}
 {canEdit && showAdd && (
 <div className="bg-white rounded-xl border border-gray-200 p-6">
 <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Tracking Domain</h3>
 <div className="flex gap-3">
 <input
 value={newDomain} onChange={(e) => setNewDomain(e.target.value)}
 placeholder="track.yourdomain.com"
 className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
 onKeyDown={(e) => e.key === 'Enter' && addDomain()}
 />
 <button onClick={addDomain} disabled={!newDomain.trim()}
 className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
 Add
 </button>
 <button onClick={() => { setShowAdd(false); setNewDomain(''); }}
 className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
 </div>
 </div>
 )}

 {loading ? (
 <div className="text-center py-12 text-gray-400">Loading...</div>
 ) : domains.length === 0 ? (
 <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
 <p className="text-gray-500 mb-2">No tracking domains added</p>
 {canEdit && <button onClick={() => setShowAdd(true)} className="text-blue-600 text-sm font-medium hover:underline">Add your first domain</button>}
 </div>
 ) : (
 <div className="space-y-4">
 {domains.map((d) => {
 const sc = statusConfig[d.status] || statusConfig.pending;
 const Icon = sc.icon;
 const showVerifyResult = verifyResult?.id === d._id;

 return (
 <div key={d._id} className="bg-white rounded-xl border border-gray-200 p-6">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <Icon size={20} className={sc.color} />
 <div>
 <span className="font-semibold text-gray-900">{d.domain}</span>
 <span className={`ml-3 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg}`}>{sc.label}</span>
 {d.sslActive && (
 <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
 <Shield size={10} /> SSL Active
 </span>
 )}
 </div>
 </div>
 <div className="flex items-center gap-2">
 {canEdit && (<>
 <button onClick={() => verifyDomain(d._id)} disabled={verifying === d._id}
 className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50">
 <RefreshCw size={14} className={verifying === d._id ? 'animate-spin' : ''} />
 {verifying === d._id ? 'Verifying...' : 'Verify'}
 </button>
 <button onClick={() => removeDomain(d._id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
 <Trash2 size={14} />
 </button>
 </>)}
 </div>
 </div>

 {/* DNS Instructions */}
 {(d.status !== 'verified' || !d.pointsHere) && (
 <div className="bg-gray-50 rounded-lg p-4 text-sm">
 <p className="font-medium text-gray-700 mb-2">Add this DNS record in your domain's DNS settings:</p>
 <div className="bg-white rounded border border-gray-200 p-3 font-mono text-xs space-y-1">
 <div><span className="text-gray-500">Type:</span> <span className="text-gray-900 font-semibold">CNAME</span></div>
 <div><span className="text-gray-500">Name:</span> <span className="text-gray-900 font-semibold">{d.setup?.name || d.domain.split('.')[0]}</span></div>
 <div><span className="text-gray-500">Value:</span> <span className="text-blue-600">{d.setup?.value || d.targetCname || '—'}</span></div>
 <div><span className="text-gray-500">TTL:</span> <span className="text-gray-900">Auto</span></div>
 </div>
 <p className="text-gray-500 mt-2 text-xs">Or use an A record pointing to your server's IP address.</p>
 <button onClick={() => copyDNS(d)} className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
 <Copy size={12} /> {copied ? 'Copied!' : 'Copy DNS Record'}
 </button>
 </div>
 )}

 {/* Verify Results */}
 {showVerifyResult && verifyResult.checks && (
 <div className="mt-4 bg-gray-50 rounded-lg p-4 space-y-2">
 <p className="text-sm font-medium text-gray-700">Verification Results:</p>
 <div className="flex items-center gap-2 text-sm">
 {verifyResult.checks.dnsFound ? <CheckCircle size={14} className="text-green-600" /> : <XCircle size={14} className="text-red-500" />}
 <span className={verifyResult.checks.dnsFound ? 'text-green-700' : 'text-red-600'}>DNS record {verifyResult.checks.dnsFound ? 'found' : 'not found'}</span>
 </div>
 <div className="flex items-center gap-2 text-sm">
 {verifyResult.checks.resolves ? <CheckCircle size={14} className="text-green-600" /> : <XCircle size={14} className="text-red-500" />}
 <span className={verifyResult.checks.resolves ? 'text-green-700' : 'text-red-600'}>Domain {verifyResult.checks.resolves ? 'resolves' : 'does not resolve'}</span>
 </div>
 <div className="flex items-center gap-2 text-sm">
 {verifyResult.checks.ssl ? <CheckCircle size={14} className="text-green-600" /> : <XCircle size={14} className="text-yellow-500" />}
 <span className={verifyResult.checks.ssl ? 'text-green-700' : 'text-yellow-600'}>HTTPS {verifyResult.checks.ssl ? 'working' : 'not detected'}</span>
                 </div>
                 <div className="flex items-center gap-2 text-sm">
                   {verifyResult.checks.pointsHere ? <CheckCircle size={14} className="text-green-600" /> : <XCircle size={14} className="text-amber-500" />}
                   <span className={verifyResult.checks.pointsHere ? 'text-green-700' : 'text-amber-700'}>
                     {verifyResult.checks.pointsHere ? 'Reaches this server' : 'Does NOT reach this server — clicks on it will not be tracked here'}
                   </span>
 </div>
 </div>
 )}

 {d.verificationError && !showVerifyResult && (
 <p className="mt-2 text-xs text-red-500">{d.verificationError}</p>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
}
