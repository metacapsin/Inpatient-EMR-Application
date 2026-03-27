import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { patientDataAPI } from '../../services/api';
import { usePatientId } from '../../hooks/usePatientId';
import { format } from 'date-fns';
import { FaSyringe, FaDownload } from 'react-icons/fa';
import IconSearch from '../../components/Icon/IconSearch';

interface ImmunizationRecord {
  _id: string;
  vaccine?: string;
  vaccineName?: string;
  type?: string;
  vaccineType?: string;
  dose?: string;
  doseNumber?: string;
  unit?: string;
  routes?: string;
  route?: string;
  numberInSeries?: string;
  consentObtained?: string;
  comments?: string;
  comment?: string;
  orderedDate?: string;
  orderedTime?: string;
  administrationDate?: string;
  provider?: string;
  serviceLocation?: string;
  providerId?: {
    name?: string;
  };
  [key: string]: any;
}

const Immunizations: React.FC = () => {
  const patientId = usePatientId();
  const [immunizationsList, setImmunizationsList] = useState<ImmunizationRecord[]>([]);
  const [filteredTableList, setFilteredTableList] = useState<ImmunizationRecord[]>([]);
  const [paginatedCardList, setPaginatedCardList] = useState<ImmunizationRecord[]>([]);
  const [filteredCardList, setFilteredCardList] = useState<ImmunizationRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(2);

  const formatTime = (val: any): string => {
    if (val == null || val === '') return '';
    if (typeof val === 'string') {
      const s = val.trim();
      if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(s)) return s;
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
        const [h, m] = s.split(':').map(Number);
        const d = new Date(2000, 0, 1, h || 0, m || 0);
        return format(d, 'hh:mm a');
      }
    }
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return format(d, 'hh:mm a');
    } catch {}
    return String(val);
  };

  const normalizeRecord = (item: any): ImmunizationRecord => {
    const fallback = (): ImmunizationRecord => ({
      _id: (item && item._id) || 'unknown',
      vaccine: '',
      type: '',
      dose: '',
      unit: '',
      routes: '',
      numberInSeries: '',
      consentObtained: '',
      comments: '—',
      orderedDate: '',
      orderedTime: '',
      provider: '',
      serviceLocation: '',
    });
    if (!item || typeof item !== 'object') return fallback();
    try {
      const dt = item.orderedDate || item.administrationDate;
      let orderedDate = '';
      let orderedTime = (item.orderedTime != null && item.orderedTime !== '') ? formatTime(item.orderedTime) : '';
      if (dt) {
        try {
          const s = String(dt).trim();
          let d: Date;
          if (s.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
            const [a, b, c] = s.split('/').map((x) => parseInt(x, 10));
            d = new Date(c, a - 1, b);
          } else {
            d = new Date(s);
          }
          if (!isNaN(d.getTime())) {
            orderedDate = format(d, 'MM/dd/yyyy');
            if (!orderedTime) orderedTime = format(d, 'hh:mm a');
          }
        } catch {}
        if (!orderedDate && typeof item.orderedDate === 'string' && item.orderedDate.trim()) orderedDate = item.orderedDate;
      }
      if (!orderedTime && typeof item.orderedTime === 'string' && item.orderedTime.trim()) orderedTime = item.orderedTime;

      const provider =
        typeof item.providerId === 'object' && item.providerId != null && item.providerId.name != null
          ? String(item.providerId.name).trim()
          : (item.provider || (typeof item.providerId === 'string' ? item.providerId : ''));
      const serviceLocation =
        typeof item.serviceLocation === 'object' && item.serviceLocation != null && item.serviceLocation.name != null
          ? String(item.serviceLocation.name)
          : (item.serviceLocation || '');
      const consentObtained = Array.isArray(item.consentObtained)
        ? item.consentObtained.join(', ')
        : (item.consentObtained ?? '');

      return {
        ...item,
        vaccine: String(item.vaccineText || item.vaccineName || item.vaccine || '').trim(),
        type: String(item.vaccineType || item.type || '').trim(),
        dose: item.dose != null ? String(item.dose) : (item.doseNumber != null ? String(item.doseNumber) : ''),
        unit: item.unit != null ? String(item.unit) : '',
        routes: String(item.routes || item.route || '').trim(),
        numberInSeries: item.numberInSeries != null ? String(item.numberInSeries) : '',
        consentObtained,
        comments: item.comments != null ? String(item.comments) : (item.comment != null ? String(item.comment) : ''),
        orderedDate: orderedDate || (typeof item.orderedDate === 'string' ? String(item.orderedDate).trim() : ''),
        orderedTime: orderedTime || (typeof item.orderedTime === 'string' ? String(item.orderedTime).trim() : ''),
        provider,
        serviceLocation,
      };
    } catch {
      return fallback();
    }
  };

  const updatePaginatedList = useCallback((data: ImmunizationRecord[], page: number) => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    setFilteredCardList(data.slice(start, end));
  }, [rowsPerPage]);

  const getPatientImmunizations = useCallback(async () => {
    const pid = patientId;
    if (!pid) {
      toast.error('Patient ID is required');
      return;
    }
    setLoading(true);
    try {
      const response = await patientDataAPI.getPatientImmunizationList(pid);
      if (response.data?.data || Array.isArray(response.data)) {
        const raw = response.data?.data || response.data;
        const list = Array.isArray(raw) ? raw : [];
        const formattedData = list.map((item: any) => normalizeRecord(item));
        setImmunizationsList(formattedData);
      } else {
        setImmunizationsList([]);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch immunizations');
      setImmunizationsList([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    getPatientImmunizations();
  }, [getPatientImmunizations]);

  useEffect(() => {
    if (!searchText || !searchText.trim()) {
      setFilteredTableList([...immunizationsList]);
      setPaginatedCardList([...immunizationsList]);
      setCurrentPage(1);
      updatePaginatedList([...immunizationsList], 1);
      return;
    }
    const search = searchText.toLowerCase().trim();
    const contains = (v: any) =>
      v != null && v !== '' && String(v).toLowerCase().includes(search);
    const filtered = immunizationsList.filter(
      (item) =>
        contains(item.vaccine) ||
        contains(item.type) ||
        contains(item.dose) ||
        contains(item.unit) ||
        contains(item.routes) ||
        contains(item.numberInSeries) ||
        contains(item.consentObtained) ||
        contains(item.comments) ||
        contains(item.orderedDate) ||
        contains(item.orderedTime) ||
        contains(item.provider) ||
        contains(item.serviceLocation)
    );
    setFilteredTableList(filtered);
    setPaginatedCardList(filtered);
    setCurrentPage(1);
    updatePaginatedList(filtered, 1);
  }, [searchText, immunizationsList, updatePaginatedList]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updatePaginatedList(paginatedCardList, page);
  };

  const handleDownload = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await patientDataAPI.downloadImmunization(id);
      const blob = res.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `immunization-${id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Download failed');
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
            <li className="text-gray-900 dark:text-white font-medium">Immunizations</li>
          </ul>
        </div>

        {/* Page Header */}
        <div className="mb-5">
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
    
    {/* Left Section */}
    <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1">
      
      {/* Title + Icon */}
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-primary/10">
          <FaSyringe className="w-5 h-5 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">
          Immunizations
        </h3>
      </div>

      {/* Search */}
      <div className="relative w-full md:max-w-md">
        <input
          type="text"
          className="form-input pl-10 w-full"
          placeholder="Search immunizations..."
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
              <div className="col-span-full flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span>Loading immunizations...</span>
              </div>
            ) : filteredCardList.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 gap-2 text-gray-500 rounded-xl border border-dashed border-white-light dark:border-dark">
                <FaSyringe className="w-12 h-12 text-gray-300" />
                <p className="font-medium text-gray-600 dark:text-gray-400">
                  {immunizationsList.length === 0
                    ? 'No immunizations recorded for this patient.'
                    : 'No matching records.'}
                </p>
              </div>
            ) : (
              filteredCardList.map((r) => (
                <div key={r._id} className="panel md:col-span-1 shadow-equal hover:shadow-equal-lg transition-shadow duration-200">
                  <div className="mb-4 pb-3 border-b border-white-light dark:border-[#191e3a]">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h5 className="text-base font-bold text-gray-900 dark:text-white">
                          {(r.vaccine || r.vaccineText) || '—'}
                        </h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                          {(r.type || r.vaccineType) || '—'}
                        </p>
                      </div>
                      {/* <button
                        type="button"
                        onClick={(e) => handleDownload(r._id, e)}
                        className="btn btn-sm btn-primary"
                        aria-label="Download"
                      >
                        <FaDownload />
                      </button> */}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <span className="font-semibold text-gray-600 dark:text-gray-400">Ordered Date:</span>{' '}
                      <span className="text-gray-900 dark:text-white">{(r.orderedDate || r.orderedDate) || '—'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-600 dark:text-gray-400">Ordered Time:</span>{' '}
                      <span className="text-gray-900 dark:text-white">{(r.orderedTime || r.orderedTime) || '—'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-600 dark:text-gray-400">Provider:</span>{' '}
                      <span className="text-gray-900 dark:text-white">
                        {(r.provider || (r.providerId && r.providerId.name ? String(r.providerId.name).trim() : '')) || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-600 dark:text-gray-400">Service Location:</span>{' '}
                      <span className="text-gray-900 dark:text-white">
                        {typeof r.serviceLocation === 'string'
                          ? r.serviceLocation
                          : r.serviceLocation && typeof r.serviceLocation === 'object' && (r.serviceLocation as { name?: string }).name
                            ? String((r.serviceLocation as { name?: string }).name)
                            : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-600 dark:text-gray-400">Dose:</span>{' '}
                      <span className="text-gray-900 dark:text-white">{(r.dose ?? r.doseNumber) || '—'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-600 dark:text-gray-400">Unit:</span>{' '}
                      <span className="text-gray-900 dark:text-white">{r.unit || '—'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-600 dark:text-gray-400">Routes:</span>{' '}
                      <span className="text-gray-900 dark:text-white">{(r.routes || r.route) || '—'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-600 dark:text-gray-400">Number In Series:</span>{' '}
                      <span className="text-gray-900 dark:text-white">{r.numberInSeries || '—'}</span>
                    </div>
                  </div>
                  {(r.consentObtained || r.comments) && (
                    <div className="mt-4 pt-4 border-t border-white-light dark:border-[#191e3a] bg-primary/5 p-3 rounded">
                      <div className="space-y-2 text-sm text-white">
                        {r.consentObtained && (
                          <p>
                            <span className="font-semibold text-gray-600 dark:text-gray-400">Consent Obtained:</span>{' '}
                            <span className="opacity-90 text-gray-900 dark:text-white">
                              {r.consentObtained || (Array.isArray(r.consentObtained) ? r.consentObtained.join(', ') : '') || '—'}
                            </span>
                          </p>
                        )}
                        {r.comments && (
                          <p>
                            <span className="font-semibold text-gray-600 dark:text-gray-400">Comments:</span>{' '}
                            <span className="opacity-90 text-gray-900 dark:text-white">
                              {(r.comments != null && String(r.comments).trim() !== '') ? r.comments : '—'}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
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
    </div>
  );
};

export default Immunizations;
