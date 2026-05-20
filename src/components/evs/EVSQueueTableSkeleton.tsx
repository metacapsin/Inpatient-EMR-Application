export function EVSQueueTableSkeleton() {
    return (
        <>
            {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                    <td className="px-2.5 py-2" colSpan={10}>
                        <div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                </tr>
            ))}
        </>
    );
}
