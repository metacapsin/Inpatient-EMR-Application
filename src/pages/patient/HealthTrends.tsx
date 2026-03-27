import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { format, subDays, subMonths } from 'date-fns';
import { FaChartLine, FaHeartbeat, FaWeight, FaThermometerHalf, FaTint } from 'react-icons/fa';
import { usePatientId } from '../../hooks/usePatientId';
import { healthMetricsAPI } from '../../services/healthMonitoringService';

interface TrendData {
  date: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRateBpm?: number;
  weightLbs?: number;
  temperatureFahrenheit?: number;
  spo2Percent?: number;
  bloodGlucose?: number;
}

type TimeRange = '7d' | '30d' | '90d' | '6m' | '1y';
type MetricType = 'bloodPressure' | 'heartRate' | 'weight' | 'temperature' | 'spo2' | 'glucose';

const timeRanges: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
];

const metricTypes: { value: MetricType; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'bloodPressure', label: 'Blood Pressure', icon: FaHeartbeat, color: '#ef4444' },
  { value: 'heartRate', label: 'Heart Rate', icon: FaHeartbeat, color: '#f97316' },
  { value: 'weight', label: 'Weight', icon: FaWeight, color: '#3b82f6' },
  { value: 'temperature', label: 'Temperature', icon: FaThermometerHalf, color: '#eab308' },
  { value: 'spo2', label: 'SpO2', icon: FaTint, color: '#22c55e' },
  { value: 'glucose', label: 'Blood Glucose', icon: FaTint, color: '#8b5cf6' },
];

