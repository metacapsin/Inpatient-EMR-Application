import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { patientDataAPI, aiHealthInsightsAPI } from '../../services/api';
import { usePatientId } from '../../hooks/usePatientId';
import { format } from 'date-fns';
import { FaFlask, FaTimes } from 'react-icons/fa';
import IconSparkles from '../../components/Icon/IconSparkles';
import IconSearch from '../../components/Icon/IconSearch';

interface LabOrder {
  _id: string;
  labOrderId?: string;
  testName?: string;
  name?: string;
  orderDate?: string;
  date?: string;
  createdAt?: string;
  status?: string;
  providerName?: string;
  notes?: string;
  [key: string]: any;
}

interface LabExplanation {
  labOrderId?: string;
  explanations?: Array<{
    testName?: string;
    plainLanguageExplanation?: string;
  }>;
}

const FETCH_LIMIT = 500;

/** Placeholder when a value is missing (matches Preventive Screening style). */
const orDash = (v: unknown): string => {
  if (v == null) return '--';
  const s = String(v).trim();
  return s === '' ? '--' : s;
};

const LabOrders: React.FC = () => {
  const patientId = usePatientId();
  const [labOrdersList, setLabOrdersList] = useState<LabOrder[]>([]);
  const [paginatedCardList, setPaginatedCardList] = useState<LabOrder[]>([]);
  const [filteredCardList, setFilteredCardList] = useState<LabOrder[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(2);

  // AI Modal states
  const [showAIModal, setShowAIModal] = useState(false);
  const [selectedLabOrderId, setSelectedLabOrderId] = useState<string | null>(null);
  const [labExplanation, setLabExplanation] = useState<LabExplanation | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return format(date, 'MM/dd/yyyy');
    } catch {
      return String(dateString || '');
    }
  };

  const normalizeRecord = (item: any): LabOrder => {
    if (!item || typeof item !== 'object') {
      return { _id: 'unknown', testName: '', orderDate: '', status: '' };
    }
    
    // Extract test names from labTests array
    let testNameValue = '';
    if (item.labTests && Array.isArray(item.labTests) && item.labTests.length > 0) {
      const testNames = item.labTests
        .map((test: any) => test.name || test.testName)
        .filter(Boolean)
        .join(', ');
      testNameValue = testNames || '';
    }
    
    // Fallback to other possible fields
    if (!testNameValue) {
      testNameValue = item.testName || item.name || item.orderType || '';
    }
    
    const dateValue = item.orderDate || item.date || item.createdAt || '';
    const statusValue = item.orderStatus ?? item.status ?? '';
    const providerNameValue = item.orderingProviderName || item.providerName || '';
    const notesValue = item.officeNotes || item.notes || item.patientContactNotes || '';

    return {
      ...item,
      testName: testNameValue ? String(testNameValue).trim() : '',
      orderDate: dateValue ? formatDate(dateValue) : '',
      status: statusValue !== '' && statusValue != null ? String(statusValue).trim() : '',
      providerName: providerNameValue ? String(providerNameValue).trim() : '',
      notes: notesValue ? String(notesValue).trim() : '',
      labOrderId: item._id || item.labOrderId || item.id || '',
    };
  };

  const updatePaginatedList = useCallback((data: LabOrder[], page: number) => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    setFilteredCardList(data.slice(start, end));
  }, [rowsPerPage]);

  const getPatientLabOrders = useCallback(async () => {
    if (!patientId) {
      toast.error('Patient ID is required');
      return;
    }

    setLoading(true);
    try {
      const response = await patientDataAPI.getLabOrdersByPatient(patientId, 1, FETCH_LIMIT);

      const data = response.data?.data || response.data;
      const orders = Array.isArray(data?.orders)
        ? data.orders
        : Array.isArray(data)
          ? data
          : [];

      const formattedData = orders.map((item: any) => normalizeRecord(item));
      setLabOrdersList(formattedData);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch lab orders');
      setLabOrdersList([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    getPatientLabOrders();
  }, [getPatientLabOrders]);

  useEffect(() => {
    if (!searchText || !searchText.trim()) {
      setPaginatedCardList([...labOrdersList]);
      setCurrentPage(1);
      updatePaginatedList([...labOrdersList], 1);
      return;
    }
    const search = searchText.toLowerCase().trim();
    const ok = (v: any) => v != null && v !== '' && String(v).toLowerCase().includes(search);
    const filtered = labOrdersList.filter(
      (item) =>
        ok(item.testName) ||
        ok(item.name) ||
        ok(item.orderDate) ||
        ok(item.date) ||
        ok(item.status) ||
        ok(item.orderStatus) ||
        ok(item.providerName) ||
        ok(item.orderingProviderName) ||
        ok(item.notes) ||
        ok(item.officeNotes) ||
        ok(item.patientContactNotes)
    );
    setPaginatedCardList(filtered);
    setCurrentPage(1);
    updatePaginatedList(filtered, 1);
  }, [searchText, labOrdersList, updatePaginatedList]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updatePaginatedList(paginatedCardList, page);
  };

  const handleAIClick = async (labOrderId: string) => {
    setSelectedLabOrderId(labOrderId);
    setShowAIModal(true);
    setLoadingAI(true);
    setAiError(null);
    setLabExplanation(null);

    try {
      const response = await aiHealthInsightsAPI.explainLabReport({ labId: labOrderId });
      const explanation = response.data?.data || response.data;
      setLabExplanation(explanation || {});
    } catch (error: any) {
      console.error('Error fetching lab explanation:', error);
      setAiError(error.response?.data?.message || 'Failed to fetch lab explanation. Please try again.');
      toast.error('Failed to fetch lab explanation');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleCloseAIModal = () => {
    setShowAIModal(false);
    setSelectedLabOrderId(null);
    setLabExplanation(null);
    setAiError(null);
  };

  return (
    <div>
      <div className="panel">
        {/* Breadcrumb */}
        <div className="mb-5">
          <ul className="flex items-center gap-2 text-sm">
            <li>
              <a href="#" className="text-primary hover:underline">Patient List</a>
            </li>
            <li>/</li>
            <li className="text-gray-900 dark:text-white font-medium">Lab Orders</li>
          </ul>
        </div>

        {/* Page Header */}
        <div className="mb-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FaFlask className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Lab Orders</h3>
              </div>
              <div className="relative max-w-md">
                <input
                  type="text"
                  className="form-input pl-10"
                  placeholder="Search lab orders..."
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

        {/* Card View */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {loading ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span>Loading lab orders...</span>
              </div>
            ) : filteredCardList.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 gap-2 text-gray-500 rounded-xl border border-dashed border-white-light dark:border-dark">
                <FaFlask className="w-12 h-12 text-gray-300" />
                <p className="font-medium text-gray-600 dark:text-gray-400">
                  {labOrdersList.length === 0 ? 'No lab orders for this patient.' : 'No matching records.'}
                </p>
              </div>
            ) : (
              filteredCardList.map((labOrder) => (
                <div
                  key={labOrder._id}
                  className={`panel flex flex-col min-h-[280px] md:min-h-[300px] h-full w-full shadow-equal hover:shadow-equal-lg transition-shadow duration-200 ${
                    filteredCardList.length === 1 ? 'md:col-span-2' : 'md:col-span-1'
                  }`}
                >
                  <div className="mb-4 pb-3 border-b border-white-light dark:border-[#191e3a] shrink-0">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h5 className="font-semibold text-gray-900 dark:text-white truncate">
                          {orDash(labOrder.testName || labOrder.name)}
                        </h5>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {orDash(labOrder.orderDate)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAIClick(labOrder.labOrderId || labOrder._id)}
                        className="btn btn-sm btn-primary shrink-0"
                        aria-label="View AI explanation"
                        title="View AI Lab Report Explanation"
                      >
                        <IconSparkles className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 flex flex-col flex-1 min-h-0">
                    <div className="flex items-center justify-between gap-2 pt-2">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Status</span>
                      {(() => {
                        const raw = String(labOrder.status || labOrder.orderStatus || '').trim();
                        if (!raw) {
                          return <span className="text-sm text-gray-500 dark:text-gray-400">--</span>;
                        }
                        const lower = raw.toLowerCase();
                        return (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              lower === 'completed' || lower === 'closed' || lower === 'active'
                                ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                                : lower === 'pending'
                                  ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                            }`}
                          >
                            {raw}
                          </span>
                        );
                      })()}
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Provider
                      </span>
                      <p className="text-sm text-gray-900 dark:text-white mt-0.5">
                        {orDash(labOrder.providerName || labOrder.orderingProviderName)}
                      </p>
                    </div>
                    <div className="flex-1 min-h-0">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Notes
                      </span>
                      <p className="text-sm text-gray-900 dark:text-white mt-0.5 line-clamp-6">
                        {orDash(
                          labOrder.notes ?? labOrder.officeNotes ?? labOrder.patientContactNotes
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        {labOrder.labTests && Array.isArray(labOrder.labTests) && labOrder.labTests.length > 0
                          ? `Tests (${labOrder.labTests.length})`
                          : 'Tests'}
                      </span>
                      <p className="text-sm text-gray-900 dark:text-white mt-0.5">
                        {(() => {
                          const tests = labOrder.labTests;
                          if (!tests || !Array.isArray(tests) || tests.length === 0) {
                            return '--';
                          }
                          const names = tests.map((test: any) => test.name || test.testName).filter(Boolean);
                          return names.length ? names.join(', ') : '--';
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {paginatedCardList.length > rowsPerPage && (
            <div className="flex justify-center items-center gap-2 pt-1">
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
              >
                Previous
              </button>
              <span className="text-sm px-4">
                Page {currentPage} of {Math.ceil(paginatedCardList.length / rowsPerPage)}
              </span>
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= Math.ceil(paginatedCardList.length / rowsPerPage) || loading}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* AI Explanation Modal */}
      {showAIModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={handleCloseAIModal}
        >
          <div
            className="bg-white dark:bg-[#0e1726] rounded-lg shadow-xl max-w-3xl w-full flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 bg-primary text-white rounded-t-lg shrink-0">
              <h5 className="text-lg font-semibold">AI Lab Report Explanation</h5>
              <button
                type="button"
                onClick={handleCloseAIModal}
                className="p-1.5 rounded hover:bg-white/20 transition-colors"
                aria-label="Close"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingAI && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  <p className="text-gray-600 dark:text-gray-400">Generating lab report explanation...</p>
                </div>
              )}

              {aiError && (
                <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 mb-4">
                  <p className="text-danger font-semibold mb-2">Error</p>
                  <p className="text-danger/80 text-sm">{aiError}</p>
                </div>
              )}

              {!loadingAI && !aiError && labExplanation && (
                <div className="space-y-6">
                  {labExplanation.explanations && labExplanation.explanations.length > 0 ? (
                    labExplanation.explanations.map((explanation, index) => (
                      <div key={index} className="panel p-5 border border-white-light dark:border-[#191e3a]">
                        {explanation.testName && (
                          <h6 className="text-primary text-lg font-semibold mb-3 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                            </svg>
                            {explanation.testName}
                          </h6>
                        )}
                        {explanation.plainLanguageExplanation && (
                          <div className="mt-4">
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                              {explanation.plainLanguageExplanation}
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <p>No explanation available for this lab order.</p>
                    </div>
                  )}
                </div>
              )}

              {!loadingAI && !aiError && !labExplanation && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>No data available.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabOrders;
