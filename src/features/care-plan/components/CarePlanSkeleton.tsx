import { Skeleton } from 'primereact/skeleton';

export function CarePlanSkeleton() {
    return (
        <div className="space-y-4 p-4" aria-busy="true" aria-label="Loading care plan">
            <Skeleton height="4.5rem" className="!rounded-lg" />
            <div className="grid gap-4 lg:grid-cols-[30%_1fr]">
                <div className="space-y-2">
                    <Skeleton height="5rem" className="!rounded-lg" />
                    <Skeleton height="5rem" className="!rounded-lg" />
                    <Skeleton height="5rem" className="!rounded-lg" />
                </div>
                <Skeleton height="20rem" className="!rounded-lg" />
            </div>
            <Skeleton height="3rem" className="!rounded-lg" />
        </div>
    );
}
