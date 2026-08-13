import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout() {
 const [mobileOpen, setMobileOpen] = useState(false);

 return (
 <div className="flex h-screen overflow-hidden bg-gray-50">
 {/* Mobile overlay */}
 {mobileOpen && (
 <div
 className="fixed inset-0 bg-black/40 z-30 lg:hidden"
 onClick={() => setMobileOpen(false)}
 />
 )}

 {/* Sidebar - hidden on mobile unless toggled */}
 <div className={`
 fixed inset-y-0 left-0 z-40 lg:static lg:z-auto
 transform transition-transform duration-200 ease-in-out
 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
 `}>
 <Sidebar onCloseMobile={() => setMobileOpen(false)} />
 </div>

 <div className="flex-1 flex flex-col overflow-hidden">
 <TopBar onMenuToggle={() => setMobileOpen(!mobileOpen)} />
 <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
 <Outlet />
 </main>
 </div>
 </div>
 );
}
