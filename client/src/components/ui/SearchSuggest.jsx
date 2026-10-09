import { useState } from 'react';
import { Search } from 'lucide-react';

/**
 * Search box with name suggestions.
 *
 * Suggestions are the names that START with what was typed (case-insensitive),
 * so typing "g" lists "Geetahair", "Gundry MD"... and not every name that just
 * contains a "g" somewhere. Picking one fills the box and runs the search.
 */
export default function SearchSuggest({ value, onChange, onPick, names = [], placeholder, className = '', inputClassName = '' }) {
  const [open, setOpen] = useState(false);
  const q = (value || '').trim().toLowerCase();
  const suggestions = q
    ? [...new Set(names.filter(Boolean))]
        .filter(n => n.toLowerCase().startsWith(q))
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 8)
    : [];

  const pick = (name) => {
    setOpen(false);
    (onPick || onChange)(name);
  };

  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        placeholder={placeholder}
        className={inputClassName || 'w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-gray-900'}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {suggestions.map(n => (
            <li key={n}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(n)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50"
              >
                <span className="font-semibold">{n.slice(0, q.length)}</span>{n.slice(q.length)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
