import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { missingLegalFields, publicSite } from '../../config/publicSite';
import { useSiteSettings } from '../../hooks/useSiteSettings';

const navigation = [
  { to: '/tracker-info', label: 'Click Tracker' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/contact', label: 'Contact' },
  { to: '/login', label: 'Sign in' },
];

export default function PublicSiteLayout({ title, eyebrow, intro, children }) {
  const { siteName } = useSiteSettings();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4">
          <Link to="/tracker-info" className="flex items-center gap-2 font-bold text-blue-700">
            <ShieldCheck size={22} aria-hidden="true" />
            <span>{siteName}</span>
          </Link>
          <nav aria-label="Public navigation" className="flex flex-wrap justify-end gap-x-5 gap-y-2 text-sm">
            {navigation.map((item) => (
              <Link key={item.to} to={item.to} className="text-slate-600 hover:text-blue-700">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50">
          <div className="mx-auto max-w-4xl px-5 py-14 sm:py-20">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">{eyebrow}</p>
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">{title}</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">{intro}</p>
          </div>
        </section>

        {missingLegalFields.length > 0 ? (
          <div className="mx-auto max-w-4xl px-5 pt-8" role="alert">
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>Configuration required before publication:</strong>{' '}
              complete {missingLegalFields.join(', ')} in <code>client/src/config/publicSite.js</code>.
            </div>
          </div>
        ) : null}

        <div className="mx-auto max-w-4xl px-5 py-10 sm:py-14">{children}</div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {publicSite.legalCompanyName}.</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-blue-700">Privacy</Link>
            <Link to="/contact" className="hover:text-blue-700">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

