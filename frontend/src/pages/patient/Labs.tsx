import React, { useState, useEffect, useCallback } from 'react';
import { usePatientId } from '../../hooks/usePatientId';
import { useFacesheetChartLayout } from '../../hooks/useFacesheetChartLayout';
import { format } from 'date-fns';
import { FaFlask } from 'react-icons/fa';
import IconSearch from '../../components/Icon/IconSearch';
import { ModuleErrorState } from '../../components/facesheet/ModuleErrorState';
import { flagClass, flagLabel, listPatientResults } from '../../services/labs.service';

interface LabRecord {
  _id: string;
  testName?: string;
  testDate?: string;
  labName?: string;
  result?: string;
  abnormalFlag?: string;
  isCritical?: boolean;
  acknowledgedAt?: string;
  comment?: string;
  [key: string]: any;
}

const Labs: React.FC = () => {
  const patientId = usePatientId();
  const { moduleSurfaceClass } = useFacesheetChartLayout();

  const [labsList, setLabsList] = useState<LabRecord[]>([]);
  const [paginatedCardList, setPaginatedCardList] = useState<LabRecord[]>([]);
  const [filteredCardList, setFilteredCardList] = useState<LabRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(2);

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MM/dd/yyyy');
    } catch {
      return dateString;
    }
  };

  /** Structured results entered against lab orders (lab_results table) — the only lab store now;
   * BUG-13 retired the separate free-text `lab_documents` store this tab used to also display. */
  const normalizeStructured = (r: any): LabRecord => ({
    ...r,
    _id: r.id,
    testName: r.testName || '—',
    testDate: r.resultedAt ? formatDate(r.resultedAt) : '—',
    labName: r.accessionNumber ? `Accession ${r.accessionNumber}` : 'In-house',
    result: `${r.value ?? ''}${r.unit ? ` ${r.unit}` : ''}${r.referenceRange ? ` (ref ${r.referenceRange})` : ''}`,
    abnormalFlag: r.abnormalFlag,
    isCritical: r.isCritical,
    acknowledgedAt: r.acknowledgedAt,
    comment: r.comment,
  });

  const updatePaginatedList = useCallback((data: LabRecord[], page: number) => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    setFilteredCardList(data.slice(start, end));
  }, [rowsPerPage]);

  const getPatientLabs = useCallback(async () => {
    if (!patientId) return;

    setLoading(true);
    setLoadError(null);

    try {
      const structured = await listPatientResults(patientId);
      setLabsList(structured.map(normalizeStructured));
    } catch (error: any) {
      setLoadError(error?.response?.data?.message || 'Failed to fetch lab results');
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

  return (
    <div className={moduleSurfaceClass}>
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
          aria-label="Search lab results" placeholder="Search labs..."
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
        {loadError ? (
          <ModuleErrorState message={loadError} onRetry={() => void getPatientLabs()} retrying={loading} />
        ) : loading ? (
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
                  <p className="text-xs">{lab.testDate} · {lab.labName}</p>
                </div>

                <div className="flex gap-2">
                  <span className={`inline-flex h-fit rounded-full px-2 py-0.5 text-xs font-semibold ${flagClass(lab.abnormalFlag ?? 'N', lab.isCritical)}`}>
                    {lab.isCritical ? 'CRITICAL · ' : ''}{flagLabel(lab.abnormalFlag ?? 'N')}
                  </span>
                </div>
              </div>

              <p className="text-sm font-medium">{lab.result}</p>
              {lab.isCritical ? (
                <p className={`mt-1 text-xs ${lab.acknowledgedAt ? 'text-emerald-700' : 'text-red-700'}`}>{lab.acknowledgedAt ? `Acknowledged ${formatDate(lab.acknowledgedAt)}` : 'Critical value — not yet acknowledged'}</p>
              ) : null}
              {lab.comment ? <p className="mt-1 whitespace-pre-wrap text-xs text-gray-500">{lab.comment}</p> : null}
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

    </div>
  );
};

export default Labs;