const HealthTrends: React.FC = () => {
  const patientId = usePatientId();
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('bloodPressure');
  const [stats, setStats] = useState<{
    latest?: number;
    average?: number;
    min?: number;
    max?: number;
    change?: number;
  }>({});

  const getDateRange = (range: TimeRange): { startDate: Date; endDate: Date } => {
    const endDate = new Date();
    let startDate: Date;
    switch (range) {
      case '7d':
        startDate = subDays(endDate, 7);
        break;
      case '30d':
        startDate = subDays(endDate, 30);
        break;
      case '90d':
        startDate = subDays(endDate, 90);
        break;
      case '6m':
        startDate = subMonths(endDate, 6);
        break;
      case '1y':
        startDate = subMonths(endDate, 12);
        break;
      default:
        startDate = subDays(endDate, 30);
    }
    return { startDate, endDate };
  };

  const fetchTrends = useCallback(async () => {
    if (!patientId) {
      toast.error('Patient ID is required');
      return;
    }
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(timeRange);
      const metricMap: Record<MetricType, string> = {
        bloodPressure: 'blood_pressure',
        heartRate: 'heart_rate',
        weight: 'weight',
        temperature: 'temperature',
        spo2: 'oxygen_saturation',
        glucose: 'glucose'
      };
      const res = await healthMetricsAPI.getTrend({
        patientId,
        // startDate: startDate.toISOString(),
        // endDate: endDate.toISOString(),
        period: 30,
        metricType: metricMap[selectedMetric],
      });
      // const raw = (res.data as { data?: TrendData[] })?.data ?? res.data;
      // const arr = Array.isArray(raw) ? raw : [];
      const raw = res.data?.data?.trends ?? [];
const arr = Array.isArray(raw) ? raw : [];
const mapped: TrendData[] = arr.map((item: any) => ({
  date: item.date,

  bloodPressureSystolic:
    selectedMetric === "bloodPressure" ? item.avgPrimary : undefined,

  bloodPressureDiastolic:
    selectedMetric === "bloodPressure" ? item.avgSecondary : undefined,

  heartRateBpm:
    selectedMetric === "heartRate" ? item.avgPrimary : undefined,

  weightLbs:
    selectedMetric === "weight" ? item.avgPrimary : undefined,

  temperatureFahrenheit:
    selectedMetric === "temperature" ? item.avgPrimary : undefined,

  spo2Percent:
    selectedMetric === "spo2" ? item.avgPrimary : undefined,

  bloodGlucose:
    selectedMetric === "glucose" ? item.avgPrimary : undefined,
}));
setTrendData(mapped);
calculateStats(mapped);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch trend data');
      setTrendData([]);
      setStats({});
    } finally {
      setLoading(false);
    }
  }, [patientId, timeRange, selectedMetric]);

  const calculateStats = (data: TrendData[]) => {
    if (data.length === 0) {
      setStats({});
      return;
    }

    const getValue = (item: TrendData): number | undefined => {
      switch (selectedMetric) {
        case 'bloodPressure':
          return item.bloodPressureSystolic;
        case 'heartRate':
          return item.heartRateBpm;
        case 'weight':
          return item.weightLbs;
        case 'temperature':
          return item.temperatureFahrenheit;
        case 'spo2':
          return item.spo2Percent;
        case 'glucose':
          return item.bloodGlucose;
        default:
          return undefined;
      }
    };

    const values = data.map(getValue).filter((v): v is number => v != null);
    if (values.length === 0) {
      setStats({});
      return;
    }

    const latest = values[values.length - 1];
    const first = values[0];
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const change = values.length > 1 ? ((latest - first) / first) * 100 : 0;

    setStats({
      latest: Math.round(latest * 10) / 10,
      average: Math.round(average * 10) / 10,
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      change: Math.round(change * 10) / 10,
    });
  };

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  const getMetricUnit = (metric: MetricType): string => {
    switch (metric) {
      case 'bloodPressure':
        return 'mmHg';
      case 'heartRate':
        return 'bpm';
      case 'weight':
        return 'lbs';
      case 'temperature':
        return '°F';
      case 'spo2':
        return '%';
      case 'glucose':
        return 'mg/dL';
      default:
        return '';
    }
  };

  const getMetricConfig = () => {
    return metricTypes.find((m) => m.value === selectedMetric) || metricTypes[0];
  };

  const renderSimpleChart = () => {
    if (trendData.length === 0) return null;

    const getValue = (item: TrendData): number => {
      switch (selectedMetric) {
        case 'bloodPressure':
          return item.bloodPressureSystolic || 0;
        case 'heartRate':
          return item.heartRateBpm || 0;
        case 'weight':
          return item.weightLbs || 0;
        case 'temperature':
          return item.temperatureFahrenheit || 0;
        case 'spo2':
          return item.spo2Percent || 0;
        case 'glucose':
          return item.bloodGlucose || 0;
        default:
          return 0;
      }
    };

    const values = trendData.map(getValue);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;
    const metricConfig = getMetricConfig();

    return (
      <div className="mt-1 flex-1 flex flex-col">
        <div className="flex items-end justify-between flex-1 gap-0.5 px-1">
          {trendData.map((item, index) => {
            const value = getValue(item);
            const heightPct = ((value - minValue) / range) * 100;
            const height = Math.max(heightPct, 6);
            return (
              <div
                key={index}
                className="flex-1 flex flex-col items-center justify-end group"
              >
                <div className="relative w-full">
                  <div
                    className="w-full rounded-t-sm transition-all duration-300 hover:opacity-80"
                    style={{
                      height: `${height}%`,
                      minHeight: '4px',
                      backgroundColor: metricConfig.color,
                    }}
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                    {value} {getMetricUnit(selectedMetric)}
                    <br />
                    {format(new Date(item.date), 'MMM dd')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-0.5 px-1 text-[10px] text-gray-500 flex-shrink-0">
          {trendData.length > 0 && (
            <>
              <span>{format(new Date(trendData[0].date), 'MMM dd')}</span>
              {trendData.length > 1 && (
                <span>{format(new Date(trendData[trendData.length - 1].date), 'MMM dd')}</span>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const metricConfig = getMetricConfig();
  const Icon = metricConfig.icon;

  return (
    <div className="h-full flex flex-col">
      <div className="panel p-3 flex flex-col md:overflow-visible overflow-auto">
        <div className="mb-1 flex-shrink-0">
          <ul className="flex items-center gap-1.5 text-xs">
            <li><a href="#" className="text-primary hover:underline">Patient</a></li>
            <li>/</li>
            <li className="text-gray-900 dark:text-white font-medium">Health Trends</li>
          </ul>
        </div>

        <div className="mb-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="p-1.5 rounded-md bg-primary/10">
              <FaChartLine className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-base font-semibold">Health Trends</h3>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-xs">Track your health metrics over time.</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-2 flex-shrink-0">
          <div className="flex-1 min-w-[160px]">
            <label className="form-label text-xs mb-0.5">Metric</label>
            <div className="flex flex-wrap gap-1">
              {metricTypes.map((metric) => {
                const MetricIcon = metric.icon;
                return (
                  <button
                    key={metric.value}
                    className={`btn btn-sm py-1 px-2 text-xs ${selectedMetric === metric.value ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setSelectedMetric(metric.value)}
                  >
                    <MetricIcon className="w-2.5 h-2.5 mr-0.5" />
                    {metric.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="form-label text-xs mb-0.5">Time Range</label>
            <div className="flex gap-1">
              {timeRanges.map((range) => (
                <button
                  key={range.value}
                  className={`btn btn-sm py-1 px-2 text-xs ${timeRange === range.value ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setTimeRange(range.value)}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5 mb-2 flex-shrink-0">
          <div className="panel p-1.5 text-center" style={{ borderTopColor: metricConfig.color, borderTopWidth: '2px' }}>
            <p className="text-base font-bold" style={{ color: metricConfig.color }}>{stats.latest ?? '—'}</p>
            <p className="text-gray-500 text-[10px]">Latest</p>
          </div>
          <div className="panel p-1.5 text-center">
            <p className="text-base font-bold">{stats.average ?? '—'}</p>
            <p className="text-gray-500 text-[10px]">Average</p>
          </div>
          <div className="panel p-1.5 text-center">
            <p className="text-base font-bold text-green-500">{stats.min ?? '—'}</p>
            <p className="text-gray-500 text-[10px]">Min</p>
          </div>
          <div className="panel p-1.5 text-center">
            <p className="text-base font-bold text-red-500">{stats.max ?? '—'}</p>
            <p className="text-gray-500 text-[10px]">Max</p>
          </div>
          <div className="panel p-1.5 text-center">
            <p className={`text-base font-bold ${(stats.change ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {stats.change != null ? `${stats.change >= 0 ? '+' : ''}${stats.change}%` : '—'}
            </p>
            <p className="text-gray-500 text-[10px]">Change</p>
          </div>
        </div>

        <div className="panel p-2 flex flex-col">
          <div className="flex items-center gap-1.5 mb-1.5 flex-shrink-0">
            <Icon className="w-4 h-4" style={{ color: metricConfig.color }} />
            <h4 className="font-semibold text-sm">{metricConfig.label} Trend</h4>
            <span className="text-gray-500 text-xs ml-auto">{getMetricUnit(selectedMetric)}</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-4 gap-2 text-gray-500 text-sm">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span>Loading...</span>
            </div>
          ) : trendData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 gap-1 text-gray-500 text-sm">
              <FaChartLine className="w-8 h-8 text-gray-300" />
              <p>No data for this period.</p>
            </div>
          ) : (
            <div className="h-[220px] flex flex-col">{renderSimpleChart()}</div>
          )}
        </div>

        {trendData.length > 0 && (
          <div className="mt-2 flex-shrink-0">
            <h4 className="font-semibold mb-1 text-xs">Recent Readings</h4>
            <div className="overflow-x-auto md:overflow-y-auto overflow-y-visible rounded border border-white-light dark:border-dark md:max-h-[160px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/50 z-[1]">
                  <tr className="border-b border-white-light dark:border-dark">
                    <th className="text-left py-1 px-2 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Date</th>
                    <th className="text-right py-1 px-2 font-semibold text-gray-700 dark:text-gray-300">
                      {selectedMetric === 'bloodPressure' ? 'Systolic' : 'Value'}
                    </th>
                    {selectedMetric === 'bloodPressure' && (
                      <th className="text-right py-1 px-2 font-semibold text-gray-700 dark:text-gray-300 w-[80px]">Diastolic</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {trendData.slice(-5).reverse().map((item, index) => (
                    <tr
                      key={index}
                      className={`border-b border-white-light dark:border-dark last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                        index % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-gray-50/50 dark:bg-gray-800/30'
                      }`}
                    >
                      <td className="py-0.5 px-2 align-middle text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {format(new Date(item.date), 'MMM dd h:mm a')}
                      </td>
                      <td className="py-0.5 px-2 text-right font-medium tabular-nums whitespace-nowrap" style={{ color: metricConfig.color }}>
                        {selectedMetric === 'bloodPressure' && item.bloodPressureSystolic}
                        {selectedMetric === 'heartRate' && item.heartRateBpm}
                        {selectedMetric === 'weight' && item.weightLbs}
                        {selectedMetric === 'temperature' && item.temperatureFahrenheit}
                        {selectedMetric === 'spo2' && item.spo2Percent}
                        {selectedMetric === 'glucose' && item.bloodGlucose}
                        {' '}{getMetricUnit(selectedMetric)}
                      </td>
                      {selectedMetric === 'bloodPressure' && (
                        <td className="py-0.5 px-2 text-right tabular-nums text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {item.bloodPressureDiastolic} mmHg
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HealthTrends;
