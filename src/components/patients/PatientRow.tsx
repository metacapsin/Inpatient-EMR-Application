import { Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { PatientListItem } from '../../services/patient.service';

interface PatientRowProps {
    patient: PatientListItem;
}

function initials(name: string): string {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function facesheetPatientId(patient: PatientListItem): string {
    const raw = patient.raw as Record<string, unknown>;
    const fromUnderscore = typeof raw?._id === 'string' ? raw._id.trim() : '';
    if (fromUnderscore) return fromUnderscore;
    return patient.id;
}

export function PatientTableRow({ patient }: PatientRowProps) {
    const navigate = useNavigate();
    const chartId = facesheetPatientId(patient);

    const goToFacesheet = () => {
        navigate(`/app/facesheet/${encodeURIComponent(chartId)}`);
    };

    const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
        if ((e.target as HTMLElement).closest('button')) return;
        goToFacesheet();
    };

    const handleView = (e: React.MouseEvent) => {
        e.stopPropagation();
        goToFacesheet();
    };

    return (
        <tr
            role="button"
            tabIndex={0}
            onClick={handleRowClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    goToFacesheet();
                }
            }}
            className="cursor-pointer transition-colors hover:bg-gray-50/80"
        >
            <td className="whitespace-nowrap px-4 py-3">
                <div className="flex items-center gap-3">
                    {patient.profilePicture ? (
                        <img
                            src={patient.profilePicture}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-gray-200"
                        />
                    ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary ring-1 ring-primary/20">
                            {initials(patient.name)}
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900">{patient.name}</p>
                        <p className="truncate text-xs text-gray-500">{patient.email || '—'}</p>
                    </div>
                </div>
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{patient.dob}</td>
            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{patient.gender}</td>
            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{patient.phone}</td>
            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{patient.createdDate}</td>
            <td className="whitespace-nowrap px-4 py-3">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        title="View"
                        onClick={handleView}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                    >
                        <Eye className="h-4 w-4" />
                    </button>
                </div>
            </td>
        </tr>
    );
}

export function PatientMobileCard({ patient }: PatientRowProps) {
    const navigate = useNavigate();
    const chartId = facesheetPatientId(patient);

    const goToFacesheet = () => {
        navigate(`/app/facesheet/${encodeURIComponent(chartId)}`);
    };

    const handleView = (e: React.MouseEvent) => {
        e.stopPropagation();
        goToFacesheet();
    };

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={goToFacesheet}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    goToFacesheet();
                }
            }}
            className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-gray-300"
        >
            <div className="flex items-start gap-3">
                {patient.profilePicture ? (
                    <img
                        src={patient.profilePicture}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-gray-200"
                    />
                ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-sm font-bold text-primary">
                        {initials(patient.name)}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{patient.name}</p>
                    <p className="text-xs text-gray-500">{patient.email || '—'}</p>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                        <span className="text-gray-400">DOB</span>
                        <span>{patient.dob}</span>
                        <span className="text-gray-400">Phone</span>
                        <span>{patient.phone}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-end">
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                title="View"
                                onClick={handleView}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                            >
                                <Eye className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
