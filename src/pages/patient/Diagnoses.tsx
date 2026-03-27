import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { healthConditionsAPI } from '../../services/healthMonitoringService';
import { usePatientId } from '../../hooks/usePatientId';
import { format } from 'date-fns';
import IconSearch from '../../components/Icon/IconSearch';
import IconPlus from '../../components/Icon/IconPlus';
import IconPencil from '../../components/Icon/IconPencil';
import IconTrash from '../../components/Icon/IconTrash';
import IconX from '../../components/Icon/IconX';

// Valid condition types from backend CONDITION_TYPES
type ConditionType = 
  | 'diabetes'
  | 'hypertension'
  | 'obesity'
  | 'asthma'
  | 'copd'
  | 'heart_disease'
  | 'arthritis'
  | 'depression'
  | 'anxiety'
  | 'chronic_kidney_disease'
  | 'other';

type StatusType = 'active' | 'inactive' | 'resolved';

// Types
interface DiagnosisRecord {
  _id: string;
  conditionType: ConditionType;
  diagnosisName: string;
  diagnosisCode: string;
  status: StatusType;
  diagnosisDate: string;
}

interface DiagnosisFormData {
  conditionType: ConditionType;
  status: StatusType;
  diagnosisDate: string;
}

interface ApiConditionRecord {
  id?: string;
  _id?: string;
  conditionType?: string;
  name?: string;
  code?: string;
  status?: string;
  diagnosisDate?: string;
  onsetDate?: string;
}

// Only condition types currently supported by backend API (unsupported hidden until backend validation is updated)
const CONDITION_TYPE_OPTIONS: Array<{ value: ConditionType; label: string }> = [
  { value: 'diabetes', label: 'Diabetes' },
  { value: 'hypertension', label: 'Hypertension' },
  { value: 'obesity', label: 'Obesity' },
  { value: 'asthma', label: 'Asthma' },
  // Hidden until backend supports: COPD, Heart Disease, Arthritis, Depression, Anxiety, Chronic Kidney Disease, Other
];

// Display labels for all types (including hidden) so existing records still show correct labels
const CONDITION_TYPE_DISPLAY_LABELS: Record<string, string> = {
  diabetes: 'Diabetes',
  hypertension: 'Hypertension',
  obesity: 'Obesity',
  asthma: 'Asthma',
  copd: 'COPD',
  heart_disease: 'Heart Disease',
  arthritis: 'Arthritis',
  depression: 'Depression',
  anxiety: 'Anxiety',
  chronic_kidney_disease: 'Chronic Kidney Disease',
  other: 'Other',
};

const STATUS_OPTIONS: Array<{ value: StatusType; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'resolved', label: 'Resolved' },
];

const INITIAL_FORM_DATA: DiagnosisFormData = {
  conditionType: 'diabetes',
  status: 'active',
  diagnosisDate: '',
};

const ROWS_PER_PAGE = 5;

