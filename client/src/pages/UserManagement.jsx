import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Eye, EyeOff, UserPlus } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { ROLES, DEFAULT_ROLE, MANAGER, isManager, normalizeRole, roleLabel } from '../utils/roles';

const roleColors = {
 manager: 'bg-blue-100 text-blue-800',
 partner: 'bg-gray-100 text-gray-600',
};

const statusColors = {
 active: 'bg-green-100 text-green-800',
 inactive: 'bg-gray-100 text-gray-600',
};

const emptyForm = { name: '', email: '', password: '', role: DEFAULT_ROLE, status: 'active' };

export default function UserManagement() {
 const { user: currentUser } = useAuth();
 const toast = useToast();
 const [users, setUsers] = useState([]);
 const [loading, setLoading] = useState(true);
 const [showForm, setShowForm] = useState(false);
 const [editingId, setEditingId] = useState(null);
 const [form, setForm] = useState(emptyForm);
 const [saving, setSaving] = useState(false);
 const [showPassword, setShowPassword] = useState(false);

 const isAdmin = isManager(currentUser);

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
 setForm({ name: u.name, email: u.email, password: '', role: u.role, status: u.status });
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
 const payload = { name: form.name, email: form.email, role: form.role, status: form.status };
 if (form.password) payload.password = form.password;
 await api.put(`/users/${editingId}`, payload);
 toast.success('User updated');
 } else {
 await api.post('/users', form);
 toast.success('User created');
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
 <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
 {isAdmin && (
 <button
 onClick={openAdd}
 className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
 >
 <UserPlus size={16} /> Add User
 </button>
 )}
 </div>

 {/* User Table */}
 <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
 {users.length === 0 ? (
 <div className="p-12 text-center text-gray-400">No users found</div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-gray-50 border-b border-gray-200">
 <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
 <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
 <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
 <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
 <th className="text-left px-4 py-3 font-medium text-gray-600">Last Login</th>
 <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
 {isAdmin && <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>}
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
 <td className="px-4 py-3">
 <button
 onClick={() => isAdmin && !isLocked(u) && handleToggleStatus(u)}
 disabled={!isAdmin || isLocked(u)}
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
 {isAdmin && (
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

 {/* Add/Edit Modal */}
 {showForm && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
 <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md mx-4 shadow-2xl">
 <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
 <h2 className="text-lg font-semibold text-gray-900">
 {editingId ? 'Edit User' : 'Add User'}
 </h2>
 <button onClick={closeForm} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
 <X size={18} />
 </button>
 </div>
 <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
 <select
 value={form.role}
 onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
 >
 {ROLES.map(r => (
 <option key={r.value} value={r.value}>{r.label}</option>
 ))}
 </select>
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
 <div className="flex justify-end gap-3 pt-2">
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
 {saving ? 'Saving...' : editingId ? 'Update User' : 'Create User'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </div>
 );
}
