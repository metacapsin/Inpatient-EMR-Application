export function ConsentsTableSkeleton() {
    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-white/10 dark:bg-gray-800/50">
                <div className="flex gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-3 w-16 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                    ))}
                </div>
            </div>
            {Array.from({ length: 5 }).map((_, row) => (
                <div
                    key={row}
                    className="flex gap-4 border-b border-gray-100 px-4 py-4 last:border-0 dark:border-white/5"
                >
                    {Array.from({ length: 6 }).map((_, col) => (
                        <div
                            key={col}
                            className="h-4 flex-1 animate-pulse rounded bg-gray-100 dark:bg-white/[0.06]"
                            style={{ maxWidth: col === 0 ? 140 : 80 }}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}
