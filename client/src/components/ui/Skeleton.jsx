export function Skeleton({ className = '', width, height }) {
 return (
 <div
 className={`animate-pulse bg-gray-200 rounded ${className}`}
 style={{ width, height }}
 />
 );
}

export function TableSkeleton({ rows = 5, cols = 6 }) {
 return (
 <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
 <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex gap-4">
 {Array.from({ length: cols }).map((_, i) => (
 <Skeleton key={i} className="h-4 flex-1" />
 ))}
 </div>
 {Array.from({ length: rows }).map((_, r) => (
 <div key={r} className="px-4 py-3 flex gap-4 border-b border-gray-100 last:border-0">
 {Array.from({ length: cols }).map((_, c) => (
 <Skeleton key={c} className="h-4 flex-1" />
 ))}
 </div>
 ))}
 </div>
 );
}

export function CardSkeleton({ count = 4 }) {
 return (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 {Array.from({ length: count }).map((_, i) => (
 <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
 <Skeleton className="h-3 w-20 mb-3" />
 <Skeleton className="h-7 w-32 mb-2" />
 <Skeleton className="h-3 w-24" />
 </div>
 ))}
 </div>
 );
}

export function FormSkeleton() {
 return (
 <div className="space-y-6 max-w-5xl mx-auto">
 <Skeleton className="h-8 w-48" />
 <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
 <div className="flex gap-4 border-b border-gray-200 pb-3">
 {Array.from({ length: 5 }).map((_, i) => (
 <Skeleton key={i} className="h-8 w-24" />
 ))}
 </div>
 <div className="grid grid-cols-2 gap-4">
 {Array.from({ length: 6 }).map((_, i) => (
 <div key={i}>
 <Skeleton className="h-3 w-24 mb-2" />
 <Skeleton className="h-10 w-full" />
 </div>
 ))}
 </div>
 </div>
 </div>
 );
}
