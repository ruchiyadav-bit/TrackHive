import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { isManager, isReadOnly, canManageTeam } from '../../utils/roles';
import {
  LayoutDashboard, FileText, BarChart3, Settings,
  ChevronDown, ChevronRight, PanelLeftClose, PanelLeft,
  Plus, Users, Globe, MousePointerClick, Calendar, Monitor, Megaphone,
  Clock, ArrowRightLeft, ScrollText, DollarSign, Activity,
} from 'lucide-react';

const navItems = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/',
  },
  {
    label: 'Offers',
    icon: FileText,
    path: '/offers',
    children: [
      { label: 'All Offers', path: '/offers', icon: FileText },
      { label: '+ Create Offer', path: '/offers/new', icon: Plus, writeOnly: true },
    ],
  },
  {
    label: 'Advertisers',
    icon: Megaphone,
    path: '/advertisers',
    children: [
      { label: 'All Advertisers', path: '/advertisers', icon: Megaphone },
      { label: '+ Add Advertiser', path: '/advertisers/new', icon: Plus, writeOnly: true },
    ],
  },
  {
    label: 'Reports',
    icon: BarChart3,
    path: '/reports',
    children: [
      { label: 'Conversion', path: '/reports/conversion', icon: ArrowRightLeft },
      { label: 'Offer', path: '/reports/offer', icon: FileText },
      { label: 'Daily', path: '/reports/daily', icon: Calendar },
      { label: 'Hourly', path: '/reports/hourly', icon: Clock },
      { label: 'Logs', path: '/reports/logs', icon: ScrollText },
    ],
  },
  {
    // Team member: enter daily ad spend. Manager / partner: the Ad Spend
    // report for their own team.
    label: 'Ad Spend',
    icon: DollarSign,
    path: '/ad-spend',
  },
  {
    // Managers get the complete page. Partners get the read-only tracking,
    // domain, data, offer URL and postback sections for their own data.
    label: 'System Health',
    icon: Activity,
    path: '/system-health',
    teamManagers: true,
  },
  {
    label: 'Settings',
    icon: Settings,
    path: '/settings',
    children: [
      { label: 'General', path: '/settings/general', icon: Settings },
      // Visible to managers and to team members (read-only for the latter);
      // partners still have no reason to open it.
      { label: 'Tracking Domains', path: '/settings/tracking-domains', icon: Globe, managerOrTeam: true },
      // Manager: every user. Partner: "My Team" — only the team members it
      // created (the server filters the list, not just this menu).
      { label: 'Users', partnerLabel: 'My Team', path: '/settings/users', icon: Users, teamManagers: true },
    ],
  },
];

/**
 * Drop manager-only entries for partners, and drop any parent left with no
 * children — a "Settings" group that expands to nothing reads as a bug.
 */
function visibleNav(items, canManage, readOnly, runsTeam) {
  const allowed = item => {
    if (item.managerOnly && !canManage) return false;
    if (item.teamManagers && !runsTeam) return false;
    if (item.managerOrTeam && !canManage && !readOnly) return false;
    // "+ Create" style entries: pointless for an account that cannot write,
    // and the server would refuse the POST anyway.
    if (item.writeOnly && readOnly) return false;
    // Pages a read-only team viewer has no business opening at all.
    if (item.notTeam && readOnly) return false;
    return true;
  };
  return items.reduce((acc, item) => {
    if (!allowed(item)) return acc;
    if (!item.children) return [...acc, item];
    const children = item.children.filter(allowed).map(c =>
      // Partners see their team screen under its own name.
      (c.partnerLabel && !canManage ? { ...c, label: c.partnerLabel } : c));
    if (!children.length) return acc;
    return [...acc, { ...item, children }];
  }, []);
}

function NavItem({ item, collapsed }) {
  const location = useLocation();
  const [open, setOpen] = useState(
    item.children?.some((c) => location.pathname === c.path) || false
  );
  const hasChildren = item.children && item.children.length > 0;
  const Icon = item.icon;

  const isActive = hasChildren
    ? item.children.some((c) => location.pathname === c.path)
    : location.pathname === item.path;

  if (hasChildren && !collapsed) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Icon size={18} />
          <span className="flex-1 text-left">{item.label}</span>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {open && (
          <div className="ml-4 mt-1 space-y-0.5">
            {item.children.map((child) => {
              const ChildIcon = child.icon;
              return (
                <NavLink
                  key={child.path}
                  to={child.path}
                  end={child.path === '/offers' || child.path === '/advertisers'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  <ChildIcon size={15} />
                  {child.label}
                </NavLink>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.path}
      end
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100'
        }`
      }
      title={collapsed ? item.label : undefined}
    >
      <Icon size={18} />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );
}

export default function Sidebar({ onCloseMobile }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();
  const { siteName } = useSiteSettings();
  const items = visibleNav(navItems, isManager(user), isReadOnly(user), canManageTeam(user));

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-60'
      } h-full bg-white border-r border-gray-200 flex flex-col transition-all duration-200 shrink-0`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        {!collapsed && (
          <span className="text-lg font-bold text-blue-600">{siteName}</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hidden lg:block"
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto" onClick={onCloseMobile}>
        {items.map((item) => (
          <NavItem key={item.path + item.label} item={item} collapsed={collapsed} />
        ))}
      </nav>
    </aside>
  );
}
