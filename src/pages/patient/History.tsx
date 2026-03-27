import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { patientDataAPI } from '../../services/api';
import { format } from 'date-fns';
import { FaHistory, FaClock, FaTags, FaCalendarAlt, FaStickyNote, FaEye } from 'react-icons/fa';
import IconSearch from '../../components/Icon/IconSearch';
import IconX from '../../components/Icon/IconX';

interface HistoryRecord {
  _id: string;
  category?: {
    name: string;
    _id?: string;
  };
  categoryName?: string;
  conditions: string;
  diagonosisDate: string;
  notes?: string;
  filterDate?: Date;
  [key: string]: any;
}

const History: React.FC = () => {
  const [historyList, setHistoryList] = useState<HistoryRecord[]>([]);
  const [filteredTableList, setFilteredTableList] = useState<HistoryRecord[]>([]);
  const [filteredCardList, setFilteredCardList] = useState<HistoryRecord[]>([]);
  const [paginatedCardList, setPaginatedCardList] = useState<HistoryRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(2);
  const [viewHistoryDialog, setViewHistoryDialog] = useState(false);
  const [historyDetails, setHistoryDetails] = useState<HistoryRecord | null>(null);

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return format(date, 'MM/dd/yyyy');
    } catch {
      return dateString;
    }
  };

  const getPatientId = (): string => {
    const currentUser = localStorage.getItem('user')
      ? JSON.parse(localStorage.getItem('user') || '{}')
      : {};
    return currentUser.patientId || currentUser.rcopiaID || '';
  };

  const fetchHistory = async () => {
    const patientId = getPatientId();
    if (!patientId) {
      toast.error('Patient ID is required to fetch history.');
      return;
    }

    setLoading(true);
    try {
      const response = await patientDataAPI.getAllPatientHistory(patientId);
      if (response.data?.data || Array.isArray(response.data)) {
        const data = response.data?.data || response.data;
        const formattedData = data.map((item: any) => ({
          ...item,
          categoryName: item.category?.name || item.categoryName || '',
          diagonosisDate: formatDate(item.diagonosisDate),
          filterDate: item.diagonosisDate ? new Date(item.diagonosisDate) : null,
        }));

        // Sort by diagnosis date (latest first)
        formattedData.sort((a: HistoryRecord, b: HistoryRecord) => {
          if (!a.filterDate || !b.filterDate) return 0;
          if (!a.filterDate) return 1;
          if (!b.filterDate) return -1;
          return b.filterDate.getTime() - a.filterDate.getTime();
        });

        setHistoryList(formattedData);
        setFilteredTableList(formattedData);
        setPaginatedCardList(formattedData);
        updatePaginatedList(formattedData, 1);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch patient history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    filterData();
  }, [searchText, historyList]);

  const filterData = () => {
    if (!searchText || searchText.trim() === '') {
      setFilteredTableList([...historyList]);
      setPaginatedCardList([...historyList]);
      updatePaginatedList(historyList, 1);
    } else {
      const filtered = historyList.filter((item) => matchesSearch(item));
      setFilteredTableList(filtered);
      setPaginatedCardList(filtered);
      updatePaginatedList(filtered, 1);
    }
  };

  const matchesSearch = (item: HistoryRecord): boolean => {
    const search = searchText.toLowerCase().trim();
    const containsSearchText = (value: any) =>
      value?.toString().toLowerCase().includes(search);

    return (
      containsSearchText(item.categoryName) ||
      containsSearchText(item.conditions) ||
      containsSearchText(item.diagonosisDate) ||
      containsSearchText(item.notes)
    );
  };

  const updatePaginatedList = (data: HistoryRecord[], page: number = currentPage) => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    setFilteredCardList(data.slice(start, end));
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updatePaginatedList(paginatedCardList, page);
  };

  const openHistoryDetails = async (id: string) => {
    try {
      const response = await patientDataAPI.getPatientHistoryById(id);
      if (response.data?.data) {
        const data = response.data.data;
        setHistoryDetails({
          ...data,
          categoryName: data.category?.name || '',
          diagonosisDate: formatDate(data.diagonosisDate),
        });
        setViewHistoryDialog(true);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch history details.');
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
            <li className="text-gray-900 dark:text-white font-medium">History</li>
          </ul>
        </div>

        {/* Page Header */}
        <div className="mb-5">
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
    
    {/* Left Section */}
    <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1">
      
      <h3 className="text-xl font-semibold">
        History
      </h3>

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

  </div>
</div>

        {/* Card View */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              <div className="col-span-full text-center py-4">Loading...</div>
            ) : filteredCardList.length === 0 ? (
              <div className="col-span-full text-center mt-2">
                {historyList.length === 0
                  ? 'No history found for the patient.'
                  : 'No record found.'}
              </div>
            ) : (
              filteredCardList.map((history) => (
                <div key={history._id} className="panel shadow-equal hover:shadow-equal-lg transition-shadow duration-200">
                  <div className="mb-4 pb-3 border-b border-white-light dark:border-[#191e3a] flex items-start justify-between gap-2">
                    <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-0">
                      {history.conditions || 'History Record'}
                    </h4>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary p-2 shrink-0"
                      onClick={() => openHistoryDetails(history._id)}
                      title="View History"
                      aria-label="View History"
                    >
                      <FaEye className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex gap-2">
                        <FaTags className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">Category:</div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                            {history.categoryName
                              ? history.categoryName.charAt(0).toUpperCase() + history.categoryName.slice(1)
                              : '--'}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <FaCalendarAlt className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">Diagnosis Date:</div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                            {history.diagonosisDate || '--'}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <FaStickyNote className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">Comments:</div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                          {history.notes && history.notes.length > 120
                            ? history.notes.slice(0, 120) + '...'
                            : history.notes || '--'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            {paginatedCardList.length > rowsPerPage && (
              <div className="col-span-full flex justify-center items-center gap-2 mt-4">
                <button
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

      {/* View History Details Modal */}
      {viewHistoryDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
<div className="max-w-3xl w-full bg-white dark:bg-[#0e1726] rounded-lg shadow-xl flex flex-col max-h-[90vh]">       
     <div className="flex items-center justify-between p-4 bg-primary text-white rounded-t-lg shrink-0">
  <h5 className="text-lg font-semibold">History Details</h5>
  <button
    type="button"
    onClick={() => setViewHistoryDialog(false)}
    className="p-1.5 rounded hover:bg-white/20 transition-colors"
    aria-label="Close"
  >
    <IconX className="w-5 h-5" />
  </button>
</div>
            {historyDetails && (
             <div className="flex-1 overflow-auto p-5 space-y-5">

             {/* History Info */}
             <div className="panel p-4 border border-white-light dark:border-[#191e3a]">
               <div className="flex items-center gap-2 mb-3">
                 <h6 className="text-primary text-sm font-semibold uppercase">
                   History Information
                 </h6>
               </div>
           
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                 <div>
                   <span className="text-gray-600 dark:text-gray-400">Category:</span>
                   <p className="font-bold text-gray-900 dark:text-white">
                     {historyDetails.category?.name || historyDetails.categoryName || '--'}
                   </p>
                 </div>
           
                 <div>
                   <span className="text-gray-600 dark:text-gray-400">Condition:</span>
                   <p className="font-bold text-gray-900 dark:text-white">
                     {historyDetails.conditions || '--'}
                   </p>
                 </div>
           
                 <div>
                   <span className="text-gray-600 dark:text-gray-400">Diagnosis Date:</span>
                   <p className="font-bold text-gray-900 dark:text-white">
                     {historyDetails.diagonosisDate || '--'}
                   </p>
                 </div>
               </div>
             </div>
           
             {/* Comments */}
             <div className="panel p-4 border border-white-light dark:border-[#191e3a]">
               <div className="flex items-center gap-2 mb-3">
                 <h6 className="text-primary text-sm font-semibold uppercase">
                   Comments
                 </h6>
               </div>
           
               <div className="text-sm text-gray-900 dark:text-white">
                 {historyDetails.notes || (
                   <span className="text-gray-400">No comments available</span>
                 )}
               </div>
             </div>
           
           </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
