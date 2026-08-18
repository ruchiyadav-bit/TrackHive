import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Users, Globe, Bell, Link2, Shield, MessageSquare, Send, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { isManager } from '../utils/roles';
import { useToast } from '../components/ui/Toast';

// managerOnly tabs are removed for partners. The Tracking tab holds the
// tracking domain, which decides where every click in the account is served
// from; Users lists every colleague's email.
const TABS = [
 { key: 'general', label: 'General', icon: SettingsIcon },
 { key: 'tracking', label: 'Tracking', icon: Link2, managerOnly: true },
 { key: 'notifications', label: 'Notifications', icon: Bell },
 { key: 'telegram', label: 'Telegram', icon: MessageSquare },
 { key: 'users', label: 'Users', icon: Users, managerOnly: true },
 { key: 'security', label: 'Security', icon: Shield },
];

const ALERT_TYPES = [
 { key: 'cap_alert', label: 'Cap Alerts', desc: 'When offer caps are approaching or hit' },
 { key: 'conversion_spike', label: 'Conversion Spikes', desc: 'Unusual conversion activity' },
 { key: 'offer_expired', label: 'Offer Expired', desc: 'When offers expire' },
 { key: 'offer_paused', label: 'Offer Paused', desc: 'When offers are paused' },
 { key: 'anomaly', label: 'Anomalies', desc: 'Traffic or revenue anomalies' },
 { key: 'system', label: 'System', desc: 'System-level alerts' },
];