const Diagnoses: React.FC = () => {
  const patientId = usePatientId();

  // Data state
  const [diagnosesList, setDiagnosesList] = useState<DiagnosisRecord[]>([]);
  const [filteredList, setFilteredList] = useState<DiagnosisRecord[]>([]);
  const [paginatedList, setPaginatedList] = useState<DiagnosisRecord[]>([]);

  // UI state
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingDiagnosis, setEditingDiagnosis] = useState<DiagnosisRecord | null>(null);
  const [deletingDiagnosis, setDeletingDiagnosis] = useState<DiagnosisRecord | null>(null);
  const [formData, setFormData] = useState<DiagnosisFormData>(INITIAL_FORM_DATA);

  // Utility functions
  const formatDate = useCallback((dateString: string): string => {
    if (!dateString?.trim()) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return format(date, 'MM/dd/yyyy');
    } catch {
      return dateString;
    }
  }, []);

  const formatDateForInput = useCallback((dateString: string): string => {
    if (!dateString?.trim()) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return format(date, 'yyyy-MM-dd');
    } catch {
      return '';
    }
  }, []);

  const normalizeStatus = (status?: string): StatusType => {
    const normalized = status?.toLowerCase();
    if (normalized === 'active' || normalized === 'inactive' || normalized === 'resolved') {
      return normalized;
    }
    return 'active';
  };

  const normalizeConditionType = (type?: string): ConditionType => {
    const normalized = type?.toLowerCase();
    const validTypes: ConditionType[] = [
      'diabetes', 'hypertension', 'obesity', 'asthma', 'copd',
      'heart_disease', 'arthritis', 'depression', 'anxiety',
      'chronic_kidney_disease', 'other'
    ];
    if (validTypes.includes(normalized as ConditionType)) {
      return normalized as ConditionType;
    }
    return 'other';
  };

  const getConditionTypeLabel = (type: ConditionType): string => {
    return CONDITION_TYPE_DISPLAY_LABELS[type] ?? type;
  };

  const capitalizeStatus = (status: StatusType): string => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const mapApiToRecord = useCallback((item: ApiConditionRecord): DiagnosisRecord => ({
    _id: item.id ?? item._id ?? '',
    conditionType: normalizeConditionType(item.conditionType),
    diagnosisName: item.name ?? '',
    diagnosisCode: item.code ?? '',
    status: normalizeStatus(item.status),
    diagnosisDate: item.diagnosisDate 
      ? formatDate(item.diagnosisDate) 
      : item.onsetDate 
        ? formatDate(item.onsetDate) 
        : '',
  }), [formatDate]);

  const buildCreatePayload = useCallback((data: DiagnosisFormData) => {
    return {
      patientId,
      conditionType: data.conditionType,
      diagnosisDate: data.diagnosisDate || null,
      status: data.status,
    };
  }, [patientId]);

  const buildUpdatePayload = useCallback((data: DiagnosisFormData) => {
    return {
      conditionType: data.conditionType,
      diagnosisDate: data.diagnosisDate || null,
      status: data.status,
    };
  }, []);

  // Fetch diagnoses
  const fetchDiagnoses = useCallback(async () => {
    if (!patientId) {
      toast.error('Patient ID is required');
      return;
    }

    setLoading(true);
    try {
      const response = await healthConditionsAPI.getByPatient(patientId);
      const rawData = (response.data as { data?: ApiConditionRecord[] })?.data ?? response.data;
      const records = Array.isArray(rawData) ? rawData.map(mapApiToRecord) : [];
      
      setDiagnosesList(records);
      setFilteredList(records);
      updatePagination(records, 1);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to fetch diagnoses';
      toast.error(message);
      setDiagnosesList([]);
      setFilteredList([]);
      setPaginatedList([]);
    } finally {
      setLoading(false);
    }
  }, [patientId, mapApiToRecord]);

  // Filter and pagination
  const filterDiagnoses = useCallback((list: DiagnosisRecord[], search: string): DiagnosisRecord[] => {
    if (!search.trim()) return list;
    
    const searchLower = search.toLowerCase().trim();
    return list.filter((item) => 
      item.diagnosisName?.toLowerCase().includes(searchLower) ||
      item.diagnosisCode?.toLowerCase().includes(searchLower) ||
      item.conditionType?.toLowerCase().includes(searchLower) ||
      item.status?.toLowerCase().includes(searchLower) ||
      item.diagnosisDate?.toLowerCase().includes(searchLower)
    );
  }, []);

  const updatePagination = useCallback((list: DiagnosisRecord[], page: number) => {
    const start = (page - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    setPaginatedList(list.slice(start, end));
    setCurrentPage(page);
  }, []);

  const totalPages = Math.ceil(filteredList.length / ROWS_PER_PAGE) || 1;

  // Effects
  useEffect(() => {
    fetchDiagnoses();
  }, [fetchDiagnoses]);

  useEffect(() => {
    const filtered = filterDiagnoses(diagnosesList, searchText);
    setFilteredList(filtered);
    updatePagination(filtered, 1);
  }, [searchText, diagnosesList, filterDiagnoses, updatePagination]);

  // Handlers
  const handlePageChange = (page: number) => {
    updatePagination(filteredList, page);
  };

  const handleOpenAddModal = () => {
    setEditingDiagnosis(null);
    setFormData(INITIAL_FORM_DATA);
    setShowModal(true);
  };

  const handleOpenEditModal = (diagnosis: DiagnosisRecord) => {
    setEditingDiagnosis(diagnosis);
    setFormData({
      conditionType: diagnosis.conditionType,
      status: diagnosis.status,
      diagnosisDate: formatDateForInput(diagnosis.diagnosisDate),
    });
    setShowModal(true);
  };

  const handleOpenDeleteConfirm = (diagnosis: DiagnosisRecord) => {
    setDeletingDiagnosis(diagnosis);
    setShowDeleteConfirm(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDiagnosis(null);
    setFormData(INITIAL_FORM_DATA);
  };

  const handleCloseDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    setDeletingDiagnosis(null);
  };

  const handleFormChange = <K extends keyof DiagnosisFormData>(
    field: K,
    value: DiagnosisFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    if (!formData.conditionType) {
      toast.error('Condition type is required');
      return false;
    }
    if (!formData.status) {
      toast.error('Status is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      if (editingDiagnosis) {
        await healthConditionsAPI.update(editingDiagnosis._id, buildUpdatePayload(formData));
        toast.success('Diagnosis updated successfully');
      } else {
        await healthConditionsAPI.create(buildCreatePayload(formData));
        toast.success('Diagnosis added successfully');
      }
      handleCloseModal();
      await fetchDiagnoses();
    } catch (error: any) {
      const message = error.response?.data?.message || 
        (editingDiagnosis ? 'Failed to update diagnosis' : 'Failed to add diagnosis');
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDiagnosis) return;

    setSubmitting(true);
    try {
      await healthConditionsAPI.delete(deletingDiagnosis._id);
      toast.success('Diagnosis deleted successfully');
      handleCloseDeleteConfirm();
      await fetchDiagnoses();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to delete diagnosis';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeClass = (status: StatusType): string => {
    switch (status) {
      case 'active':
        return 'bg-success/20 text-success';
      case 'inactive':
        return 'bg-warning/20 text-warning';
      case 'resolved':
        return 'bg-info/20 text-info';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div>
      <div className="panel h-[calc(100vh-120px)] overflow-y-auto">
        {/* Breadcrumb */}
        <div className="mb-5">
          <ul className="flex items-center gap-2 text-sm">
            <li>
              <a href="#" className="text-primary hover:underline">Patient List</a>
            </li>
            <li>/</li>
            <li className="text-gray-900 dark:text-white font-medium">Diagnoses</li>
          </ul>
        </div>

        {/* Page Header */}
        <div className="mb-5">
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
    
    {/* Left Section */}
    <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1">
      
      <h3 className="text-xl font-semibold">
        Diagnoses
      </h3>

      <div className="relative w-full md:max-w-md">
        <input
          type="text"
          className="form-input pl-10 w-full"
          placeholder="Search diagnoses..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <IconSearch className="w-4 h-4" />
        </span>
      </div>

    </div>

    {/* Right Section */}
    <div className="w-full md:w-auto">
      <button
        type="button"
        className="btn btn-primary w-full md:w-auto flex items-center justify-center gap-2"
        onClick={handleOpenAddModal}
      >
        <IconPlus className="w-4 h-4" />
        Add Diagnosis
      </button>
    </div>

  </div>
</div>

        {/* Diagnoses Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading diagnoses...</span>
            </div>
          ) : paginatedList.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                {diagnosesList.length === 0 
                  ? 'No diagnoses recorded for this patient.' 
                  : 'No diagnoses match your search criteria.'}
              </p>
            </div>
          ) : (
            paginatedList.map((diagnosis) => (
              <div 
                key={diagnosis._id} 
                className="panel shadow-equal hover:shadow-equal-lg transition-shadow duration-200"
              >
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-white-light dark:border-[#191e3a]">
                  <h5 className="text-base font-semibold">
                    {getConditionTypeLabel(diagnosis.conditionType)}
                  </h5>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => handleOpenEditModal(diagnosis)}
                      title="Edit"
                    >
                      <IconPencil className="w-4 h-4 text-primary" />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => handleOpenDeleteConfirm(diagnosis)}
                      title="Delete"
                    >
                      <IconTrash className="w-4 h-4 text-danger" />
                    </button>
                  </div>
                </div>
                <div>
                  <h6 className="text-primary text-sm uppercase font-semibold mb-2">
                    Condition Details
                  </h6>
                  <div className="space-y-2">
                    {diagnosis.diagnosisCode && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400 text-sm">Code:</span>
                        <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">
                          {diagnosis.diagnosisCode}
                        </span>
                      </div>
                    )}
                    {diagnosis.diagnosisName && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400 text-sm">Description:</span>
                        <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">
                          {diagnosis.diagnosisName}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center">
                      <span className="text-gray-600 dark:text-gray-400 text-sm">Status:</span>
                      <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(diagnosis.status)}`}>
                        {capitalizeStatus(diagnosis.status)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400 text-sm">Diagnosis Date:</span>
                      <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">
                        {diagnosis.diagnosisDate || '---'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination - same style as Vitals */}
        {!loading && filteredList.length > ROWS_PER_PAGE && (
          <div className="flex justify-center items-center gap-2 mt-4">
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="text-sm px-4">Page {currentPage} of {totalPages}</span>
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white dark:bg-[#0e1726] rounded-lg shadow-xl max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 bg-primary text-white rounded-t-lg">
              <h5 className="text-lg font-semibold">
                {editingDiagnosis ? 'Edit Diagnosis' : 'Add New Diagnosis'}
              </h5>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1.5 rounded hover:bg-white/20 transition-colors"
                aria-label="Close"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Condition Type <span className="text-danger">*</span>
                  </label>
                  <select
  className="form-select w-full"
  value={formData.conditionType}
  onChange={(e) =>
    handleFormChange('conditionType', e.target.value as ConditionType)
  }
>
                    {CONDITION_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Status <span className="text-danger">*</span>
                  </label>
                  <select
  className="form-select w-full"
  value={formData.status}
  onChange={(e) =>
    handleFormChange('status', e.target.value as StatusType)
  }
>
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Diagnosis Date
                  </label>
                  <input
                    type="date"
                    className="form-input w-full"
                    value={formData.diagnosisDate}
                    onChange={(e) => handleFormChange('diagnosisDate', e.target.value)}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white-light dark:border-[#191e3a]">
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={handleCloseModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      {editingDiagnosis ? 'Updating...' : 'Adding...'}
                    </span>
                  ) : (
                    editingDiagnosis ? 'Update Diagnosis' : 'Add Diagnosis'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingDiagnosis && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={handleCloseDeleteConfirm}
        >
          <div
            className="bg-white dark:bg-[#0e1726] rounded-lg shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 bg-danger text-white rounded-t-lg">
              <h5 className="text-lg font-semibold">Confirm Delete</h5>
              <button
                type="button"
                onClick={handleCloseDeleteConfirm}
                className="p-1.5 rounded hover:bg-white/20 transition-colors"
                aria-label="Close"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300">
                Are you sure you want to delete this diagnosis?
              </p>
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <p className="font-medium">{getConditionTypeLabel(deletingDiagnosis.conditionType)}</p>
                {deletingDiagnosis.diagnosisName && (
                  <p className="text-sm text-gray-500">{deletingDiagnosis.diagnosisName}</p>
                )}
                <p className="text-sm text-gray-500">
                  Status: {capitalizeStatus(deletingDiagnosis.status)}
                </p>
              </div>
              <p className="mt-4 text-sm text-gray-500">
                This action cannot be undone.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-4 border-t border-white-light dark:border-[#191e3a]">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={handleCloseDeleteConfirm}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={submitting}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Deleting...
                  </span>
                ) : (
                  'Delete Diagnosis'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Diagnoses;
