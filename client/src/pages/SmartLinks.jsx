import { useState, useEffect } from 'react';
import { Link2, Copy, ExternalLink, Check, BarChart3 } from 'lucide-react';
import api from '../api/client';

export default function SmartLinks() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const baseUrl = window.location.origin;

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const { data } = await api.get('/offers', { params: { limit: 500 } });
        const smartLinkOffers = (data.offers || []).filter(o => o.smartLinkEnabled && o.smartLinkSlug);
        setOffers(smartLinkOffers);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchOffers();
  }, []);

  const copyUrl = (slug, id) => {
    navigator.clipboard.writeText(`${baseUrl}/go/${slug}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading smart links...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Links</h1>
          <p className="text-sm text-gray-500">Manage your offer tracking URLs with IP capping and bot detection</p>
        </div>
      </div>

      {offers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Link2 size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-2">No smart links configured yet</p>
          <p className="text-sm text-gray-400">Enable Smart Link on any offer in its URLs & Tracking tab</p>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map(offer => (
            <div key={offer._id} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-200 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{offer.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      offer.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {offer.status}
                    </span>
                  </div>

                  {/* Smart Link URL */}
                  <div className="flex items-center gap-2 mb-3">
                    <code className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-mono truncate">
                      {baseUrl}/go/{offer.smartLinkSlug}
                    </code>
                    <button onClick={() => copyUrl(offer.smartLinkSlug, offer._id)}
                      className="p-1 text-gray-400 hover:text-indigo-600 shrink-0" title="Copy URL">
                      {copiedId === offer._id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                    <a href={`/go/${offer.smartLinkSlug}`} target="_blank" rel="noopener"
                      className="p-1 text-gray-400 hover:text-indigo-600 shrink-0" title="Test Link">
                      <ExternalLink size={14} />
                    </a>
                  </div>

                  {/* Settings grid */}
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                    <span>IP Cap: <strong className="text-gray-700">{offer.ipCap || '∞'}</strong> / {offer.ipCapWindow || 'forever'}</span>
                    <span>Redirect: <strong className="text-gray-700">{offer.redirectType || '302'}</strong></span>
                    <span>Duplicate: <strong className="text-gray-700">{offer.duplicateAction || 'fallback'}</strong></span>
                    {offer.botDetection && <span className="text-orange-600">Bot Detection ON</span>}
                    {offer.vpnDetection && <span className="text-red-600">VPN Detection ON</span>}
                  </div>
                </div>

                {/* Quick stats */}
                <div className="flex items-center gap-4 ml-4 text-center shrink-0">
                  <div>
                    <p className="text-lg font-bold text-gray-900">{(offer.totalClicks || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Clicks</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{(offer.totalConversions || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Conv</p>
                  </div>
                </div>
              </div>

              {/* GEO targets */}
              {offer.geoTargets?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {offer.geoTargets.slice(0, 10).map(geo => (
                    <span key={geo} className="px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-600 font-medium">{geo}</span>
                  ))}
                  {offer.geoTargets.length > 10 && <span className="text-xs text-gray-400">+{offer.geoTargets.length - 10} more</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
