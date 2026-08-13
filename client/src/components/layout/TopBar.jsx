import { LogOut, User, Menu } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const roleBadgeColors = {
  super_admin: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  manager: 'bg-green-100 text-green-800',
  viewer: 'bg-gray-100 text-gray-600',
};

const roleLabels = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  viewer: 'Viewer',
};

export default function TopBar({ onMenuToggle }) {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 lg:hidden"
        >
          <Menu size={20} />
        </button>
        <div className="text-sm text-gray-500 hidden sm:block">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* User info */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
            {user?.name?.charAt(0)?.toUpperCase() || <User size={16} />}
          </div>
          <div className="hidden sm:block text-right">
            <div className="text-sm font-medium text-gray-900">{user?.name}</div>
            <span
              className={`inline-block text-xs px-1.5 py-0.5 rounded-full font-medium ${
                roleBadgeColors[user?.role] || 'bg-gray-100 text-gray-600'
              }`}
            >
              {roleLabels[user?.role] || user?.role}
            </span>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
