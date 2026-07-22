import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api } from '../api/client';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/compras', label: 'Compras', icon: '🛒' },
  { to: '/inventario', label: 'Inventario', icon: '📦' },
  { to: '/ventas', label: 'Ventas', icon: '💰' },
  { to: '/gastos', label: 'Gastos', icon: '💸' },
  { to: '/caja', label: 'Caja', icon: '🏦' },
];

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const sidebar = (
    <>
      <div className="p-4 border-b border-[#2a2a2a] flex items-center gap-3">
        <img src="/logo.png" alt="Bombastic Dreamers" className="w-12 h-12 object-contain shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl leading-none text-[#ffcc00]">BOMBASTIC</h1>
          <p className="text-[11px] text-gray-400 tracking-[0.2em] uppercase mt-0.5">Dreamers</p>
        </div>
        <button
          type="button"
          className="lg:hidden text-gray-400 hover:text-[#ffcc00] text-2xl leading-none px-1"
          onClick={closeMenu}
          aria-label="Cerrar menú"
        >
          ×
        </button>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={closeMenu}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                isActive
                  ? 'bg-[#ffcc00] text-black'
                  : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-[#ffcc00]'
              }`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-[#2a2a2a] space-y-1">
        <button
          onClick={() => { api.backup(); closeMenu(); }}
          className="w-full text-left px-3 py-3 text-xs text-gray-500 hover:text-[#ffcc00] rounded-lg hover:bg-[#1a1a1a] transition-colors min-h-[44px]"
        >
          💾 Backup BD
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Top bar móvil */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 py-3 bg-black border-b border-[#2a2a2a]">
        <button
          type="button"
          className="btn-secondary !px-3 !py-2 min-h-[44px] min-w-[44px]"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú"
        >
          ☰
        </button>
        <img src="/logo.png" alt="" className="w-9 h-9 object-contain" />
        <div className="min-w-0">
          <p className="font-display text-xl leading-none text-[#ffcc00] truncate">BOMBASTIC</p>
          <p className="text-[10px] text-gray-500 tracking-widest uppercase">Dreamers</p>
        </div>
      </header>

      {/* Overlay móvil */}
      {menuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/70"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: drawer en móvil, fijo en desktop */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-[min(18rem,85vw)] bg-black text-white
          flex flex-col shrink-0 border-r border-[#2a2a2a]
          transform transition-transform duration-200 ease-out
          ${menuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {sidebar}
      </aside>

      <main className="flex-1 overflow-auto min-w-0">
        <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
