import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { FaBell, FaExclamationTriangle, FaCheckCircle, FaInfoCircle, FaTimesCircle } from 'react-icons/fa';
import IconSearch from '../../components/Icon/IconSearch';
import { usePatientId } from '../../hooks/usePatientId';
import { healthAlertsAPI } from '../../services/healthMonitoringService';

type AlertStatus = 'new' | 'acknowledged' | 'resolved';

interface HealthAlert {
  id?: string;
  _id?: string;
  type?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  title?: string;
  message?: string;
  status?: boolean;
  alertStatus?: AlertStatus;
  triggeredAt?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  metricType?: string;
  metricValue?: number;
  threshold?: number;
  createdAt?: string;
}

type FilterType = 'all' | 'new' | 'acknowledged' | 'resolved';

const HealthAlerts: React.FC = () => {
  const patientId = usePatientId();
  const [alertsList, setAlertsList] = useState<HealthAlert[]>([]);
  const [filteredList, setFilteredList] = useState<HealthAlert[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy hh:mm a');
    } catch {
      return dateString;
    }
  };

  const fetchAlerts = useCallback(async () => {
    if (!patientId) {
      toast.error('Patient ID is required');
      return;
    }
    setLoading(true);
    try {
      const res = await healthAlertsAPI.getByPatient(patientId);
      const raw = (res.data as { data?: HealthAlert[] })?.data ?? res.data;
      const arr = Array.isArray(raw) ? raw : [];
      setAlertsList(arr);
      setFilteredList(arr);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch health alerts');
      setAlertsList([]);
      setFilteredList([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    let result = alertsList;

    if (filter !== 'all') {
      result = result.filter((alert) => alert.alertStatus === filter);
    }

    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      result = result.filter(
        (alert) =>
          alert.title?.toLowerCase().includes(search) ||
          alert.message?.toLowerCase().includes(search) ||
          alert.type?.toLowerCase().includes(search) ||
          alert.metricType?.toLowerCase().includes(search)
      );
    }

    setFilteredList(result);
  }, [searchText, alertsList, filter]);

  const handleAcknowledge = async (alertId: string) => {
    setActionLoading(alertId);
    try {
      await healthAlertsAPI.acknowledge(alertId);
      toast.success('Alert acknowledged');
      fetchAlerts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to acknowledge alert');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async (alertId: string) => {
    setActionLoading(alertId);
    try {
      await healthAlertsAPI.resolve(alertId);
      toast.success('Alert resolved');
      fetchAlerts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to resolve alert');
    } finally {
      setActionLoading(null);
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
    }
  };

  const getSeverityIcon = (severity?: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return <FaTimesCircle className="text-red-500" />;
      case 'high':
        return <FaExclamationTriangle className="text-orange-500" />;
      case 'medium':
        return <FaInfoCircle className="text-yellow-500" />;
      case 'low':
        return <FaInfoCircle className="text-blue-500" />;
      default:
        return <FaBell className="text-gray-500" />;
    }
  };

  const getStatusBadge = (alertStatus?: AlertStatus) => {
    switch (alertStatus) {
      case 'new':
        return (
          <span className="badge bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded-full text-xs">
            Active
          </span>
        );
      case 'acknowledged':
        return (
          <span className="badge bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-1 rounded-full text-xs">
            Acknowledged
          </span>
        );
      case 'resolved':
        return (
          <span className="badge bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full text-xs">
            Resolved
          </span>
        );
      default:
        return null;
    }
  };

  const activeCount = alertsList.filter((a) => a.alertStatus === 'new').length;
  const acknowledgedCount = alertsList.filter((a) => a.alertStatus === 'acknowledged').length;
  const resolvedCount = alertsList.filter((a) => a.alertStatus === 'resolved').length;

  return (
    <div>
      <div className="panel">
        <div className="mb-5">
          <ul className="flex items-center gap-2 text-sm">
            <li>
              <a href="#" className="text-primary hover:underline">Patient</a>
            </li>
            <li>/</li>
            <li className="text-gray-900 dark:text-white font-medium">Health Alerts</li>
          </ul>
        </div>

        <div className="mb-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FaBell className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Health Alerts</h3>
                {activeCount > 0 && (
                  <span className="badge bg-red-500 text-white px-2 py-1 rounded-full text-xs">
                    {activeCount} Active
                  </span>
                )}
              </div>
              <div className="relative max-w-md">
                <input
                  type="text"
                  className="form-input pl-10"
                  placeholder="Search alerts..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <IconSearch className="w-4 h-4" />
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <button
            className={`panel p-4 text-center cursor-pointer transition-all ${filter === 'all' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setFilter('all')}
          >
            <p className="text-2xl font-bold">{alertsList.length}</p>
            <p className="text-gray-500 text-sm">All Alerts</p>
          </button>
          <button
            className={`panel p-4 text-center cursor-pointer transition-all ${filter === 'new' ? 'ring-2 ring-red-500' : ''}`}
            onClick={() => setFilter('new')}
          >
            <p className="text-2xl font-bold text-red-500">{activeCount}</p>
            <p className="text-gray-500 text-sm">Active</p>
          </button>
          <button
            className={`panel p-4 text-center cursor-pointer transition-all ${filter === 'acknowledged' ? 'ring-2 ring-yellow-500' : ''}`}
            onClick={() => setFilter('acknowledged')}
          >
            <p className="text-2xl font-bold text-yellow-500">{acknowledgedCount}</p>
            <p className="text-gray-500 text-sm">Acknowledged</p>
          </button>
          <button
            className={`panel p-4 text-center cursor-pointer transition-all ${filter === 'resolved' ? 'ring-2 ring-green-500' : ''}`}
            onClick={() => setFilter('resolved')}
          >
            <p className="text-2xl font-bold text-green-500">{resolvedCount}</p>
            <p className="text-gray-500 text-sm">Resolved</p>
          </button>
        </div>

        <div>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span>Loading alerts...</span>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-500 rounded-xl border border-dashed border-white-light dark:border-dark">
              <FaCheckCircle className="w-12 h-12 text-green-300" />
              <p className="font-medium text-gray-600 dark:text-gray-400">
                {alertsList.length === 0 ? 'No health alerts. You\'re doing great!' : 'No matching alerts.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredList.map((alert) => {
                const alertId = alert.id ?? alert._id ?? '';
                return (
                  <div
                    key={alertId}
                    className={`panel border-l-4 ${getSeverityColor(alert.severity)} shadow-equal hover:shadow-equal-lg transition-shadow duration-200`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-1">{getSeverityIcon(alert.severity)}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-semibold">{alert.title || alert.type || 'Health Alert'}</h5>
                            {getStatusBadge(alert.alertStatus)}
                            <span className={`badge text-xs px-2 py-0.5 rounded ${getSeverityColor(alert.severity)}`}>
                              {alert.severity || 'Unknown'}
                            </span>
                          </div>
                          <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                            {alert.message}
                          </p>
                          {alert.metricType && (
                            <p className="text-sm">
                              <span className="text-gray-500">Metric:</span>{' '}
                              <span className="font-medium">{alert.metricType}</span>
                              {alert.metricValue != null && (
                                <span className="text-red-500 font-semibold ml-2">
                                  Value: {alert.metricValue}
                                </span>
                              )}
                              {alert.threshold != null && (
                                <span className="text-gray-500 ml-2">(Threshold: {alert.threshold})</span>
                              )}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                            {alert.triggeredAt && (
                              <span>Triggered: {formatDate(alert.triggeredAt)}</span>
                            )}
                            {alert.acknowledgedAt && (
                              <span>Acknowledged: {formatDate(alert.acknowledgedAt)}</span>
                            )}
                            {alert.resolvedAt && (
                              <span>Resolved: {formatDate(alert.resolvedAt)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                        {alert.alertStatus === 'new' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-warning w-full sm:w-auto"
                            onClick={() => handleAcknowledge(alertId)}
                            disabled={actionLoading === alertId}
                          >
                            {actionLoading === alertId ? '...' : 'Acknowledge'}
                          </button>
                        )}
                        {(alert.alertStatus === 'new' || alert.alertStatus === 'acknowledged') && (
                          <button
                            type="button"
                            className="btn btn-sm btn-success w-full sm:w-auto"
                            onClick={() => handleResolve(alertId)}
                            disabled={actionLoading === alertId}
                          >
                            {actionLoading === alertId ? '...' : 'Resolve'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HealthAlerts;
