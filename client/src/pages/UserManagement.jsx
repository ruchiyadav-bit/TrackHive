import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Eye, EyeOff, UserPlus } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import {
 ROLES, DEFAULT_ROLE, MANAGER, TEAM, isManager, canManageTeam, normalizeRole, roleLabel,
 TEAM_REPORT_FIELDS, normalizeTeamReportFields,
} from '../utils/roles';

const roleColors = {
 manager: 'bg-blue-100 text-blue-800',
 partner: 'bg-gray-100 text-gray-600',
 team: 'bg-violet-100 text-violet-700',
};

const statusColors = {
 active: 'bg-green-100 text-green-800',
 inactive: 'bg-gray-100 text-gray-600',
};

const makeEmptyForm = (role) => ({
 name: '', email: '', password: '', role, status: 'active',
 teamReportFields: normalizeTeamReportFields({}),
});

export default function UserManagement() {
 const { user: currentUser } = useAuth();
 const toast = useToast();
 const [users, setUsers] = useState([]);
 const [loading, setLoading] = useState(true);
 const [showForm, setShowForm] = useState(false);
 const [editingId, setEditingId] = useState(null);
 const isAdmin = isManager(currentUser);
 // Partner: this screen is "My Team". The server only ever returns the team
 // members this partner created and forces anything it creates to role=team
 // owned by the partner — the UI below just matches that.
 const runsTeam = canManageTeam(currentUser);
 const partnerMode = runsTeam && !isAdmin;
 const emptyForm = makeEmptyForm(partnerMode ? TEAM : DEFAULT_ROLE);
 const [form, setForm] = useState(emptyForm);
 const [saving, setSaving] = useState(false);
 const [showPassword, setShowPassword] = useState(false);

 // Removing the last manager would make this screen unreachable for everyone,
 // so the server refuses it. Mirror that here to disable the controls instead
 // of letting the click come back 403.
 const activeManagers = users.filter(u => normalizeRole(u.role) === MANAGER && u.status === 'active');
 const isLastManager = (u) =>
  normalizeRole(u.role) === MANAGER && activeManagers.length <= 1 && u.status === 'active';
 const isSelf = (u) => u._id === currentUser?._id;
 const isLocked = (u) => isSelf(u) || isLastManager(u);

 const fetchUsers = async () => {
 try {
 const { data } = await api.get('/users');
 setUsers(data.users || []);
 } catch (err) {
 console.error('Failed to fetch users:', err);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => { fetchUsers(); }, []);

 const openAdd = () => {
 setEditingId(null);
 setForm(emptyForm);
 setShowPassword(false);
 setShowForm(true);
 };

 const openEdit = (u) => {
 setEditingId(u._id);
 setForm({
 name: u.name,
 email: u.email,
 password: '',
 role: u.role,
 status: u.status,
 teamReportFields: normalizeTeamReportFields(u.teamReportFields),
 });
 setShowPassword(false);
 setShowForm(true);
 };

 const closeForm = () => {
 setShowForm(false);
 setEditingId(null);
 setForm(emptyForm);
 };

 const handleSubmit = async (e) => {
 e.preventDefault();
 setSaving(true);
 try {
 if (editingId) {
 const payload = { name: form.name, email: form.email, status: form.status };
 // A partner cannot change roles (the server ignores it anyway).
 if (!partnerMode) payload.role = form.role;
 if (form.password) payload.password = form.password;
 // Only meaningful for a team account; sending it for a manager would
 // just store a map nothing reads.
 if (form.role === TEAM) payload.teamReportFields = form.teamReportFields;
 await api.put(`/users/${editingId}`, payload);
 toast.success(partnerMode ? 'Team member updated' : 'User updated');
 } else {
 const payload = { ...form };
 if (partnerMode) payload.role = TEAM;
 if (payload.role !== TEAM) delete payload.teamReportFields;
 await api.post('/users', payload);
 toast.success(partnerMode ? 'Team member created' : 'User created');
 }
 closeForm();
 fetchUsers();
 } catch (err) {
 toast.error(err.response?.data?.error || 'Failed to save user');
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (id, name) => {
 if (!window.confirm(`Delete user "${name}"? This cannot be undone.`)) return;
 try {
 await api.delete(`/users/${id}`);
 toast.success('User deleted');
 fetchUsers();
 } catch (err) {
 toast.error(err.response?.data?.error || 'Failed to delete user');
 }
 };

 const handleToggleStatus = async (u) => {
 const newStatus = u.status === 'active' ? 'inactive' : 'active';
 try {
 await api.put(`/users/${u._id}/status`, { status: newStatus });
 toast.success(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
 fetchUsers();
 } catch (err) {
 toast.error(err.response?.data?.error || 'Failed to update status');
 }
 };

 if (loading) {
 return <div className="flex items-center justify-center h-64 text-gray-400">Loading users...</div>;
 }

 return (
 <div>
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-2xl font-bold text-gray-900">{partnerMode ? 'My Team' : 'User Management'}</h1>
 {partnerMode && (
 <p className="text-sm text-gray-500 mt-1">
 Team members see only your offers and reports — no revenue or payout, only a performance badge.
 Other partners and their teams never see your data, and you never see theirs.
 </p>
 )}
 </div>
 {runsTeam && (
 <button
 onClick={openAdd}
 className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
 >
 <UserPlus size={16} /> {partnerMode ? 'Add Team Member' : 'Add User'}
 </button>
 )}
 </div>

 {/* User Table */}
 <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
 {users.length === 0 ? (
 <div className="p-12 text-center text-gray-400">
 {partnerMode ? 'No team members yet. Add one to give your team a view of your dashboard.' : 'No users found'}
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-gray-50 border-b border-gray-200">
 <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
 <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
 <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
 {isAdmin && <th className="text-left px-4 py-3 font-medium text-gray-600">Team Of</th>}
 <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
 <th className="text-left px-4 py-3 font-medium text-gray-600">Last Login</th>
 <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
 {runsTeam && <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>}
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100">
 {users.map(u => (
 <tr key={u._id} className="hover:bg-gray-50 transition-colors">
 <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
 <td className="px-4 py-3 text-gray-600">{u.email}</td>
 <td className="px-4 py-3">
 <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[normalizeRole(u.role)] || ''}`}>
 {roleLabel(u.role)}
 </span>
 </td>
 {isAdmin && (
 <td className="px-4 py-3 text-gray-600 text-xs">
 {normalizeRole(u.role) === TEAM ? (u.teamOwnerName || '—') : ''}
 </td>
 )}
 <td className="px-4 py-3">
 <button
 onClick={() => runsTeam && !isLocked(u) && handleToggleStatus(u)}
 disabled={!runsTeam || isLocked(u)}
 title={isLocked(u) ? 'The last active manager cannot be deactivated' : undefined}
 className="cursor-pointer disabled:cursor-default"
 >
 <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[u.status] || ''}`}>
 {u.status}
 </span>
 </button>
 </td>
 <td className="px-4 py-3 text-gray-500 text-xs">
 {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}
 </td>
 <td className="px-4 py-3 text-gray-500 text-xs">
 {new Date(u.createdAt).toLocaleDateString()}
 </td>
 {runsTeam && (
 <td className="px-4 py-3">
 <div className="flex items-center justify-center gap-1">
 {!isLocked(u) && (
 <>
 <button
 onClick={() => openEdit(u)}
 className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
 title="Edit"
 >
 <Pencil size={14} />
 </button>
 <button
 onClick={() => handleDelete(u._id, u.name)}
 className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
 title="Delete"
 >
 <Trash2 size={14} />
 </button>
 </>
 )}
 </div>
 </td>
 )}
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>

 {/* Add/Edit Modal.
 The form grew a toggle grid for team members and stopped fitting on a
 laptop — the buttons fell off the bottom of the screen with no way to
 reach them. The dialog is now capped at the viewport and the BODY
 scrolls, so the header and the Save row stay put. */}
 {showForm && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
 <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
 <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
 <h2 className="text-lg font-semibold text-gray-900">
 {partnerMode
 ? (editingId ? 'Edit Team Member' : 'Add Team Member')
 : (editingId ? 'Edit User' : 'Add User')}
 </h2>
 <button onClick={closeForm} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
 <X size={18} />
 </button>
 </div>
 <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
 <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
 <input
 type="text"
 value={form.name}
 onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
 required
 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
 placeholder="Full name"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
 <input
 type="email"
 value={form.email}
 onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
 required
 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
 placeholder="user@example.com"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">
 Password {editingId && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}
 </label>
 <div className="relative">
 <input
 type={showPassword ? 'text' : 'password'}
 value={form.password}
 onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
 required={!editingId}
 minLength={8}
 className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
 placeholder={editingId ? 'Leave blank to keep current' : 'Min 8 characters'}
 />
 <button
 type="button"
 onClick={() => setShowPassword(!showPassword)}
 className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
 >
 {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
 </button>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
 {partnerMode ? (
 <>
 <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700">Team Member</div>
 <p className="text-xs text-gray-400 mt-1">Sees only your data, view-only.</p>
 </>
 ) : (
 <>
 <select
 value={form.role}
 onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
 >
 {ROLES.map(r => (
 <option key={r.value} value={r.value}>{r.label}</option>
 ))}
 </select>
 <p className="text-xs text-gray-400 mt-1">
 {ROLES.find(r => r.value === form.role)?.description}
 </p>
 </>
 )}
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
 <select
 value={form.status}
 onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
 >
 <option value="active">Active</option>
 <option value="inactive">Inactive</option>
 </select>
 </div>
 </div>

 {/* Team members only: which report fields this person may see.
 The server enforces this list — a field switched off here is
 deleted from the API response, not merely hidden in the table. */}
 {form.role === TEAM && (
 <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
 <div className="text-sm font-medium text-gray-800 mb-1">Visible report fields</div>
 <p className="text-xs text-gray-500 mb-3">
 This account never sees revenue, payout or profit — only a performance
 badge, scored from the daily ad spend they enter. Use these toggles
 to narrow it further.
 </p>
 <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
 {TEAM_REPORT_FIELDS.map(f => (
 <label key={f.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
 <input
 type="checkbox"
 checked={form.teamReportFields?.[f.key] !== false}
 onChange={e => setForm(prev => ({
 ...prev,
 teamReportFields: { ...prev.teamReportFields, [f.key]: e.target.checked },
 }))}
 className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
 />
 {f.label}
 </label>
 ))}
 </div>
 </div>
 )}
 </div>

 <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 shrink-0 bg-white rounded-b-xl">
 <button
 type="button"
 onClick={closeForm}
 className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={saving}
 className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
 >
 {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </div>
 );
}
