import { Biohazard, Plus } from 'lucide-react';
import AppButton from '@/components/ui/AppButton';

type InfectionHeaderProps = {
    onAdd: () => void;
};

export function InfectionHeader({ onAdd }: InfectionHeaderProps) {
    return (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400">
                    <Biohazard className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Infection Control</h2>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                        Track patient infections and isolation precautions
                    </p>
                </div>
            </div>
            <AppButton
                type="button"
                onClick={onAdd}
                className="!h-8 !px-3 !py-0 !text-xs font-semibold"
            >
                <Plus className="h-4 w-4" aria-hidden />
                Add Infection
            </AppButton>
        </div>
    );
}
