import { Link } from 'react-router-dom';

export default function EmptyState({ icon: Icon, title, description, actionLabel, actionTo, onAction }) {
 return (
 <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
 {Icon && <Icon size={48} className="mx-auto text-gray-300 mb-4" />}
 <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
 {description && <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">{description}</p>}
 {actionLabel && actionTo && (
 <Link to={actionTo} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
 {actionLabel}
 </Link>
 )}
 {actionLabel && onAction && !actionTo && (
 <button onClick={onAction} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
 {actionLabel}
 </button>
 )}
 </div>
 );
}
