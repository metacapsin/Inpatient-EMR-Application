import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { patientDataAPI, aiHealthInsightsAPI } from '../../services/api';
import { format } from 'date-fns';
import { FaUserCheck, FaCalendarAlt, FaMapMarkerAlt, FaList, FaTimes } from 'react-icons/fa';
import IconSparkles from '../../components/Icon/IconSparkles';
import IconSearch from '../../components/Icon/IconSearch';

interface ScreeningRecord {
  _id: string;
  patientId?: string;
  screeningPatientName?: string;
  screeningDate?: string;
  screeningPatientAge?: number;
  screeningPatientEmail?: string;
  screeningCountryOfBirth?: string;
  screeningType?: string[];
  screeningProvider?: string;
  screeningsLocation?: string;
  screeningFollowupDate?: string;
  screeningStatus?: string;
  counsellingProvided?: boolean;
  screenings?: Array<{ screeningName?: string; [key: string]: any }>;
  [key: string]: any;
}

const PreventiveScreening: React.FC = () => {
  const [list, setList] = useState<ScreeningRecord[]>([]);
  const [filteredTableList, setFilteredTableList] = useState<ScreeningRecord[]>([]);
  const [paginatedCardList, setPaginatedCardList] = useState<ScreeningRecord[]>([]);
  const [filteredCardList, setFilteredCardList] = useState<ScreeningRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(2);

  // AI Preventive Suggestions states
  const [showAISuggestionsModal, setShowAISuggestionsModal] = useState(false);
  const [preventiveSuggestions, setPreventiveSuggestions] = useState<any>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString || !String(dateString).trim()) return '';
    const s = String(dateString).trim();
    try {
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
        const [a, b, c] = s.split('/').map((x) => parseInt(x, 10));
        const d = new Date(c, a - 1, b);
        return isNaN(d.getTime()) ? s : format(d, 'MM/dd/yyyy');
      }
      const d = new Date(s);
      return isNaN(d.getTime()) ? s : format(d, 'MM/dd/yyyy');
    } catch {
      return s;
    }
  };

  const formatDateLong = (dateString: string | undefined | null): string => {
    if (!dateString || !String(dateString).trim()) return '--';
    const s = String(dateString).trim();
    try {
      let d: Date;
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
        const [a, b, c] = s.split('/').map((x) => parseInt(x, 10));
        d = new Date(c, a - 1, b);
      } else {
        d = new Date(s);
      }
      return isNaN(d.getTime()) ? s : format(d, 'EEE, MMM dd, yyyy');
    } catch {
      return s;
    }
  };

  const getScreeningTypes = (r: ScreeningRecord): string[] => {
    const fromScreenings = (r.screenings || [])
      .map((s) => s.screeningName)
      .filter((n): n is string => typeof n === 'string' && n.trim() !== '');
    if (fromScreenings.length) return fromScreenings;
    return (r.screeningType || []).map((t) => String(t).replace(/_/g, ' ').trim()).filter(Boolean);
  };

  const orDash = (v: any): string => (v != null && String(v).trim() !== '' ? String(v).trim() : '—');

  const getLocationDisplay = (loc: any): string => {
    if (loc == null) return '—';
    if (typeof loc === 'string' && loc.trim() !== '') return loc.trim();
    if (typeof loc === 'object' && loc.name != null && String(loc.name).trim() !== '') return String(loc.name).trim();
    return '—';
  };

  const updatePaginatedList = useCallback((data: ScreeningRecord[], page: number) => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    setFilteredCardList(data.slice(start, end));
  }, [rowsPerPage]);

  const getPatientScreenings = useCallback(async () => {
    const currentUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    const patientId =
      currentUser.patientId ||
      currentUser.rcopiaID ||
      currentUser.user?.patientId ||
      currentUser.user?.rcopiaID;

    if (!patientId) {
      toast.error('Patient ID is required');
      return;
    }

    setLoading(true);
    try {
      const response = await patientDataAPI.getScreeningsByPatientId(patientId);
      const raw = response.data?.data ?? (Array.isArray(response.data) ? response.data : []);
      const arr = Array.isArray(raw) ? raw : [];
      setList(arr);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch screenings');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getPatientScreenings();
  }, [getPatientScreenings]);

  useEffect(() => {
    if (!searchText || !searchText.trim()) {
      setFilteredTableList([...list]);
      setPaginatedCardList([...list]);
      setCurrentPage(1);
      updatePaginatedList([...list], 1);
      return;
    }
    const search = searchText.toLowerCase().trim();
    const ok = (v: any) => v != null && v !== '' && String(v).toLowerCase().includes(search);
    const filtered = list.filter((r) => {
      const types = getScreeningTypes(r);
      return (
        ok(r.screeningPatientName) ||
        ok(r.screeningPatientAge) ||
        ok(r.screeningDate) ||
        ok(r.screeningStatus) ||
        ok(getLocationDisplay(r.screeningsLocation)) ||
        ok(r.screeningFollowupDate) ||
        types.some((t) => ok(t))
      );
    });
    setFilteredTableList(filtered);
    setPaginatedCardList(filtered);
    setCurrentPage(1);
    updatePaginatedList(filtered, 1);
  }, [searchText, list, updatePaginatedList]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updatePaginatedList(paginatedCardList, page);
  };

  const parseActionJSON = (actionString: string): any[] => {
    try {
      // Try to extract JSON array from the action string
      const jsonMatch = actionString.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      // If no JSON array found, try parsing the whole string
      return JSON.parse(actionString);
    } catch (error) {
      console.error('Error parsing action JSON:', error);
      return [];
    }
  };

  const handleGetAISuggestions = async () => {
    const currentUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    const patientId =
      currentUser.patientId ||
      currentUser.rcopiaID ||
      currentUser.user?.patientId ||
      currentUser.user?.rcopiaID;

    if (!patientId) {
      toast.error('Patient ID is required');
      return;
    }

    setShowAISuggestionsModal(true);
    setLoadingAI(true);
    setAiError(null);
    setPreventiveSuggestions(null);

    try {
      const response = await aiHealthInsightsAPI.getPreventiveSuggestions(patientId);
      const data = response.data?.data || response.data;
      
      // Process suggestions array if it exists
      if (data?.suggestions && Array.isArray(data.suggestions)) {
        // Parse action field in each suggestion
        data.suggestions = data.suggestions.map((suggestion: any) => {
          if (suggestion?.action && typeof suggestion.action === 'string') {
            const parsedActions = parseActionJSON(suggestion.action);
            return {
              ...suggestion,
              parsedActions: parsedActions
            };
          }
          return suggestion;
        });
      } else if (data?.action && typeof data.action === 'string') {
        // Handle case where action is directly on the response
        const parsedActions = parseActionJSON(data.action);
        data.parsedActions = parsedActions;
      }
      
      setPreventiveSuggestions(data || {});
      toast.success('Preventive suggestions loaded successfully');
    } catch (error: any) {
      console.error('Error fetching preventive suggestions:', error);
      setAiError(error.response?.data?.message || 'Failed to fetch preventive suggestions. Please try again.');
      toast.error('Failed to fetch preventive suggestions');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleCloseAISuggestionsModal = () => {
    setShowAISuggestionsModal(false);
    setPreventiveSuggestions(null);
    setAiError(null);
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
            <li className="text-gray-900 dark:text-white font-medium">Preventive Screening</li>
          </ul>
        </div>

        {/* Page Header */}
        <div className="mb-5">
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
    
    {/* Left Section */}
    <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1">
      
      {/* Icon + Title */}
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-primary/10">
          <FaUserCheck className="w-5 h-5 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">
          Preventive Screening
        </h3>
      </div>

      {/* Search */}
      <div className="relative w-full md:max-w-md">
        <input
          type="text"
          className="form-input pl-10 w-full"
          placeholder="Search here"
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
        onClick={handleGetAISuggestions}
        className="btn btn-primary w-full md:w-auto flex items-center justify-center gap-2"
        title="Get AI Preventive Suggestions"
      >
        <IconSparkles className="w-4 h-4" />
        Get AI Suggestions
      </button>
    </div>

  </div>
</div>

        {/* Card View */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span>Loading screenings...</span>
              </div>
            ) : paginatedCardList.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 gap-2 text-gray-500 rounded-xl border border-dashed border-white-light dark:border-dark">
                <FaUserCheck className="w-12 h-12 text-gray-300" />
                <p className="font-medium text-gray-600 dark:text-gray-400">
                  {list.length === 0 ? 'No screenings for this patient.' : 'No matching records.'}
                </p>
              </div>
            ) : (
              filteredCardList.map((r) => {
                const types = getScreeningTypes(r);
                return (
                  <div key={r._id} className="panel md:col-span-1 shadow-equal hover:shadow-equal-lg transition-shadow duration-200">
                    <div className="mb-4 pb-3 border-b border-white-light dark:border-[#191e3a]">
                      <div className="flex items-center gap-2">
                        <FaUserCheck className="w-5 h-5 text-primary" />
                        <span className="font-semibold text-gray-900 dark:text-white">Screening Record</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-gray-900 dark:text-white">
                          {orDash(r.screeningPatientName)}
                          {r.screeningPatientAge != null && (
                            <span className="text-gray-600 dark:text-gray-400">, Age {r.screeningPatientAge} years</span>
                          )}
                        </p>
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                          {orDash(r.screeningStatus)}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="flex gap-3">
                          <FaCalendarAlt className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Screening Date
                            </p>
                            <p className="text-sm text-gray-900 dark:text-white mt-0.5">
                              {formatDateLong(r.screeningDate) || '--'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <FaCalendarAlt className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Follow-up Date
                            </p>
                            <p className="text-sm text-gray-900 dark:text-white mt-0.5">
                              {formatDate(r.screeningFollowupDate) || '--'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <FaMapMarkerAlt className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Location
                            </p>
                            <p className="text-sm text-gray-900 dark:text-white mt-0.5">
                              {getLocationDisplay(r.screeningsLocation) === '—' ? '--' : getLocationDisplay(r.screeningsLocation)}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <FaList className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Screening Types ({types.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {types.length
                                ? types.map((t, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary"
                                    >
                                      {t}
                                    </span>
                                  ))
                                : <span className="text-sm text-gray-500 dark:text-gray-400">--</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {paginatedCardList.length > rowsPerPage && (
              <div className="col-span-full flex justify-center items-center gap-2 mt-4">
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
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
                  disabled={currentPage >= Math.ceil(paginatedCardList.length / rowsPerPage)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Preventive Suggestions Modal */}
      {showAISuggestionsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={handleCloseAISuggestionsModal}
        >
          <div
            className="bg-white dark:bg-[#0e1726] rounded-lg shadow-xl max-w-3xl w-full flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 bg-primary text-white rounded-t-lg shrink-0">
              <h5 className="text-lg font-semibold flex items-center gap-2">
                <IconSparkles className="w-5 h-5" />
                AI Preventive Care Suggestions
              </h5>
              <button
                type="button"
                onClick={handleCloseAISuggestionsModal}
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
                  <p className="text-gray-600 dark:text-gray-400">Generating preventive care suggestions...</p>
                </div>
              )}

              {aiError && (
                <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 mb-4">
                  <p className="text-danger font-semibold mb-2">Error</p>
                  <p className="text-danger/80 text-sm">{aiError}</p>
                </div>
              )}

              {!loadingAI && !aiError && preventiveSuggestions && (
                <div className="space-y-6">
                  {/* Handle suggestions array */}
                  {preventiveSuggestions.suggestions && Array.isArray(preventiveSuggestions.suggestions) && preventiveSuggestions.suggestions.length > 0 ? (
                    preventiveSuggestions.suggestions.map((suggestion: any, suggestionIndex: number) => (
                      <div key={suggestionIndex} className="space-y-4">
                        {/* Suggestion Summary Card */}
                        <div className="panel p-5 border border-primary/20 bg-primary/5 dark:bg-primary/10">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h6 className="text-primary text-lg font-semibold mb-2 flex items-center gap-2">
                                <FaUserCheck className="w-5 h-5" />
                                {suggestion.category || 'Preventive Care Suggestions'}
                              </h6>
                              {suggestion.rationale && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                                  {suggestion.rationale}
                                </p>
                              )}
                            </div>
                            {suggestion.priority && (
                              <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium shrink-0 ${
                                suggestion.priority === 'high' ? 'bg-danger/10 text-danger' :
                                suggestion.priority === 'medium' ? 'bg-warning/10 text-warning' :
                                'bg-success/10 text-success'
                              }`}>
                                {suggestion.priority.charAt(0).toUpperCase() + suggestion.priority.slice(1)} Priority
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Parsed Actions from this suggestion */}
                        {suggestion.parsedActions && Array.isArray(suggestion.parsedActions) && suggestion.parsedActions.length > 0 ? (
                          <div className="space-y-4">
                            <h6 className="text-base font-semibold text-gray-900 dark:text-white">
                              Detailed Recommendations ({suggestion.parsedActions.length})
                            </h6>
                            {suggestion.parsedActions.map((item: any, index: number) => (
                              <div key={index} className="panel p-5 border border-white-light dark:border-[#191e3a] hover:border-primary/30 transition-colors">
                                <div className="flex items-start justify-between gap-4 mb-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold ${
                                      item.category === 'Screenings' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' :
                                      item.category === 'Vaccines' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                                      item.category === 'Lifestyle' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200' :
                                      'bg-primary/10 text-primary'
                                    }`}>
                                      {item.category || 'General'}
                                    </span>
                                    {item.priority && (
                                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                        item.priority === 'high' ? 'bg-danger/10 text-danger' :
                                        item.priority === 'medium' ? 'bg-warning/10 text-warning' :
                                        'bg-success/10 text-success'
                                      }`}>
                                        {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="space-y-3">
                                  {item.action && (
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Action:</p>
                                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                        {item.action}
                                      </p>
                                    </div>
                                  )}
                                  {item.rationale && (
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Rationale:</p>
                                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                                        {item.rationale}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                            <p>No detailed recommendations available for this suggestion.</p>
                          </div>
                        )}
                      </div>
                    ))
                  ) : preventiveSuggestions.parsedActions && Array.isArray(preventiveSuggestions.parsedActions) && preventiveSuggestions.parsedActions.length > 0 ? (
                    // Fallback: Handle direct parsedActions (old format)
                    <div className="space-y-4">
                      <h6 className="text-base font-semibold text-gray-900 dark:text-white">
                        Detailed Recommendations ({preventiveSuggestions.parsedActions.length})
                      </h6>
                      {preventiveSuggestions.parsedActions.map((item: any, index: number) => (
                        <div key={index} className="panel p-5 border border-white-light dark:border-[#191e3a] hover:border-primary/30 transition-colors">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-semibold bg-primary/10 text-primary">
                                {item.category || 'General'}
                              </span>
                              {item.priority && (
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                  item.priority === 'high' ? 'bg-danger/10 text-danger' :
                                  item.priority === 'medium' ? 'bg-warning/10 text-warning' :
                                  'bg-success/10 text-success'
                                }`}>
                                  {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            {item.action && (
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Action:</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                  {item.action}
                                </p>
                              </div>
                            )}
                            {item.rationale && (
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Rationale:</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                                  {item.rationale}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <p>No preventive suggestions available at this time.</p>
                    </div>
                  )}
                </div>
              )}

              {!loadingAI && !aiError && !preventiveSuggestions && (
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

export default PreventiveScreening;
