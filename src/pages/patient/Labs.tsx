import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { patientDataAPI, aiHealthInsightsAPI } from '../../services/api';
import { usePatientId } from '../../hooks/usePatientId';
import { format } from 'date-fns';
import { FaFlask, FaDownload, FaTimes, FaEye } from 'react-icons/fa';
import { FaWandMagicSparkles } from 'react-icons/fa6';
import IconSearch from '../../components/Icon/IconSearch';

interface LabRecord {
  _id: string;
  name?: string;
  notes?: string;
  result?: string;
  status?: boolean;
  statusDisplay?: string;
  testName?: string;
  testDate?: string;
  labName?: string;
  date?: string;
  createdOn?: string;
  [key: string]: any;
}

const Labs: React.FC = () => {
  const patientId = usePatientId();

  const [labsList, setLabsList] = useState<LabRecord[]>([]);
  const [paginatedCardList, setPaginatedCardList] = useState<LabRecord[]>([]);
  const [filteredCardList, setFilteredCardList] = useState<LabRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(2);

  const [labDetail, setLabDetail] = useState<LabRecord | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [showExplanationPopup, setShowExplanationPopup] = useState(false);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [selectedLabName, setSelectedLabName] = useState('');

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MM/dd/yyyy');
    } catch {
      return dateString;
    }
  };

  const normalizeRecord = (item: any): LabRecord => ({
    ...item,
    _id: item.id ?? item._id ?? 'unknown',
    testName: item.name || '—',
    testDate: item.date ? formatDate(item.date) : '—',
    labName: item.labName || '—',
    result: item.value ? `${item.value}${item.unit ? ` ${item.unit}` : ''}` : item.notes || '—',
    statusDisplay: item.status ? 'Active' : 'Inactive',
  });

  const updatePaginatedList = useCallback((data: LabRecord[], page: number) => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    setFilteredCardList(data.slice(start, end));
  }, [rowsPerPage]);

  const getPatientLabs = useCallback(async () => {
    if (!patientId) return;

    setLoading(true);

    try {
      const response = await patientDataAPI.getAllLabDocuments(patientId);
      const raw = response.data?.data ?? response.data;

      const formatted = raw.map((item: any) => normalizeRecord(item));

      setLabsList(formatted);
    } catch {
      toast.error('Failed to fetch lab documents');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    getPatientLabs();
  }, [getPatientLabs]);

  useEffect(() => {
    if (!searchText || searchText.trim() === '') {
      setPaginatedCardList([...labsList]);
      setCurrentPage(1);
      updatePaginatedList([...labsList], 1);
      return;
    }

    const search = searchText.toLowerCase();
    const filtered = labsList.filter(
      (lab) =>
        lab.testName?.toLowerCase().includes(search) ||
        lab.result?.toLowerCase().includes(search) ||
        lab.labName?.toLowerCase().includes(search)
    );
    setPaginatedCardList(filtered);
    setCurrentPage(1);
    updatePaginatedList(filtered, 1);
  }, [searchText, labsList, updatePaginatedList]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updatePaginatedList(paginatedCardList, page);
  };

  const handleViewDetail = async (id: string) => {
    if (!patientId) return;

    setLoadingDetail(true);

    try {
      const res = await patientDataAPI.getLabDocumentById(id);
      const raw = res.data?.data ?? res.data;

      setLabDetail(normalizeRecord(raw));
    } catch {
      toast.error('Failed to load lab result details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const res = await patientDataAPI.downloadLabDocument(id);

      const blob = res.data as Blob;
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `lab-${id}.pdf`;
      a.click();

      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  const handleExplainLab = async (labId: string, labName: string) => {
    setSelectedLabName(labName);
    setShowExplanationPopup(true);
    setExplanationLoading(true);

    try {
      const res = await aiHealthInsightsAPI.explainLabReport({ labId });

      setExplanation(
        res.data?.data?.explanations?.[0]?.plainLanguageExplanation ||
          'No explanation available.'
      );
    } catch {
      toast.error('Failed to generate explanation');
    } finally {
      setExplanationLoading(false);
    }
  };

  return (
    <div className="panel">
       {/* Breadcrumb */}
       <div className="mb-5">
          <ul className="flex items-center gap-2 text-sm">
            <li>
              <a href="#" className="text-primary hover:underline">Patient List</a>
            </li>
            <li>/</li>
            <li className="text-gray-900 dark:text-white font-medium">Lab Results</li>
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
          <FaFlask className="w-5 h-5 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">
          Lab Results
        </h3>
      </div>

      {/* Search */}
      <div className="relative w-full md:max-w-md">
        <input
          type="text"
          className="form-input pl-10 w-full"
          placeholder="Search labs..."
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

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start auto-rows-min">
        {loading ? (
          <div className="col-span-full text-center py-4">Loading...</div>
        ) : filteredCardList.length === 0 ? (
          <div className="col-span-full text-center mt-2">
            {labsList.length === 0 ? 'No lab results for this patient.' : 'No matching records.'}
          </div>
        ) : (
          filteredCardList.map((lab) => (
            <div
              key={lab._id}
              className={`panel h-fit self-start w-full ${filteredCardList.length === 1 ? 'md:col-span-2' : 'md:col-span-1'}`}
            >
              <div className="flex justify-between mb-3">
                <div>
                  <h5 className="font-semibold">{lab.testName}</h5>
                  <p className="text-xs">{lab.testDate}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => handleViewDetail(lab._id)}
                  >
                    <FaEye />
                  </button>

                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() =>
                      handleExplainLab(lab._id, lab.testName || '')
                    }
                  >
                    <FaWandMagicSparkles />
                  </button>

                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleDownload(lab._id)}
                  >
                    <FaDownload />
                  </button>
                </div>
              </div>

              <p className="text-sm">{lab.result}</p>
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

      {showExplanationPopup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
          <div className="bg-white p-6 max-w-2xl rounded-lg">
            <div className="flex justify-between mb-3">
              <h4 className="font-semibold">
                AI Explanation — {selectedLabName}
              </h4>
              <button onClick={() => setShowExplanationPopup(false)}>
                <FaTimes />
              </button>
            </div>

            {explanationLoading ? (
              <p>Generating explanation...</p>
            ) : (
              <p>{explanation}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Labs;