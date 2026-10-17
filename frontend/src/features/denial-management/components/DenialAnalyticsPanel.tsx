import {
    ArcElement,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import type { DenialAnalytics } from '../types/denial.types';

ChartJS.register(
    ArcElement,
    BarElement,
    CategoryScale,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
    Legend
);

type Props = {
    analytics: DenialAnalytics;
};

function formatCurrency(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function DenialAnalyticsPanel({ analytics }: Props) {
    const categoryChart = {
        labels: analytics.denialByCategory.map((c) => c.category),
        datasets: [
            {
                data: analytics.denialByCategory.map((c) => c.count),
                backgroundColor: [
                    '#3b82f6',
                    '#8b5cf6',
                    '#10b981',
                    '#f59e0b',
                    '#ef4444',
                    '#6366f1',
                ],
                borderWidth: 0,
            },
        ],
    };

    const payerChart = {
        labels: analytics.denialRateByPayer.map((p) => p.payer),
        datasets: [
            {
                label: 'Denial rate %',
                data: analytics.denialRateByPayer.map((p) => p.ratePercent),
                backgroundColor: '#0ea5e9',
                borderRadius: 4,
            },
        ],
    };

    const trendChart = {
        labels: analytics.monthlyDenialTrend.map((m) => m.month),
        datasets: [
            {
                label: 'Denial count',
                data: analytics.monthlyDenialTrend.map((m) => m.count),
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: true,
                tension: 0.3,
            },
        ],
    };

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Analytics</h3>
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-lg border border-emr-border/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#161412]/80">
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Denial by Category
                    </h4>
                    <div className="mx-auto h-[200px] max-w-[220px]">
                        <Doughnut
                            data={categoryChart}
                            options={{
                                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
                                maintainAspectRatio: false,
                            }}
                        />
                    </div>
                </div>

                <div className="rounded-lg border border-emr-border/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#161412]/80 lg:col-span-1 xl:col-span-1">
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Denial Rate by Payer
                    </h4>
                    <div className="h-[220px]">
                        <Bar
                            data={payerChart}
                            options={{
                                indexAxis: 'y',
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: {
                                    x: { ticks: { callback: (v) => `${v}%` } },
                                },
                            }}
                        />
                    </div>
                </div>

                <div className="rounded-lg border border-emr-border/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#161412]/80">
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Appeal Overturn Rate
                    </h4>
                    <div className="flex flex-col items-center justify-center py-6">
                        <span className="text-4xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                            {analytics.appealOverturnRatePercent}%
                        </span>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Overturn rate (mock)</p>
                    </div>
                </div>

                <div className="rounded-lg border border-emr-border/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#161412]/80 lg:col-span-2">
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Top 10 Denial Codes
                    </h4>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                                <tr>
                                    <th className="pb-2 font-medium">Code</th>
                                    <th className="pb-2 font-medium text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.topDenialCodes.map((row) => (
                                    <tr key={row.code} className="border-t border-gray-100 dark:border-gray-800">
                                        <td className="py-1.5 font-mono text-xs">{row.code}</td>
                                        <td className="py-1.5 text-right text-xs tabular-nums">
                                            {formatCurrency(row.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="rounded-lg border border-emr-border/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#161412]/80 lg:col-span-2 xl:col-span-3">
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Monthly Denial Trend
                    </h4>
                    <div className="h-[220px]">
                        <Line
                            data={trendChart}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
