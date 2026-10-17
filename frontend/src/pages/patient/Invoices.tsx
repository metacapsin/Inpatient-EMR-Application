import React from 'react';
import { Link } from 'react-router-dom';
import usePatientId from '../../hooks/usePatientId';
import { useFacesheetChartLayout } from '../../hooks/useFacesheetChartLayout';
import { billingDenialsPath } from '../../features/denial-management/services/denial.service';

const MOCK_INVOICES = [
    { claimNumber: 'CLM-2025-88421', serviceDate: '2025-03-12', amount: 42850, status: 'Denied' },
    { claimNumber: 'CLM-2025-88302', serviceDate: '2025-03-28', amount: 67200, status: 'Partial' },
    { claimNumber: 'CLM-2025-88110', serviceDate: '2025-02-15', amount: 18900, status: 'Paid' },
];

const Invoices: React.FC = () => {
    const patientId = usePatientId();
    const { moduleRootClass } = useFacesheetChartLayout();

    return (
        <div className={`${moduleRootClass} flex min-h-0 flex-1 flex-col overflow-hidden`}>
            <div className="shrink-0 border-b border-emr-border/80 px-4 py-3 dark:border-white/10">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Invoices</h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    Claim invoices and links to denial management
                </p>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
                <div className="mb-3 flex flex-wrap gap-2">
                    <Link
                        to={billingDenialsPath()}
                        className="inline-flex h-8 items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-[#1a1816] dark:text-gray-200"
                    >
                        Open Denial Management
                    </Link>
                </div>
                <div className="overflow-x-auto rounded-lg border border-emr-border/90 bg-white shadow-sm dark:border-white/10 dark:bg-[#161412]/80">
                    <table className="w-full min-w-[480px] text-left text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900/60 dark:text-gray-400">
                            <tr>
                                <th className="p-2 font-medium">Claim #</th>
                                <th className="p-2 font-medium">Service date</th>
                                <th className="p-2 font-medium">Amount</th>
                                <th className="p-2 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MOCK_INVOICES.map((inv) => (
                                <tr key={inv.claimNumber} className="border-t border-gray-100 dark:border-gray-800">
                                    <td className="p-2 font-mono text-xs">
                                        <Link
                                            to={billingDenialsPath()}
                                            className="text-primary hover:underline"
                                        >
                                            {inv.claimNumber}
                                        </Link>
                                    </td>
                                    <td className="p-2 text-xs">{inv.serviceDate}</td>
                                    <td className="p-2 text-xs tabular-nums">
                                        {new Intl.NumberFormat('en-US', {
                                            style: 'currency',
                                            currency: 'USD',
                                            maximumFractionDigits: 0,
                                        }).format(inv.amount)}
                                    </td>
                                    <td className="p-2 text-xs">{inv.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {patientId ? (
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                        Patient context: {patientId} (mock invoice list)
                    </p>
                ) : null}
            </div>
        </div>
    );
};

export default Invoices;
