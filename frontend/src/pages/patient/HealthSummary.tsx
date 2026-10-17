/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - react-i18next children type conflicts with multiple JSX children in this file
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { usePatientId } from '../../hooks/usePatientId';
import { chronicDashboardAPI } from '../../services/healthMonitoringService';
import {
  FaHeartbeat,
  FaPills,
  FaUserShield,
  FaSyringe,
  FaFlask,
  FaStethoscope,
} from 'react-icons/fa';

interface HealthSummaryType {
  latestVitals?: Record<string, unknown>;
  recentMedications?: unknown[];
  conditions?: unknown[];
  allergies?: unknown[];
  immunizations?: unknown[];
  labHighlights?: unknown[];
  [key: string]: any;
}

function Box(p: { className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return React.createElement('div', { className: p.className, style: p.style }, p.children);
}

const HealthSummary: React.FC = () => {
  const patientId = usePatientId();
  const [summary, setSummary] = useState<HealthSummaryType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) {
      toast.error('Patient ID is required');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    chronicDashboardAPI
      .get(patientId)
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data ?? res.data;
        setSummary(data && typeof data === 'object' ? (data as HealthSummaryType) : null);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Failed to load health summary');
          setSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const formatDate = (d?: string) => (d ? format(new Date(d), 'MM/dd/yyyy') : '—');

  if (loading) {
    return (
      <div className="panel flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const latestVitals = summary?.latestVitals as Record<string, unknown> | undefined;
  const meds = (summary?.recentMedications as unknown[]) ?? [];
  const conditions = (summary?.conditions as unknown[]) ?? [];
  const allergies = (summary?.allergies as unknown[]) ?? [];
  const immunizations = (summary?.immunizations as unknown[]) ?? [];
  const labHighlights = (summary?.labHighlights as unknown[]) ?? [];

  return (
    <div>
      <div className="panel">
        <div className="mb-5">
          <ul className="flex items-center gap-2 text-sm">
            <li><Link to="/app/dashboard" className="text-primary hover:underline">Dashboard</Link></li>
            <li>/</li>
            <li className="text-gray-900 dark:text-white font-medium">Health Summary</li>
          </ul>
        </div>
        <div className="mb-6">
          <h3 className="text-xl font-semibold">Health Summary</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Overview of your latest vitals, medications, conditions, and more.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Latest Vitals */}
          <div className="panel border border-white-light dark:border-dark">
            <div>
              <Box className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FaHeartbeat className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold">Latest Vitals</h4>
                <Link to="/app/vitals" className="ml-auto text-sm text-primary hover:underline"><span>View all</span></Link>
              </Box>
              {latestVitals && (latestVitals.bloodPressureSystolic != null || latestVitals.heartRateBpm != null || latestVitals.temperatureFahrenheit != null) ? (
                <Box className="grid grid-cols-2 gap-3 text-sm">
                  {(latestVitals.bloodPressureSystolic != null || latestVitals.bloodPressureDiastolic != null) && (
                    <Box>
                      <span className="text-gray-500">Blood Pressure</span>
                      <p className="font-medium">{latestVitals.bloodPressureSystolic ?? '—'}/{latestVitals.bloodPressureDiastolic ?? '—'} mmHg</p>
                    </Box>
                  )}
                  {latestVitals.heartRateBpm != null && (
                    <Box>
                      <span className="text-gray-500">Heart Rate</span>
                      <p className="font-medium">{latestVitals.heartRateBpm} bpm</p>
                    </Box>
                  )}
                  {latestVitals.temperatureFahrenheit != null && (
                    <Box>
                      <span className="text-gray-500">Temperature</span>
                      <p className="font-medium">{latestVitals.temperatureFahrenheit} °F</p>
                    </Box>
                  )}
                  {latestVitals.weightLbs != null && (
                    <Box>
                      <span className="text-gray-500">Weight</span>
                      <p className="font-medium">{latestVitals.weightLbs} lbs</p>
                    </Box>
                  )}
                  {latestVitals.recordedAt && (
                    <Box className="col-span-2">
                      <span className="text-gray-500">Recorded</span>
                      <p className="font-medium">{formatDate(String(latestVitals.recordedAt))}</p>
                    </Box>
                  )}
                </Box>
              ) : (
                <p className="text-gray-500 text-sm">No vitals recorded yet. <Link to="/app/vitals" className="text-primary hover:underline"><span>Record vitals</span></Link></p>
              )}
            </div>
          </div>

          {/* Recent Medications */}
          <div className="panel border border-white-light dark:border-dark">
            <div>
              <Box className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FaPills className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold">Medications</h4>
                <Link to="/app/medications" className="ml-auto text-sm text-primary hover:underline"><span>View all</span></Link>
              </Box>
              {meds.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {meds.slice(0, 5).map((m: any, i: number) => (
                  <li key={m.id ?? m._id ?? i} className="flex justify-between gap-2">
                    <span className="font-medium truncate">{m.name ?? m.medicationName ?? '—'}</span>
                    <span className="text-gray-500 shrink-0">{m.dosage ?? ''}</span>
                  </li>
                ))}
                {meds.length > 5 && <li className="text-gray-500 text-xs">+{meds.length - 5} more</li>}
              </ul>
              ) : (
                <p className="text-gray-500 text-sm">No medications on file.</p>
              )}
            </div>
          </div>

          {/* Conditions */}
          <div className="panel border border-white-light dark:border-dark">
            <div>
              <Box className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FaStethoscope className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold">Conditions</h4>
                <Link to="/app/diagnoses" className="ml-auto text-sm text-primary hover:underline"><span>View all</span></Link>
              </Box>
              {conditions.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {conditions.slice(0, 5).map((c: any, i: number) => (
                  <li key={c.id ?? c._id ?? i}>{c.name ?? c.diagnosisName ?? '—'}</li>
                ))}
                {conditions.length > 5 && <li className="text-gray-500 text-xs">+{conditions.length - 5} more</li>}
              </ul>
              ) : (
                <p className="text-gray-500 text-sm">No conditions on file.</p>
              )}
            </div>
          </div>

          {/* Allergies */}
          <div className="panel border border-white-light dark:border-dark">
            <div>
              <Box className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FaUserShield className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold">Allergies</h4>
                <Link to="/app/allergies" className="ml-auto text-sm text-primary hover:underline"><span>View all</span></Link>
              </Box>
              {allergies.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {allergies.slice(0, 5).map((a: any, i: number) => (
                  <li key={a.id ?? a._id ?? i}>
                    <span className="font-medium">{a.allergen ?? a.allergyName ?? '—'}</span>
                    {a.severity && <span className="text-gray-500 ml-1">({a.severity})</span>}
                  </li>
                ))}
                {allergies.length > 5 && <li className="text-gray-500 text-xs">+{allergies.length - 5} more</li>}
              </ul>
              ) : (
                <p className="text-gray-500 text-sm">No allergies on file.</p>
              )}
            </div>
          </div>

          {/* Immunizations */}
          <div className="panel border border-white-light dark:border-dark">
            <div>
              <Box className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FaSyringe className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold">Immunizations</h4>
                <Link to="/app/immunizations" className="ml-auto text-sm text-primary hover:underline"><span>View all</span></Link>
              </Box>
              {immunizations.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {immunizations.slice(0, 5).map((imm: any, i: number) => (
                  <li key={imm.id ?? imm._id ?? i}>
                    <span className="font-medium">{imm.vaccineName ?? imm.vaccine ?? '—'}</span>
                    <span className="text-gray-500 ml-1">{formatDate(imm.date ?? imm.orderedDate)}</span>
                  </li>
                ))}
                {immunizations.length > 5 && <li className="text-gray-500 text-xs">+{immunizations.length - 5} more</li>}
              </ul>
              ) : (
                <p className="text-gray-500 text-sm">No immunizations on file.</p>
              )}
            </div>
          </div>

          {/* Lab highlights */}
          <div className="panel border border-white-light dark:border-dark">
            <div>
              <Box className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FaFlask className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold">Lab Results</h4>
                <Link to="/app/labs" className="ml-auto text-sm text-primary hover:underline"><span>View all</span></Link>
              </Box>
              {labHighlights.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {labHighlights.slice(0, 5).map((lab: any, i: number) => (
                  <li key={lab.id ?? lab._id ?? i}>
                    <span className="font-medium">{lab.name ?? lab.testName ?? '—'}</span>
                    <span className="text-gray-500 ml-1">{lab.value != null ? `${lab.value} ${lab.unit ?? ''}`.trim() : ''} {lab.date ? formatDate(lab.date) : ''}</span>
                  </li>
                ))}
                {labHighlights.length > 5 && <li className="text-gray-500 text-xs">+{labHighlights.length - 5} more</li>}
              </ul>
              ) : (
                <p className="text-gray-500 text-sm">No recent lab highlights.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthSummary;
