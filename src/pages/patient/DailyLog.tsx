import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { FaBook, FaPlus, FaMoon, FaSmile, FaRunning, FaTint, FaUtensils } from 'react-icons/fa6';
import IconSearch from '../../components/Icon/IconSearch';
import { usePatientId } from '../../hooks/usePatientId';
import { healthDailyLogAPI } from '../../services/healthMonitoringService';

interface DailyLogEntry {
  id?: string;
  _id?: string;
  date?: string;
  sleepHours?: number;
  sleepQuality?: string;
  mood?: string;
  energyLevel?: number;
  stressLevel?: number;
  waterIntake?: number;
  exerciseMinutes?: number;
  exerciseType?: string;
  symptoms?: string[];
  notes?: string;
  createdAt?: string;
}

const moodOptions = ['Excellent', 'Good', 'Okay', 'Poor', 'Very Poor'];
const sleepQualityOptions = ['Excellent', 'Good', 'Fair', 'Poor', 'Very Poor'];

const LOGS_PER_PAGE = 9;

const DailyLog: React.FC = () => {
  const patientId = usePatientId();
  const [logsList, setLogsList] = useState<DailyLogEntry[]>([]);
  const [filteredList, setFilteredList] = useState<DailyLogEntry[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<DailyLogEntry>({
    date: new Date().toISOString().split('T')[0],
    sleepHours: undefined,
    sleepQuality: '',
    mood: '',
    energyLevel: 5,
    stressLevel: 5,
    waterIntake: undefined,
    exerciseMinutes: undefined,
    exerciseType: '',
    symptoms: [],
    notes: '',
  });
  const [symptomInput, setSymptomInput] = useState('');
  const [emptyLogError, setEmptyLogError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  /** Returns true if at least one meaningful field (other than date) has a value. */
  const hasAtLeastOneMeaningfulField = (f: DailyLogEntry): boolean => {
    if (f.sleepHours != null && f.sleepHours > 0) return true;
    if (f.sleepQuality?.trim()) return true;
    if (f.mood?.trim()) return true;
    if (f.waterIntake != null && f.waterIntake > 0) return true;
    if (f.exerciseMinutes != null && f.exerciseMinutes > 0) return true;
    if (f.exerciseType?.trim()) return true;
    if (f.symptoms?.length) return true;
    if (f.notes?.trim()) return true;
    return false;
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  const fetchLogs = useCallback(async () => {
    if (!patientId) {
      toast.error('Patient ID is required');
      return;
    }
    setLoading(true);
    try {
      const res = await healthDailyLogAPI.getByPatient(patientId);
      const raw = (res.data as { data?: DailyLogEntry[] })?.data ?? res.data;
      const arr = Array.isArray(raw) ? raw : [];
      setLogsList(arr);
      setFilteredList(arr);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch daily logs');
      setLogsList([]);
      setFilteredList([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (emptyLogError && hasAtLeastOneMeaningfulField(form)) {
      setEmptyLogError('');
    }
  }, [form, emptyLogError]);

  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredList(logsList);
    } else {
      const search = searchText.toLowerCase();
      setFilteredList(
        logsList.filter(
          (log) =>
            log.date?.toLowerCase().includes(search) ||
            log.mood?.toLowerCase().includes(search) ||
            log.notes?.toLowerCase().includes(search) ||
            log.symptoms?.some((s) => s.toLowerCase().includes(search))
        )
      );
    }
    setCurrentPage(1);
  }, [searchText, logsList]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / LOGS_PER_PAGE));
  const paginatedList = filteredList.slice(
    (currentPage - 1) * LOGS_PER_PAGE,
    currentPage * LOGS_PER_PAGE
  );

  const handleAddSymptom = () => {
    if (symptomInput.trim()) {
      setForm((f) => ({
        ...f,
        symptoms: [...(f.symptoms || []), symptomInput.trim()],
      }));
      setSymptomInput('');
    }
  };

  const handleRemoveSymptom = (index: number) => {
    setForm((f) => ({
      ...f,
      symptoms: (f.symptoms || []).filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmptyLogError('');
    if (!patientId) {
      toast.error('Patient ID is required');
      return;
    }
    if (!hasAtLeastOneMeaningfulField(form)) {
      const message = 'Please fill in at least one field (e.g. sleep, mood, water, exercise, symptoms, or notes) before saving.';
      setEmptyLogError(message);
      toast.error(message);
      return;
    }
    setSubmitting(true);
    try {
      await healthDailyLogAPI.create({
        patientId,
        ...form,
        sleepHours: form.sleepHours ? Number(form.sleepHours) : undefined,
        waterIntake: form.waterIntake ? Number(form.waterIntake) : undefined,
        exerciseMinutes: form.exerciseMinutes ? Number(form.exerciseMinutes) : undefined,
      });
      toast.success('Daily log saved successfully');
      setShowForm(false);
      setForm({
        date: new Date().toISOString().split('T')[0],
        sleepHours: undefined,
        sleepQuality: '',
        mood: '',
        energyLevel: 5,
        stressLevel: 5,
        waterIntake: undefined,
        exerciseMinutes: undefined,
        exerciseType: '',
        symptoms: [],
        notes: '',
      });
      fetchLogs();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save daily log');
    } finally {
      setSubmitting(false);
    }
  };

  const getMoodColor = (mood?: string) => {
    switch (mood?.toLowerCase()) {
      case 'excellent':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'good':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'okay':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'poor':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'very poor':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div>
      <div className="panel h-[calc(100vh-120px)] overflow-y-auto">
        <div className="mb-5">
          <ul className="flex items-center gap-2 text-sm">
            <li>
              <a href="#" className="text-primary hover:underline">Patient</a>
            </li>
            <li>/</li>
            <li className="text-gray-900 dark:text-white font-medium">Daily Health Log</li>
          </ul>
        </div>

        <div className="mb-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FaBook className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Daily Health Log</h3>
              </div>
              <div className="relative max-w-md">
                <input
                  type="text"
                  className="form-input pl-10"
                  placeholder="Search logs..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <IconSearch className="w-4 h-4" />
                </span>
              </div>
            </div>
            {!showForm && (
              <button
                type="button"
                className="btn btn-primary md:mt-10"
                onClick={() => setShowForm(true)}
              >
                <FaPlus className="w-4 h-4 mr-1 inline" />
                Log Today
              </button>
            )}
          </div>
        </div>

        {showForm && (
          <div className="panel mb-5 border border-primary/20">
            <h5 className="text-base font-semibold mb-4">Record Daily Log</h5>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label flex items-center gap-2">
                    <FaMoon className="text-primary" /> Sleep Hours
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    min={0}
                    max={24}
                    step={0.5}
                    placeholder="e.g. 7.5"
                    value={form.sleepHours ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, sleepHours: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                </div>
                <div>
                  <label className="form-label">Sleep Quality</label>
                  <select
                    className="form-select"
                    value={form.sleepQuality}
                    onChange={(e) => setForm((f) => ({ ...f, sleepQuality: e.target.value }))}
                  >
                    <option value="">Select...</option>
                    {sleepQualityOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label flex items-center gap-2">
                    <FaSmile className="text-primary" /> Mood
                  </label>
                  <select
                    className="form-select"
                    value={form.mood}
                    onChange={(e) => setForm((f) => ({ ...f, mood: e.target.value }))}
                  >
                    <option value="">Select...</option>
                    {moodOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Energy Level (1-10)</label>
                  <input
                    type="range"
                    className="w-full"
                    min={1}
                    max={10}
                    value={form.energyLevel}
                    onChange={(e) => setForm((f) => ({ ...f, energyLevel: Number(e.target.value) }))}
                  />
                  <div className="text-center text-sm font-semibold">{form.energyLevel}</div>
                </div>
                <div>
                  <label className="form-label">Stress Level (1-10)</label>
                  <input
                    type="range"
                    className="w-full"
                    min={1}
                    max={10}
                    value={form.stressLevel}
                    onChange={(e) => setForm((f) => ({ ...f, stressLevel: Number(e.target.value) }))}
                  />
                  <div className="text-center text-sm font-semibold">{form.stressLevel}</div>
                </div>
                <div>
                  <label className="form-label flex items-center gap-2">
                    <FaTint className="text-primary" /> Water Intake (glasses)
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    min={0}
                    max={20}
                    placeholder="e.g. 8"
                    value={form.waterIntake ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, waterIntake: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                </div>
                <div>
                  <label className="form-label flex items-center gap-2">
                    <FaRunning className="text-primary" /> Exercise (minutes)
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    min={0}
                    placeholder="e.g. 30"
                    value={form.exerciseMinutes ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, exerciseMinutes: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                </div>
                <div>
                  <label className="form-label">Exercise Type</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Walking, Yoga"
                    value={form.exerciseType}
                    onChange={(e) => setForm((f) => ({ ...f, exerciseType: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="form-label">Symptoms</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      className="form-input flex-1"
                      placeholder="Add a symptom..."
                      value={symptomInput}
                      onChange={(e) => setSymptomInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSymptom())}
                    />
                    <button type="button" className="btn btn-outline-primary" onClick={handleAddSymptom}>
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.symptoms?.map((symptom, index) => (
                      <span
                        key={index}
                        className="badge bg-primary/10 text-primary px-3 py-1 rounded-full cursor-pointer hover:bg-red-100 hover:text-red-600"
                        onClick={() => handleRemoveSymptom(index)}
                        title="Click to remove"
                      >
                        {symptom} ×
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Any additional notes about your day..."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              {emptyLogError && (
                <div className="rounded-lg bg-danger/10 dark:bg-danger/20 text-danger px-4 py-3 text-sm font-medium">
                  {emptyLogError}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Log'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {!showForm && (
        <div>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span>Loading daily logs...</span>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-500 rounded-xl border border-dashed border-white-light dark:border-dark">
              <FaBook className="w-12 h-12 text-gray-300" />
              <p className="font-medium text-gray-600 dark:text-gray-400">
                {logsList.length === 0 ? 'No daily logs recorded yet.' : 'No matching records.'}
              </p>
              <button className="btn btn-primary mt-2" onClick={() => setShowForm(true)}>
                Start Logging
              </button>
            </div>
          ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginatedList.map((log) => (
                <div
                  key={log.id ?? log._id}
                  className="panel shadow-equal hover:shadow-equal-lg transition-shadow duration-200"
                >
                  <div className="mb-4 pb-3 border-b border-white-light dark:border-[#191e3a] flex items-center justify-between">
                    <h5 className="text-base font-semibold">
                      {formatDate(log.date || log.createdAt)}
                    </h5>
                    {log.mood && (
                      <span className={`badge text-xs px-2 py-1 rounded-full ${getMoodColor(log.mood)}`}>
                        {log.mood}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {log.sleepHours != null && (
                      <div className="flex items-center gap-2">
                        <FaMoon className="text-indigo-500" />
                        <span>{log.sleepHours}h sleep</span>
                        {log.sleepQuality && <span className="text-gray-500">({log.sleepQuality})</span>}
                      </div>
                    )}
                    {log.waterIntake != null && (
                      <div className="flex items-center gap-2">
                        <FaTint className="text-blue-500" />
                        <span>{log.waterIntake} glasses</span>
                      </div>
                    )}
                    {log.exerciseMinutes != null && (
                      <div className="flex items-center gap-2">
                        <FaRunning className="text-green-500" />
                        <span>{log.exerciseMinutes} min</span>
                        {log.exerciseType && <span className="text-gray-500">({log.exerciseType})</span>}
                      </div>
                    )}
                    {log.energyLevel != null && (
                      <div>
                        <span className="text-gray-500">Energy:</span> {log.energyLevel}/10
                      </div>
                    )}
                    {log.stressLevel != null && (
                      <div>
                        <span className="text-gray-500">Stress:</span> {log.stressLevel}/10
                      </div>
                    )}
                  </div>
                  {log.symptoms && log.symptoms.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white-light dark:border-[#191e3a]">
                      <span className="text-gray-500 text-sm">Symptoms: </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {log.symptoms.map((s, i) => (
                          <span key={i} className="badge bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {log.notes && (
                    <div className="mt-3 pt-3 border-t border-white-light dark:border-[#191e3a]">
                      <p className="text-gray-600 dark:text-gray-400 text-sm">{log.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {filteredList.length > LOGS_PER_PAGE && (
              <div className="flex justify-center items-center gap-2 mt-4">
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span className="text-sm px-4">Page {currentPage} of {totalPages}</span>
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Next
                </button>
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

export default DailyLog;
