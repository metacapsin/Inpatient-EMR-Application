type RadiologyEmptyStateProps = {
    title: string;
    description: string;
};

export function RadiologyEmptyState({ title, description }: RadiologyEmptyStateProps) {
    return (
        <div
            className="mx-2 my-6 flex min-h-[12rem] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200/90 bg-gray-50/40 px-6 py-10 text-center dark:border-white/10 dark:bg-white/[0.02] lg:mx-3"
            role="status"
        >
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</p>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
        </div>
    );
}
