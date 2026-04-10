import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { healthConditionsAPI } from '../../services/healthMonitoringService';
import { usePatientId } from '../../hooks/usePatientId';
import { useFacesheetChartLayout } from '../../hooks/useFacesheetChartLayout';
import { format } from 'date-fns';
import IconSearch from '../../components/Icon/IconSearch';
import IconTrash from '../../components/Icon/IconTrash';
import IconX from '../../components/Icon/IconX';

type ConditionType = 'diabetes' | 'hypertension' | 'obesity' | 'asthma' | 'copd' | 'heart_disease' | 'arthritis' | 'depression' | 'anxiety' | 'chronic_kidney_disease' | 'other';
type StatusType = 'active' | 'inactive' | 'resolved';

interface DiagnosisRecord {
    _id: string;
    conditionType: ConditionType;
    diagnosisName: string;
    diagnosisCode: string;
    status: StatusType;
    diagnosisDate: string;
}

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

// 🔴 CHANGED: 4 items per page instead of 5 🔴
const ROWS_PER_PAGE = 4;

const Diagnoses: React.FC = () => {
    const hookPatientId = usePatientId();
    const { moduleRootClass } = useFacesheetChartLayout();
    
    const patientId = React.useMemo(() => {
        if (hookPatientId && hookPatientId.trim()) {
            return hookPatientId;
        }
        const urlParams = new URLSearchParams(window.location.search);
        const queryId = urlParams.get('patientId') || urlParams.get('rcopiaID');
        if (queryId && queryId.trim()) {
            return queryId;
        }
        return null;
    }, [hookPatientId]);

    const [diagnosesList, setDiagnosesList] = useState<DiagnosisRecord[]>([]);
    const [filteredList, setFilteredList] = useState<DiagnosisRecord[]>([]);
    const [paginatedList, setPaginatedList] = useState<DiagnosisRecord[]>([]);
    const [searchText, setSearchText] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletingDiagnosis, setDeletingDiagnosis] = useState<DiagnosisRecord | null>(null);

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

    const normalizeStatus = useCallback((status?: string | boolean): StatusType => {
        if (typeof status === 'boolean') {
            return status === true ? 'active' : 'inactive';
        }
        const normalized = String(status).toLowerCase();
        if (normalized === 'active' || normalized === 'inactive' || normalized === 'resolved') {
            return normalized;
        }
        return 'active';
    }, []);

    const normalizeConditionType = useCallback((type?: string): ConditionType => {
        const normalized = type?.toLowerCase();
        const validTypes: ConditionType[] = ['diabetes', 'hypertension', 'obesity', 'asthma', 'copd', 'heart_disease', 'arthritis', 'depression', 'anxiety', 'chronic_kidney_disease', 'other'];
        if (validTypes.includes(normalized as ConditionType)) {
            return normalized as ConditionType;
        }
        return 'other';
    }, []);

    const getConditionTypeLabel = useCallback((type: ConditionType): string => {
        return CONDITION_TYPE_DISPLAY_LABELS[type] ?? type;
    }, []);

    const capitalizeStatus = useCallback((status: StatusType): string => {
        return status.charAt(0).toUpperCase() + status.slice(1);
    }, []);

    const updatePagination = useCallback((list: DiagnosisRecord[], page: number) => {
        const start = (page - 1) * ROWS_PER_PAGE;
        const end = start + ROWS_PER_PAGE;
        setPaginatedList(list.slice(start, end));
        setCurrentPage(page);
    }, []);

    const filterDiagnoses = useCallback((list: DiagnosisRecord[], search: string): DiagnosisRecord[] => {
        if (!search.trim()) return list;
        const searchLower = search.toLowerCase().trim();
        return list.filter(
            (item) =>
                (item.diagnosisName?.toLowerCase().includes(searchLower)) ||
                (item.diagnosisCode?.toLowerCase().includes(searchLower)) ||
                (item.conditionType?.toLowerCase().includes(searchLower)) ||
                (item.status?.toLowerCase().includes(searchLower)) ||
                (item.diagnosisDate?.toLowerCase().includes(searchLower))
        );
    }, []);

    const mapApiToRecord = useCallback((item: any): DiagnosisRecord => {
        const rcopiaId = Array.isArray(item.RcopiaID) ? item.RcopiaID[0] : item.RcopiaID;
        
        return {
            _id: item._id ?? item.id ?? Math.random().toString(),
            conditionType: normalizeConditionType(item.conditionType || item.diagnosisType || 'other'),
            diagnosisName: item.name ?? item.diagnosisName ?? `RcopiaID: ${rcopiaId || 'N/A'}`,
            diagnosisCode: item.code ?? item.diagnosisCode ?? (rcopiaId || ''),
            status: normalizeStatus(item.status === true ? 'active' : item.status === false ? 'inactive' : item.status),
            diagnosisDate: item.diagnosisDate ? formatDate(item.diagnosisDate) : item.createdOn ? formatDate(item.createdOn) : formatDate(new Date().toISOString()),
        };
    }, [formatDate, normalizeConditionType, normalizeStatus]);

    const fetchDiagnoses = useCallback(async () => {
        if (!patientId) {
            setDiagnosesList([]);
            setFilteredList([]);
            updatePagination([], 1);
            return;
        }

        setLoading(true);
        try {
            const response = await healthConditionsAPI.getByPatient(patientId);
            
            let records: DiagnosisRecord[] = [];
            const responseData = response.data;
            
            if (responseData?.data && Array.isArray(responseData.data)) {
                records = responseData.data.map(mapApiToRecord);
            }
            else if (Array.isArray(responseData)) {
                records = responseData.map(mapApiToRecord);
            }
            else if (responseData?.results && Array.isArray(responseData.results)) {
                records = responseData.results.map(mapApiToRecord);
            }
            else if (responseData?.items && Array.isArray(responseData.items)) {
                records = responseData.items.map(mapApiToRecord);
            }
            else if (responseData?.records && Array.isArray(responseData.records)) {
                records = responseData.records.map(mapApiToRecord);
            }
            else if (responseData?.diagnoses && Array.isArray(responseData.diagnoses)) {
                records = responseData.diagnoses.map(mapApiToRecord);
            }
            else if (responseData && typeof responseData === 'object') {
                for (const key in responseData) {
                    if (Array.isArray(responseData[key]) && responseData[key].length > 0) {
                        records = responseData[key].map(mapApiToRecord);
                        break;
                    }
                }
            }
            
            setDiagnosesList(records);
            setFilteredList(records);
            updatePagination(records, 1);
            
        } catch (error: any) {
            console.error('Fetch error:', error);
            setDiagnosesList([]);
            setFilteredList([]);
            updatePagination([], 1);
            
            if (error.response?.status === 401) {
                toast.error('Authentication failed. Please login again.');
            } else if (error.response?.status === 404) {
                toast.error('No diagnoses found for this patient');
            } else {
                toast.error(error.response?.data?.message || 'Failed to fetch diagnoses');
            }
        } finally {
            setLoading(false);
        }
    }, [patientId, updatePagination, mapApiToRecord]);

    const handlePageChange = useCallback((page: number) => {
        updatePagination(filteredList, page);
    }, [filteredList, updatePagination]);

    const handleOpenDeleteConfirm = useCallback((diagnosis: DiagnosisRecord) => {
        setDeletingDiagnosis(diagnosis);
        setShowDeleteConfirm(true);
    }, []);

    const handleCloseDeleteConfirm = useCallback(() => {
        setShowDeleteConfirm(false);
        setDeletingDiagnosis(null);
    }, []);

    const handleDelete = useCallback(async () => {
        if (!deletingDiagnosis) return;

        setDeleting(true);
        try {
            await healthConditionsAPI.delete(deletingDiagnosis._id);
            toast.success('Diagnosis deleted successfully');
            await fetchDiagnoses();
        } catch (error: any) {
            console.error('Delete error:', error);
            toast.error(error.response?.data?.message || 'Failed to delete diagnosis');
        } finally {
            setDeleting(false);
            handleCloseDeleteConfirm();
        }
    }, [deletingDiagnosis, fetchDiagnoses, handleCloseDeleteConfirm]);

    const getStatusBadgeClass = useCallback((status: StatusType): string => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            case 'inactive':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'resolved':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
            default:
                return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
        }
    }, []);

    const totalPages = Math.ceil(filteredList.length / ROWS_PER_PAGE) || 1;

    useEffect(() => {
        fetchDiagnoses();
    }, [fetchDiagnoses]);

    useEffect(() => {
        const filtered = filterDiagnoses(diagnosesList, searchText);
        setFilteredList(filtered);
        updatePagination(filtered, 1);
    }, [searchText, diagnosesList, filterDiagnoses, updatePagination]);

    return (
        <div className={moduleRootClass}>
            <div className="mb-5">
                <ul className="flex items-center gap-2 text-sm">
                    <li>
                        <a href="#" className="text-primary hover:underline">Patient List</a>
                    </li>
                    <li>/</li>
                    <li className="text-gray-900 dark:text-white font-medium">Diagnoses</li>
                </ul>
            </div>

            <div className="mb-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1">
                        <h3 className="text-xl font-semibold">Diagnoses</h3>
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
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loading ? (
                    <div className="col-span-full flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading diagnoses...</span>
                    </div>
                ) : paginatedList.length === 0 ? (
                    <div className="col-span-full text-center py-12">
                        <p className="text-gray-500 dark:text-gray-400">
                            No diagnoses found for this patient.
                        </p>
                    </div>
                ) : (
                    paginatedList.map((diagnosis) => (
                        <div key={diagnosis._id} className="panel shadow-equal hover:shadow-equal-lg transition-shadow duration-200">
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white-light dark:border-[#191e3a]">
                                <h5 className="text-base font-semibold">{getConditionTypeLabel(diagnosis.conditionType)}</h5>
                                <div className="flex items-center gap-2">
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
                                <h6 className="text-primary text-sm uppercase font-semibold mb-2">Condition Details</h6>
                                <div className="space-y-2">
                                    {diagnosis.diagnosisCode && (
                                        <div>
                                            <span className="text-gray-600 dark:text-gray-400 text-sm">Code:</span>
                                            <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">{diagnosis.diagnosisCode}</span>
                                        </div>
                                    )}
                                    {diagnosis.diagnosisName && (
                                        <div>
                                            <span className="text-gray-600 dark:text-gray-400 text-sm">Description:</span>
                                            <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">{diagnosis.diagnosisName}</span>
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
                                        <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">{diagnosis.diagnosisDate || '---'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* 🔴 Pagination - Shows Previous/Next buttons when more than 4 items 🔴 */}
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
                    <span className="text-sm px-4">
                        Page {currentPage} of {totalPages}
                    </span>
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

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && deletingDiagnosis && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={handleCloseDeleteConfirm}>
                    <div className="bg-white dark:bg-[#0e1726] rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 bg-danger text-white rounded-t-lg">
                            <h5 className="text-lg font-semibold">Confirm Delete</h5>
                            <button type="button" onClick={handleCloseDeleteConfirm} className="p-1.5 rounded hover:bg-white/20 transition-colors">
                                <IconX className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-gray-700 dark:text-gray-300">Are you sure you want to delete this diagnosis?</p>
                            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded">
                                <p className="font-medium">{getConditionTypeLabel(deletingDiagnosis.conditionType)}</p>
                                {deletingDiagnosis.diagnosisName && <p className="text-sm text-gray-500">{deletingDiagnosis.diagnosisName}</p>}
                                <p className="text-sm text-gray-500">Status: {capitalizeStatus(deletingDiagnosis.status)}</p>
                            </div>
                            <p className="mt-4 text-sm text-gray-500">This action cannot be undone.</p>
                        </div>
                        <div className="flex justify-end gap-3 p-4 border-t border-white-light dark:border-[#191e3a]">
                            <button type="button" className="btn btn-outline-secondary" onClick={handleCloseDeleteConfirm} disabled={deleting}>Cancel</button>
                            <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                                {deleting ? 'Deleting...' : 'Delete Diagnosis'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Diagnoses;