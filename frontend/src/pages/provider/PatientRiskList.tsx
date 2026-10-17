import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { FaUserShield, FaExclamationTriangle } from 'react-icons/fa';
import IconSearch from '../../components/Icon/IconSearch';
import { providerAPI } from '../../services/healthMonitoringService';

interface PatientRiskItem {
  id?: string;
  _id?: string;
  patientId?: string;
  patientName?: string;
  name?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  riskScore?: number;
  lastUpdated?: string;
  [key: string]: any;
}

const PatientRiskList: React.FC = () => {
  const [list, setList] = useState<PatientRiskItem[]>([]);
  const [filteredList, setFilteredList] = useState<PatientRiskItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchRiskList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await providerAPI.getPatientRiskList();
      const raw = (res.data as { data?: PatientRiskItem[] })?.data ?? res.data;
      const arr = Array.isArray(raw) ? raw : [];
      setList(arr);
      setFilteredList(arr);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load patient risk list');
      setList([]);
      setFilteredList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRiskList();
  }, [fetchRiskList]);

  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredList(list);
      return;
    }
    const q = searchText.toLowerCase();
    setFilteredList(
      list.filter(
        (item) =>
          (item.patientName ?? item.name ?? '')
            .toLowerCase()
            .includes(q) ||
          (item.patientId ?? item._id ?? '')
            .toString()
            .toLowerCase()
            .includes(q)
      )
    );
  }, [searchText, list]);

  const displayName = (item: PatientRiskItem) =>
    item.patientName ?? item.name ?? item.patientId ?? item._id ?? '—';

  const riskBadgeClass = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'critical':
        return 'bg-danger/20 text-danger';
      case 'high':
        return 'bg-warning/20 text-warning';
      case 'medium':
        return 'bg-info/20 text-info';
      case 'low':
      default:
        return 'bg-success/20 text-success';
    }
  };

  return (
    <div>
      <div className="panel">
        <div className="mb-5">
          <ul className="flex items-center gap-2 text-sm">
            <li>
              <Link to="/app/dashboard" className="text-primary hover:underline">
                Dashboard
              </Link>
            </li>
            <li>/</li>
            <li className="text-gray-900 dark:text-white font-medium">Patient Risk List</li>
          </ul>
        </div>
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <FaUserShield className="text-primary" />
              Patient Risk List
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Patients by risk level (provider view). Use filters to find high-risk patients.
            </p>
          </div>
        </div>

        <div className="mb-4">
          <div className="relative max-w-xs">
            <input
              type="text"
              className="form-input pl-9"
              placeholder="Search by name or ID..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <IconSearch className="w-4 h-4" />
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <FaExclamationTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No patients in risk list.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-auto w-full">
              <thead>
                <tr className="border-b border-white-light dark:border-dark">
                  <th className="text-left py-3 px-2 font-semibold">Patient</th>
                  <th className="text-left py-3 px-2 font-semibold">Risk Level</th>
                  <th className="text-left py-3 px-2 font-semibold">Risk Score</th>
                  <th className="text-left py-3 px-2 font-semibold">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((item) => (
                  <tr key={item.id ?? item._id ?? item.patientId ?? Math.random()} className="border-b border-white-light dark:border-dark hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-3 px-2">
                      <span className="font-medium">{displayName(item)}</span>
                      {(item.patientId || item._id) && (
                        <span className="text-gray-500 dark:text-gray-400 text-sm block">
                          ID: {item.patientId ?? item._id}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${riskBadgeClass(
                          item.riskLevel
                        )}`}
                      >
                        {(item.riskLevel ?? 'low').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      {item.riskScore != null ? item.riskScore : '—'}
                    </td>
                    <td className="py-3 px-2 text-gray-600 dark:text-gray-400 text-sm">
                      {item.lastUpdated
                        ? new Date(item.lastUpdated).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientRiskList;
