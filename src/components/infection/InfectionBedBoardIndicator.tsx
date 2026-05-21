import { useInfectionControl } from '../../contexts/InfectionControlContext';
import { patientRequiresIsolation } from '../../lib/infectionControlUtils';
import { InfectionIsolationBadge } from './InfectionBadge';

type Props = {
    patientId: string | null | undefined;
    size?: 'sm' | 'md';
};

export function InfectionBedBoardIndicator({ patientId, size = 'sm' }: Props) {
    const { records } = useInfectionControl();
    if (!patientId?.trim()) return null;
    if (!patientRequiresIsolation(records, patientId)) return null;
    return <InfectionIsolationBadge size={size} />;
}