export default function Settings() {
 const { user } = useAuth();
 const toast = useToast();
 const [tab, setTab] = useState('general');
 const [settings, setSettings] = useState({});
 const [users, setUsers] = useState([]);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);

 // Telegram state
 const [tgSettings, setTgSettings] = useState({
 botToken: '', chatId: '', enabled: false, alertTypes: [], isConfigured: false,
 });
 const [tgLoading, setTgLoading] = useState(false);
 const [tgTesting, setTgTesting] = useState(false);

 useEffect(() => {
 const fetch = async () => {
 try {
 const { data } = await api.get('/settings');
 setSettings(data.settings || {});
 } catch (err) {
 console.error(err);
 } finally {
 setLoading(false);
 }
 };
 fetch();
 }, []);

 useEffect(() => {
 // /users is manager-only server-side; skip the call for partners instead of
 // firing a request that can only come back 403.
 if (tab === 'users' && isManager(user)) {
 api.get('/users').then(r => setUsers(r.data.users || [])).catch(() => {});
 }
 if (tab === 'telegram') {
 setTgLoading(true);
 api.get('/telegram').then(r => {
 setTgSettings(r.data.settings || {});
 }).catch(() => {}).finally(() => setTgLoading(false));
 }
 }, [tab, user]);

 const updateSetting = (key, value) => {
 setSettings(prev => ({ ...prev, [key]: value }));
 };

 const saveSettings = async () => {
 setSaving(true);
 try {
 await api.put('/settings/bulk', { settings });
 toast.success('Settings saved successfully');
 } catch (err) {
 toast.error('Failed to save settings');
 } finally {
 setSaving(false);
 }
 };

 const saveTelegram = async () => {
 setSaving(true);
 try {
 await api.put('/telegram', tgSettings);
 toast.success('Telegram settings saved');
 } catch (err) {
 toast.error('Failed to save Telegram settings');
 } finally {
 setSaving(false);
 }
 };

 const testTelegram = async () => {
 setTgTesting(true);
 try {
 await api.post('/telegram/test', {
 botToken: tgSettings.botToken,
 chatId: tgSettings.chatId,
 });
 toast.success('Test message sent! Check your Telegram.');
 } catch (err) {
 toast.error(err.response?.data?.error || 'Failed to send test message');
 } finally {
 setTgTesting(false);
 }
 };

 const toggleAlertType = (type) => {
 setTgSettings(prev => ({
 ...prev,
 alertTypes: prev.alertTypes.includes(type)
 ? prev.alertTypes.filter(t => t !== type)
 : [...prev.alertTypes, type],
 }));
 };

 const isAdmin = isManager(user);
 const tabs = TABS.filter(t => !t.managerOnly || isAdmin);

 // A partner who was sitting on a manager-only tab when their role changed
 // would otherwise stay on a tab that no longer exists in the list.
 const activeTab = tabs.some(t => t.key === tab) ? tab : 'general';

 if (loading) {
 return <div className="flex items-center justify-center h-64 text-gray-400">Loading settings...</div>;
 }

 return (
 <div>
 <div className="flex items-center justify-between mb-6">
 <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
 {isAdmin && activeTab !== 'telegram' && activeTab !== 'users' && activeTab !== 'security' && (
 <button
 onClick={saveSettings}
 disabled={saving}
 className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
 >
 <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
 </button>
 )}
 {isAdmin && activeTab === 'telegram' && (
 <button
 onClick={saveTelegram}
 disabled={saving}
 className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
 >
 <Save size={16} /> {saving ? 'Saving...' : 'Save Telegram Settings'}
 </button>
 )}
 </div>

 <div className="flex gap-6">
 {/* Sidebar */}
 <div className="w-48 shrink-0">
 <div className="space-y-1">
 {tabs.map(t => {
 const Icon = t.icon;
 return (
 <button
 key={t.key}
 onClick={() => setTab(t.key)}
 className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
 activeTab === t.key ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
 }`}
 >
 <Icon size={16} /> {t.label}
 </button>
 );
 })}
 </div>
 </div>

 {/* Content */}
 <div className="flex-1">
 {activeTab === 'general' && (
 <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
 <h2 className="text-lg font-semibold text-gray-900">General Settings</h2>
 <SettingField label="Site Name" value={settings.siteName || ''} onChange={v => updateSetting('siteName', v)} disabled={!isAdmin} />
 <SettingSelect label="Default Currency" value={settings.currency || 'USD'} onChange={v => updateSetting('currency', v)} disabled={!isAdmin}
 options={['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'BRL', 'NZD']} />
 <SettingSelect label="Default Timezone" value={settings.timezone || 'UTC'} onChange={v => updateSetting('timezone', v)} disabled={!isAdmin}
 options={['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Kolkata', 'Asia/Tokyo']} />
 </div>
 )}

 {activeTab === 'tracking' && (
 <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
 <h2 className="text-lg font-semibold text-gray-900">Tracking Settings</h2>
 <SettingField label="Tracking Domain" value={settings.trackingDomain || ''} onChange={v => updateSetting('trackingDomain', v)} disabled={!isAdmin}
 placeholder="e.g. track.yourdomain.com" />
 <SettingSelect label="Default Redirect Type" value={settings.defaultRedirectType || '302'} onChange={v => updateSetting('defaultRedirectType', v)} disabled={!isAdmin}
 options={['302', 'meta', 'javascript', 'direct']} />
 <SettingField label="Click ID Parameter" value={settings.clickIdParam || 'click_id'} onChange={v => updateSetting('clickIdParam', v)} disabled={!isAdmin} />
 <SettingField label="Global Postback URL" value={settings.globalPostbackUrl || ''} onChange={v => updateSetting('globalPostbackUrl', v)} disabled={!isAdmin}
 placeholder="https://your-network.com/postback?cid={click_id}" />
 <SettingField label="Default IP Cap" type="number" value={settings.defaultIpCap ?? 1} onChange={v => updateSetting('defaultIpCap', parseInt(v))} disabled={!isAdmin} />
 <SettingToggle label="Default Bot Detection" value={settings.defaultBotDetection} onChange={v => updateSetting('defaultBotDetection', v)} disabled={!isAdmin} />
 <SettingToggle label="Default VPN Detection" value={settings.defaultVpnDetection} onChange={v => updateSetting('defaultVpnDetection', v)} disabled={!isAdmin} />
 </div>
 )}

 {activeTab === 'notifications' && (
 <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
 <h2 className="text-lg font-semibold text-gray-900">Notification Settings</h2>
 <SettingToggle label="Email Notifications" value={settings.emailNotifications} onChange={v => updateSetting('emailNotifications', v)} disabled={!isAdmin} />
 <SettingField label="Cap Alert Threshold (%)" type="number" value={settings.capAlertThreshold ?? 90}
 onChange={v => updateSetting('capAlertThreshold', parseInt(v))} disabled={!isAdmin} />
 <SettingField label="Conversion Spike Multiplier" type="number" value={settings.conversionSpikeMultiplier ?? 3}
 onChange={v => updateSetting('conversionSpikeMultiplier', parseFloat(v))} disabled={!isAdmin}
 hint="Alert when conversions exceed average by this multiplier" />
 </div>
 )}

 {activeTab === 'telegram' && (
 <div className="space-y-4">
 <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-lg font-semibold text-gray-900">Telegram Bot Integration</h2>
 <p className="text-sm text-gray-500 mt-1">Receive real-time alerts in your Telegram chat</p>
 </div>
 {tgSettings.isConfigured && (
 <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
 <CheckCircle size={12} /> Connected
 </span>
 )}
 </div>

 {tgLoading ? (
 <div className="text-sm text-gray-400">Loading Telegram settings...</div>
 ) : (
 <>
 <SettingToggle
 label="Enable Telegram Alerts"
 value={tgSettings.enabled}
 onChange={v => setTgSettings(prev => ({ ...prev, enabled: v }))}
 disabled={!isAdmin}
 />

 <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
 <p className="text-sm text-blue-700">
 <strong>Setup:</strong> Message <code className="bg-blue-100 px-1 rounded">@BotFather</code> on Telegram to create a bot and get your token.
 Then add the bot to your group/channel and get the Chat ID.
 </p>
 </div>

 <SettingField
 label="Bot Token"
 value={tgSettings.botToken}
 onChange={v => setTgSettings(prev => ({ ...prev, botToken: v }))}
 disabled={!isAdmin}
 placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
 />

 <SettingField
 label="Chat ID"
 value={tgSettings.chatId}
 onChange={v => setTgSettings(prev => ({ ...prev, chatId: v }))}
 disabled={!isAdmin}
 placeholder="-1001234567890"
 hint="Use @userinfobot to find your chat ID, or use the group ID for groups"
 />

 {isAdmin && (
 <button
 onClick={testTelegram}
 disabled={tgTesting || !tgSettings.botToken || !tgSettings.chatId}
 className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50"
 >
 <Send size={14} /> {tgTesting ? 'Sending...' : 'Send Test Message'}
 </button>
 )}
 </>
 )}
 </div>

 {/* Alert type toggles */}
 <div className="bg-white rounded-xl border border-gray-200 p-6">
 <h3 className="text-sm font-semibold text-gray-900 mb-3">Alert Types</h3>
 <p className="text-xs text-gray-500 mb-4">Choose which notifications to send to Telegram. Leave all unchecked to receive all types.</p>
 <div className="space-y-3">
 {ALERT_TYPES.map(at => (
 <label key={at.key} className="flex items-start gap-3 cursor-pointer">
 <input
 type="checkbox"
 checked={tgSettings.alertTypes.includes(at.key)}
 onChange={() => toggleAlertType(at.key)}
 disabled={!isAdmin}
 className="mt-0.5 rounded text-blue-600"
 />
 <div>
 <span className="text-sm font-medium text-gray-700">{at.label}</span>
 <p className="text-xs text-gray-400">{at.desc}</p>
 </div>
 </label>
 ))}
 </div>
 </div>
 </div>
 )}

 {activeTab === 'users' && (
 <div className="bg-white rounded-xl border border-gray-200 p-6">
 <h2 className="text-lg font-semibold text-gray-900 mb-4">User Management</h2>
 {users.length === 0 ? (
 <p className="text-gray-400 text-sm">No users found</p>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-gray-200">
 <th className="text-left px-3 py-2 font-medium text-gray-600">Name</th>
 <th className="text-left px-3 py-2 font-medium text-gray-600">Email</th>
 <th className="text-left px-3 py-2 font-medium text-gray-600">Role</th>
 <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
 <th className="text-left px-3 py-2 font-medium text-gray-600">Last Login</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100">
 {users.map(u => (
 <tr key={u._id} className="hover:bg-gray-50">
 <td className="px-3 py-2 font-medium text-gray-900">{u.name}</td>
 <td className="px-3 py-2 text-gray-600">{u.email}</td>
 <td className="px-3 py-2">
 <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
 {u.role}
 </span>
 </td>
 <td className="px-3 py-2">
 <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
 u.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
 }`}>
 {u.status}
 </span>
 </td>
 <td className="px-3 py-2 text-gray-500 text-xs">
 {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 )}

 {activeTab === 'security' && (
 <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
 <h2 className="text-lg font-semibold text-gray-900">Security</h2>
 <ChangePasswordForm />
 </div>
 )}
 </div>
 </div>
 </div>
 );
}

