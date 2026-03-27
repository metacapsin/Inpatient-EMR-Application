import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { FaHeartbeat, FaPlus } from 'react-icons/fa';
import IconSearch from '../../components/Icon/IconSearch';
import { usePatientId } from '../../hooks/usePatientId';
import { healthMetricsAPI } from '../../services/healthMonitoringService';

interface VitalsRecord {
  id?: string;
  _id?: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRateBpm?: number;
  temperatureFahrenheit?: number;
  weightLbs?: number;
  heightInches?: number;
  spo2Percent?: number;
  respiratoryRatePerMin?: number;
  bloodGlucose?: number;
  recordedAt?: string;
  [key: string]: any;
}

// Display type: support both Health Monitoring API shape and legacy field names
type DisplayVital = VitalsRecord & {
  recordedAtDisplay?: string;
  heightDisplay?: string;
};

const getLocalDateTime = (): string => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
};

const Vitals: React.FC = () => {
  const patientId = usePatientId();
  const [vitalsList, setVitalsList] = useState<DisplayVital[]>([]);
  const [latestVital, setLatestVital] = useState<DisplayVital | null>(null);
  const [filteredCardList, setFilteredCardList] = useState<DisplayVital[]>([]);
  const [paginatedCardList, setPaginatedCardList] = useState<DisplayVital[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(5);
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<Partial<VitalsRecord>>({
    bloodPressureSystolic: undefined,
    bloodPressureDiastolic: undefined,
    heartRateBpm: undefined,
    temperatureFahrenheit: undefined,
    weightLbs: undefined,
    heightInches: undefined,
    spo2Percent: undefined,
    respiratoryRatePerMin: undefined,
    bloodGlucose: undefined,
    recordedAt: getLocalDateTime(),
  });

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return format(date, 'MM/dd/yyyy');
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString?: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return format(date, 'MM/dd/yyyy hh:mm a');
    } catch {
      return dateString;
    }
  };

  const inchesToFeetInches = (inches?: number): string => {
    if (inches == null || inches === 0) return '—';
    const f = Math.floor(inches / 12);
    const i = Math.round(inches % 12);
    return `${f}'${i}"`;
  };

  /** Map GET /api/health/metrics/latest grouped response to DisplayVital for the Latest Vitals card */
  const mapLatestApiToDisplayVital = (data: Record<string, any>): DisplayVital => {
    const bp = data?.blood_pressure;
    const hr = data?.heart_rate;
    const temp = data?.temperature;
    const spo2 = data?.oxygen_saturation;
    const weight = data?.weight;
    const glucose = data?.glucose;
    const height = data?.height;
    const rr = data?.respiratory_rate;
    const recordedAt =
      temp?.recordedAt ?? bp?.recordedAt ?? hr?.recordedAt ?? weight?.recordedAt ?? spo2?.recordedAt ?? glucose?.recordedAt ?? '';
    const sys = bp?.valuePrimary ?? bp?.value_primary;
    const dia = bp?.valueSecondary ?? bp?.value_secondary;
    const n = (v: any) => (v != null ? Number(v) : undefined);
    return {
      bloodPressureSystolic: n(sys),
      bloodPressureDiastolic: n(dia),
      heartRateBpm: n(hr?.valuePrimary ?? hr?.value_primary),
      temperatureFahrenheit: n(temp?.valuePrimary ?? temp?.value_primary),
      spo2Percent: n(spo2?.valuePrimary ?? spo2?.value_primary),
      weightLbs: n(weight?.valuePrimary ?? weight?.value_primary),
      heightInches: n(height?.valuePrimary ?? height?.value_primary),
      bloodGlucose: n(glucose?.valuePrimary ?? glucose?.value_primary),
      respiratoryRatePerMin: n(rr?.valuePrimary ?? rr?.value_primary),
      recordedAt: recordedAt || undefined,
      recordedAtDisplay: recordedAt ? formatDateTime(recordedAt) : '',
      heightDisplay: (height?.valuePrimary ?? height?.value_primary) != null ? inchesToFeetInches(Number(height?.valuePrimary ?? height?.value_primary)) : '—',
    };
  };

  const normalize = (v: VitalsRecord & Record<string, unknown>): DisplayVital => {
    const recordedAt =
      (v.recordedAt as string) || (v.vitalsRecordedDate as string) || '';
    const sys = (v.bloodPressureSystolic ?? v.vitalsSystolicBloodPressure) as number | undefined;
    const dia = (v.bloodPressureDiastolic ?? v.vitalsDiastolicBloodPressure) as number | undefined;
    const hr = (v.heartRateBpm ?? v.vitalsHeartRate) as number | undefined;
    const temp = (v.temperatureFahrenheit ?? v.vitalsTemperature) as number | undefined;
    const weight = (v.weightLbs ?? v.vitalsWeightLbs) as number | undefined;
    const heightIn = (v.heightInches ?? (v.totalHeightInches as number)) as number | undefined;
    const spo2 = (v.spo2Percent ?? v.vitalsSpO2) as number | undefined;
    const rr = (v.respiratoryRatePerMin ?? v.vitalsRespiratoryRate) as number | undefined;
    const glucose = (v.bloodGlucose ?? v.vitalsBloodGlucose) as number | undefined;
    return {
      ...v,
      id: (v.id ?? v._id) as string,
      bloodPressureSystolic: sys,
      bloodPressureDiastolic: dia,
      heartRateBpm: hr,
      temperatureFahrenheit: temp,
      weightLbs: weight,
      heightInches: heightIn,
      spo2Percent: spo2,
      respiratoryRatePerMin: rr,
      bloodGlucose: glucose,
      recordedAt: recordedAt || undefined,
      recordedAtDisplay: recordedAt ? formatDateTime(recordedAt) : formatDate((v.vitalsRecordedDate as string) || ''),
      heightDisplay: heightIn != null ? inchesToFeetInches(heightIn) : (v.heightDisplay as string) || '—',
    };
  };

  const groupMetricsByRecordedAt = (rawList: any[]): VitalsRecord[] => {
    const grouped: Record<string, VitalsRecord> = {};

    rawList.forEach((item) => {
      const recordedAt = item.recordedAt || '';
      const metricType = item.metricType || item.metric_type || '';

      if (!grouped[recordedAt]) {
        grouped[recordedAt] = {
          id: item.id ?? item._id,
          _id: item._id ?? item.id,
          recordedAt,
        };
      }

      switch (metricType) {
        case 'blood_pressure':
          grouped[recordedAt].bloodPressureSystolic = item.valuePrimary ?? item.value_primary ?? item.systolic;
          grouped[recordedAt].bloodPressureDiastolic = item.valueSecondary ?? item.value_secondary ?? item.diastolic;
          break;
        case 'heart_rate':
          grouped[recordedAt].heartRateBpm = item.valuePrimary ?? item.value_primary ?? item.value;
          break;
        case 'temperature':
          grouped[recordedAt].temperatureFahrenheit = item.valuePrimary ?? item.value_primary ?? item.value;
          break;
        case 'oxygen_saturation':
          grouped[recordedAt].spo2Percent = item.valuePrimary ?? item.value_primary ?? item.value;
          break;
        case 'weight':
          grouped[recordedAt].weightLbs = item.valuePrimary ?? item.value_primary ?? item.value;
          break;
        case 'height':
          grouped[recordedAt].heightInches = item.valuePrimary ?? item.value_primary ?? item.value;
          break;
        case 'respiratory_rate':
          grouped[recordedAt].respiratoryRatePerMin = item.valuePrimary ?? item.value_primary ?? item.value;
          break;
        case 'glucose':
          grouped[recordedAt].bloodGlucose = item.valuePrimary ?? item.value;
          break;
        default:
          break;
      }
    });

    return Object.values(grouped).sort((a, b) => {
      const dateA = new Date(a.recordedAt || 0).getTime();
      const dateB = new Date(b.recordedAt || 0).getTime();
      return dateB - dateA;
    });
  };

  const fetchVitals = useCallback(async () => {
    if (!patientId) {
      toast.error('Patient ID is required');
      return;
    }
    setLoading(true);
    try {
      // Use getLatest API for the Latest Vitals card; use getByPatient for full list
      const [latestRes, listRes] = await Promise.all([
        healthMetricsAPI.getLatest({ patientId }).catch(() => ({ data: null })),
        healthMetricsAPI.getByPatient(patientId),
      ]);
      
      const rawList = (listRes.data as { data?: any[] })?.data ?? listRes.data;
      const groupedList = Array.isArray(rawList) ? groupMetricsByRecordedAt(rawList) : [];
      const list = groupedList.map(normalize);
      setVitalsList(list);
      setFilteredCardList(list);
      setPaginatedCardList(list);
      updatePaginatedList(list, 1);

      // Set latest vital from GET /api/health/metrics/latest if available, else from list
      let latest: DisplayVital | null = list.length > 0 ? list[0] : null;
      const latestPayload = (latestRes.data as { data?: any } | null)?.data ?? latestRes.data;
      if (latestPayload != null && typeof latestPayload === 'object' && !Array.isArray(latestPayload)) {
        // Grouped shape: { temperature: { valuePrimary }, blood_pressure: { valuePrimary, valueSecondary }, ... }
        const hasGroupedShape =
          'temperature' in latestPayload ||
          'blood_pressure' in latestPayload ||
          'heart_rate' in latestPayload ||
          'weight' in latestPayload;
        if (hasGroupedShape) {
          latest = mapLatestApiToDisplayVital(latestPayload);
        }
      } else if (latestPayload != null && Array.isArray(latestPayload) && latestPayload.length > 0) {
        const groupedLatest = groupMetricsByRecordedAt(latestPayload);
        if (groupedLatest.length > 0) {
          latest = normalize(groupedLatest[0]);
        }
      }
      setLatestVital(latest);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to fetch vitals';
      toast.error(msg);
      setVitalsList([]);
      setLatestVital(null);
      setFilteredCardList([]);
      setPaginatedCardList([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchVitals();
  }, [fetchVitals]);

  const updatePaginatedList = (data: DisplayVital[], page: number) => {
    const start = (page - 1) * rowsPerPage;
    setFilteredCardList(data.slice(start, start + rowsPerPage));
  };

  useEffect(() => {
    if (!searchText.trim()) {
      setPaginatedCardList([...vitalsList]);
      setCurrentPage(1);
      updatePaginatedList(vitalsList, 1);
    } else {
      const search = searchText.toLowerCase();
      const filtered = vitalsList.filter((item) => {
        const str = [
          item.recordedAtDisplay,
          item.recordedAt,
          item.heightDisplay,
          item.bloodPressureSystolic,
          item.bloodPressureDiastolic,
          item.heartRateBpm,
          item.temperatureFahrenheit,
          item.weightLbs,
          item.spo2Percent,
          item.respiratoryRatePerMin,
          item.bloodGlucose,
        ].join(' ');
        return str.toLowerCase().includes(search);
      });
      setPaginatedCardList(filtered);
      setCurrentPage(1);
      updatePaginatedList(filtered, 1);
    }
  }, [searchText, vitalsList]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const start = (page - 1) * rowsPerPage;
    const source = paginatedCardList.length ? paginatedCardList : vitalsList;
    setFilteredCardList(source.slice(start, start + rowsPerPage));
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      toast.error('Patient ID is required');
      return;
    }
    setSubmitting(true);
    try {
      const recordedAt = form.recordedAt || new Date().toISOString();
      const requests: Promise<any>[] = [];

      const hasValue = (val: any): boolean => val !== undefined && val !== null && val !== "";

      if (hasValue(form.bloodPressureSystolic) && hasValue(form.bloodPressureDiastolic)) {
        requests.push(healthMetricsAPI.add({
          patientId,
          metricType: "blood_pressure",
          valuePrimary: Number(form.bloodPressureSystolic),
          valueSecondary: Number(form.bloodPressureDiastolic),
          unit: "mmHg",
          recordedAt
        }));
      }

      const metrics = [
        { metricType: "heart_rate", value: form.heartRateBpm, unit: "bpm" },
        // { metricType: "respiratory_rate", value: form.respiratoryRatePerMin, unit: "breaths/min" },
        { metricType: "temperature", value: form.temperatureFahrenheit, unit: "F" },
        { metricType: "oxygen_saturation", value: form.spo2Percent, unit: "%" },
        { metricType: "weight", value: form.weightLbs, unit: "lbs" },
        // { metricType: "height", value: form.heightInches, unit: "inches" },
        { metricType: "glucose", value: form.bloodGlucose, unit: "mg/dL" },
      ];

      metrics.forEach(({ metricType, value, unit }) => {
        if (hasValue(value)) {
          requests.push(healthMetricsAPI.add({
            patientId,
            metricType,
            valuePrimary: Number(value),
            unit,
            recordedAt
          }));
        }
      });

      if (requests.length === 0) {
        toast.error('Please enter at least one vital measurement');
        setSubmitting(false);
        return;
      }

      await Promise.all(requests);

      toast.success('Vitals recorded successfully');
      setShowRecordForm(false);
      setForm({
        bloodPressureSystolic: undefined,
        bloodPressureDiastolic: undefined,
        heartRateBpm: undefined,
        temperatureFahrenheit: undefined,
        weightLbs: undefined,
        heightInches: undefined,
        spo2Percent: undefined,
        respiratoryRatePerMin: undefined,
        bloodGlucose: undefined,
        recordedAt: getLocalDateTime(),
      });
      fetchVitals();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to record vitals';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.ceil(paginatedCardList.length / rowsPerPage) || 1;

  return (
    <div>
      <div className="panel h-[calc(100vh-120px)] overflow-y-auto">
        <div className="mb-5">
          <ul className="flex items-center gap-2 text-sm">
            <li><a href="#" className="text-primary hover:underline">Patient</a></li>
            <li>/</li>
            <li className="text-gray-900 dark:text-white font-medium">Vitals</li>
          </ul>
        </div>

        <div className="mb-5">
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
    
    {/* Left Section */}
    <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1">
      
      <h3 className="text-xl font-semibold">
        Vitals
      </h3>

      {!showRecordForm && (
        <div className="relative w-full md:max-w-md">
          <input
            type="text"
            className="form-input pl-10 w-full"
            placeholder="Search by date or values"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <IconSearch className="w-4 h-4" />
          </span>
        </div>
      )}

    </div>

    {/* Right Section */}
    {!showRecordForm && (
      <div className="w-full md:w-auto">
        <button
          type="button"
          className="btn btn-primary w-full md:w-auto flex items-center justify-center gap-1"
          onClick={() => setShowRecordForm(true)}
        >
          <FaPlus className="w-4 h-4" />
          Record Vitals
        </button>
      </div>
    )}

  </div>
</div>

        {/* Latest vitals card */}
        {latestVital && !showRecordForm && (
          <div className="panel mb-5 border border-primary/20">
            <h5 className="text-base font-semibold mb-3 text-primary">Latest Vitals</h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Recorded</span>
                <p className="font-semibold">{latestVital.recordedAtDisplay || '—'}</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Blood Pressure</span>
                <p className="font-semibold">
                  {latestVital.bloodPressureSystolic != null || latestVital.bloodPressureDiastolic != null
                    ? `${latestVital.bloodPressureSystolic ?? '—'}/${latestVital.bloodPressureDiastolic ?? '—'} mmHg`
                    : '—'}
                </p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Heart Rate</span>
                <p className="font-semibold">{latestVital.heartRateBpm != null ? `${latestVital.heartRateBpm} bpm` : '—'}</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Temp / SpO₂</span>
                <p className="font-semibold">
                  {[latestVital.temperatureFahrenheit != null && `${latestVital.temperatureFahrenheit} °F`, latestVital.spo2Percent != null && `${latestVital.spo2Percent}%`].filter(Boolean).join(' / ') || '—'}
                </p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Weight</span>
                <p className="font-semibold">{latestVital.weightLbs != null ? `${latestVital.weightLbs} lbs` : '—'}</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Blood Glucose</span>
                <p className="font-semibold">{latestVital.bloodGlucose != null ? `${latestVital.bloodGlucose} mg/dL` : '—'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Record vitals form */}
        {showRecordForm && (
          <div className="panel border border-primary/20">
            <h5 className="text-base font-semibold mb-4">Record New Vitals</h5>
            <form onSubmit={handleRecordSubmit} className="space-y-6">
              {/* Date & Time */}
              <div>
                <label className="form-label">Date & Time</label>
                <input
                  type="datetime-local"
                  className="form-input max-w-xs"
                  value={form.recordedAt || ''}
                  onChange={(e) => setForm((f) => ({ ...f, recordedAt: e.target.value }))}
                />
              </div>

              {/* Blood Pressure Group */}
              <div className="panel p-4 bg-gray-50 dark:bg-gray-900/50">
                <h6 className="text-primary text-sm uppercase font-semibold mb-3">Blood Pressure</h6>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Systolic (mmHg)</label>
                    <input type="number" className="form-input" min={0} max={300} placeholder="e.g. 120"
                      value={form.bloodPressureSystolic ?? ''} onChange={(e) => setForm((f) => ({ ...f, bloodPressureSystolic: e.target.value ? Number(e.target.value) : undefined }))} />
                  </div>
                  <div>
                    <label className="form-label">Diastolic (mmHg)</label>
                    <input type="number" className="form-input" min={0} max={200} placeholder="e.g. 80"
                      value={form.bloodPressureDiastolic ?? ''} onChange={(e) => setForm((f) => ({ ...f, bloodPressureDiastolic: e.target.value ? Number(e.target.value) : undefined }))} />
                  </div>
                </div>
              </div>

              {/* Core Vitals Group */}
              <div className="panel p-4 bg-gray-50 dark:bg-gray-900/50">
                <h6 className="text-primary text-sm uppercase font-semibold mb-3">Core Vitals</h6>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="form-label">Heart Rate (bpm)</label>
                    <input type="number" className="form-input" min={0} max={300} placeholder="e.g. 72"
                      value={form.heartRateBpm ?? ''} onChange={(e) => setForm((f) => ({ ...f, heartRateBpm: e.target.value ? Number(e.target.value) : undefined }))} />
                  </div>
                  <div>
                    <label className="form-label">Temperature (°F)</label>
                    <input type="number" step="0.1" className="form-input" min={90} max={110} placeholder="e.g. 98.6"
                      value={form.temperatureFahrenheit ?? ''} onChange={(e) => setForm((f) => ({ ...f, temperatureFahrenheit: e.target.value ? Number(e.target.value) : undefined }))} />
                  </div>
                  <div>
                    <label className="form-label">SpO₂ (%)</label>
                    <input type="number" className="form-input" min={0} max={100} placeholder="e.g. 98"
                      value={form.spo2Percent ?? ''} onChange={(e) => setForm((f) => ({ ...f, spo2Percent: e.target.value ? Number(e.target.value) : undefined }))} />
                  </div>
                  <div>
                    <label className="form-label">Blood Glucose (mg/dL)</label>
                    <input type="number" className="form-input" min={0} max={600} placeholder="e.g. 100"
                      value={form.bloodGlucose ?? ''} onChange={(e) => setForm((f) => ({ ...f, bloodGlucose: e.target.value ? Number(e.target.value) : undefined }))} />
                  </div>
                </div>
              </div>

              {/* Body Measurements Group */}
              <div className="panel p-4 bg-gray-50 dark:bg-gray-900/50">
                <h6 className="text-primary text-sm uppercase font-semibold mb-3">Body Measurements</h6>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Weight (lbs)</label>
                    <input type="number" step="0.1" className="form-input" min={0} placeholder="e.g. 150"
                      value={form.weightLbs ?? ''} onChange={(e) => setForm((f) => ({ ...f, weightLbs: e.target.value ? Number(e.target.value) : undefined }))} />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2 justify-end">
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Vitals'}
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowRecordForm(false)} disabled={submitting}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* History - hidden when form is open */}
        {!showRecordForm && (
          <div>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredCardList.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {vitalsList.length === 0 ? 'No vitals recorded yet.' : 'No matching records.'}
              </div>
            ) : (
              <>
                {filteredCardList.map((vital) => (
                  <div key={String(vital.id ?? vital._id ?? vital.recordedAt ?? '')} className="panel mb-3 border-0">
  
                  {/* Header */}
                  <div className="mb-4 pb-3 border-b border-white-light dark:border-dark">
                    <h5 className="text-base font-semibold">
                      VITALS RECORD — {vital.recordedAtDisplay || '—'}
                    </h5>
                  </div>
                
                  {/* Content */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Left */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
                      <h6 className="text-primary text-sm uppercase font-semibold mb-3">
                        Blood Pressure & Heart
                      </h6>
                
                      <div className="mb-2">
                        <span className="text-gray-600 text-sm">BP: </span>
                        <span className="font-semibold">
                          {vital.bloodPressureSystolic != null || vital.bloodPressureDiastolic != null
                            ? `${vital.bloodPressureSystolic ?? '—'}/${vital.bloodPressureDiastolic ?? '—'} mmHg`
                            : '—'}
                        </span>
                      </div>
                
                      <div>
                        <span className="text-gray-600 text-sm">Heart Rate: </span>
                        <span className="font-semibold">
                          {vital.heartRateBpm != null ? `${vital.heartRateBpm} bpm` : '—'}
                        </span>
                      </div>
                    </div>
                
                    {/* Right */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
                      <h6 className="text-primary text-sm uppercase font-semibold mb-3">
                        Measurements
                      </h6>
                
                      <div className="mb-2">
                        <span className="text-gray-600 text-sm">Temp: </span>
                        <span className="font-semibold">
                          {vital.temperatureFahrenheit != null ? `${vital.temperatureFahrenheit} °F` : '—'}
                        </span>
                      </div>
                
                      <div className="mb-2">
                        <span className="text-gray-600 text-sm">SpO₂: </span>
                        <span className="font-semibold">
                          {vital.spo2Percent != null ? `${vital.spo2Percent}%` : '—'}
                        </span>
                      </div>
                
                      <div className="mb-2">
                        <span className="text-gray-600 text-sm">Weight: </span>
                        <span className="font-semibold">
                          {vital.weightLbs != null ? `${vital.weightLbs} lbs` : '—'}
                        </span>
                      </div>
                
                      <div>
                        <span className="text-gray-600 text-sm">Blood Glucose: </span>
                        <span className="font-semibold">
                          {vital.bloodGlucose != null ? `${vital.bloodGlucose} mg/dL` : '—'}
                        </span>
                      </div>
                    </div>
                
                  </div>
                </div>
                ))}
                {paginatedCardList.length > rowsPerPage && (
                  <div className="flex justify-center items-center gap-2 mt-4">
                    <button className="btn btn-outline-primary" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>Previous</button>
                    <span className="text-sm px-4">Page {currentPage} of {totalPages}</span>
                    <button className="btn btn-outline-primary" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages}>Next</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Vitals;