function SettingField({ label, value, onChange, disabled, type = 'text', placeholder, hint }) {
 return (
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
 <input
 type={type} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
 placeholder={placeholder}
 className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed bg-white text-gray-900"
 />
 {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
 </div>
 );
}

function SettingSelect({ label, value, onChange, disabled, options }) {
 return (
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
 <select
 value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
 className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 bg-white text-gray-900"
 >
 {options.map(o => <option key={o} value={o}>{o}</option>)}
 </select>
 </div>
 );
}

function SettingToggle({ label, value, onChange, disabled }) {
 return (
 <label className="flex items-center gap-3 cursor-pointer">
 <div className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-gray-300'} ${disabled ? 'opacity-50' : ''}`}>
 <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} disabled={disabled} className="sr-only" />
 <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
 </div>
 <span className="text-sm font-medium text-gray-700">{label}</span>
 </label>
 );
}

function ChangePasswordForm() {
 const toast = useToast();
 const [currentPassword, setCurrentPassword] = useState('');
 const [newPassword, setNewPassword] = useState('');
 const [confirmPassword, setConfirmPassword] = useState('');
 const [loading, setLoading] = useState(false);

 const handleSubmit = async (e) => {
 e.preventDefault();
 if (newPassword !== confirmPassword) {
 toast.error('Passwords do not match');
 return;
 }
 if (newPassword.length < 8) {
 toast.error('Password must be at least 8 characters');
 return;
 }
 setLoading(true);
 try {
 await api.put('/auth/change-password', { currentPassword, newPassword });
 toast.success('Password changed successfully');
 setCurrentPassword('');
 setNewPassword('');
 setConfirmPassword('');
 } catch (err) {
 toast.error(err.response?.data?.error || 'Failed to change password');
 } finally {
 setLoading(false);
 }
 };

 return (
 <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
 <h3 className="text-sm font-semibold text-gray-700">Change Password</h3>
 <div>
 <label className="block text-sm text-gray-600 mb-1">Current Password</label>
 <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required
 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900" />
 </div>
 <div>
 <label className="block text-sm text-gray-600 mb-1">New Password</label>
 <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required
 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900" />
 </div>
 <div>
 <label className="block text-sm text-gray-600 mb-1">Confirm New Password</label>
 <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900" />
 </div>
 <button type="submit" disabled={loading}
 className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
 {loading ? 'Changing...' : 'Change Password'}
 </button>
 </form>
 );
}
