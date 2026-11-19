import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { patientDataAPI } from '../../services/api';
import { usePatientId } from '../../hooks/usePatientId';
import { useFacesheetChartLayout } from '../../hooks/useFacesheetChartLayout';
import { format } from 'date-fns';
import IconSearch from '../../components/Icon/IconSearch';

interface NoteRecord {
  _id: string;
  noteTitle?: string;
  noteType?: string;
  noteDate?: string;
  providerName?: string;
  assignedProvider?: {
    name?: string;
  };
  date?: string;
  time?: string;
  [key: string]: any;
}

const Notes: React.FC = () => {
  const patientId = usePatientId();
  const { moduleSurfaceClass } = useFacesheetChartLayout();
  const [notesList, setNotesList] = useState<NoteRecord[]>([]);
  const [filteredTableList, setFilteredTableList] = useState<NoteRecord[]>([]);
  const [filteredCardList, setFilteredCardList] = useState<NoteRecord[]>([]);
  const [paginatedCardList, setPaginatedCardList] = useState<NoteRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(2);


  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return format(date, 'MM/dd/yyyy');
    } catch {
      return dateString;
    }
  };

  const getPatientNotes = useCallback(async () => {
    if (!patientId) {
      toast.error('Patient ID is required');
      return;
    }

    setLoading(true);
    try {
      const response = await patientDataAPI.getPatientWiseNotesList({ patientId });
      if (response.data?.data || Array.isArray(response.data)) {
        const data = response.data?.data || response.data;
        const typeLabel: Record<string, string> = { hp: 'H&P', progress: 'Progress Note', discharge_summary: 'Discharge Summary', consult: 'Consult' };
        const formattedData = data.map((item: any) => ({
          ...item,
          _id: item.id ?? item._id,
          noteTitle: item.title || typeLabel[item.type] || item.type || 'Note',
          notesType: `${typeLabel[item.type] || item.type || ''}${item.status ? ` · ${item.status}` : ''}`,
          providerName: item.signedByName || item.createdByName || '',
          date: item.signedAt || item.createdAt ? formatDate(item.signedAt || item.createdAt) : '',
          noteDate: item.noteDate || item.createdAt ? formatDate(item.noteDate || item.createdAt) : '',
          sections: [
            ['HPI', item.content?.hpi],
            ['ROS', item.content?.ros],
            ['Assessment', item.content?.assessment],
            ['Plan', item.content?.plan],
          ].filter(([, v]) => typeof v === 'string' && v.trim()),
          addendaList: Array.isArray(item.addenda) ? item.addenda : [],
        }));
        setNotesList(formattedData);
        setPaginatedCardList(formattedData);
        setFilteredTableList(formattedData);
        setFilteredCardList(formattedData);
        updatePaginatedList(formattedData, 1);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch notes');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    getPatientNotes();
  }, [getPatientNotes]);

  useEffect(() => {
    filterData();
  }, [searchText, notesList]);

  const filterData = () => {
    if (!searchText || searchText.trim() === '') {
      setFilteredTableList([...notesList]);
      setPaginatedCardList([...notesList]);
      setFilteredCardList(notesList.slice(0, rowsPerPage));
    } else {
      const filtered = notesList.filter((item) => matchesSearch(item));
      setFilteredTableList(filtered);
      setPaginatedCardList(filtered);
      updatePaginatedList(filtered, 1);
    }
  };

  const matchesSearch = (item: NoteRecord): boolean => {
    const search = searchText.toLowerCase().trim();
    const containsSearchText = (value: any) =>
      value?.toString().toLowerCase().includes(search);

    return (
      containsSearchText(item.noteTitle) ||
      containsSearchText(item.noteType) ||
      containsSearchText(item.providerName) ||
      containsSearchText(item.noteDate)
    );
  };

  const updatePaginatedList = (data: NoteRecord[], page: number = currentPage) => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    setFilteredCardList(data.slice(start, end));
  };

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
            <li className="text-gray-900 dark:text-white font-medium">Notes</li>
          </ul>
        </div>

        {/* Page Header */}
        <div className="mb-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-3">Notes</h3>
              <div className="relative max-w-md">
                <input
                  type="text"
                  className="form-input pl-10"
                  aria-label="Search notes" placeholder="Search here"
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
                {notesList.length === 0
                  ? 'No notes recorded for patient.'
                  : 'No record found.'}
              </div>
            ) : (
              filteredCardList.map((note) => (
                <div key={note._id} className="panel md:col-span-1">
                  <div className="mb-4 pb-3 border-b border-white-light dark:border-[#191e3a]">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-base font-semibold flex-1 min-w-0 truncate">
                        {note.noteTitle || 'Note Record'}
                      </h5>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    <div>
                      <h6 className="text-primary text-sm uppercase font-semibold mb-2">
                        Note Details
                      </h6>
                      <div className="space-y-2">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Type:</span>
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">
                            {note.notesType || '---'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Provider:</span>
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">
                            {note.providerName || note.assignedProvider?.name || '---'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Date:</span>
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">
                            {note.date || '---'}
                          </span>
                        </div>
                        {Array.isArray(note.sections) && note.sections.length > 0 ? (
                          <dl className="mt-2 space-y-1.5 border-t border-white-light pt-2 dark:border-[#191e3a]">
                            {note.sections.map(([label, text]: [string, string]) => (
                              <div key={label}>
                                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
                                <dd className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{text}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                        {Array.isArray(note.addendaList) && note.addendaList.length > 0 ? (
                          <div className="mt-2 border-t border-white-light pt-2 dark:border-[#191e3a]">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Addenda</p>
                            {note.addendaList.map((a: any, i: number) => (
                              <p key={i} className="text-sm text-gray-800 dark:text-gray-200"><span className="text-xs text-gray-500">{a.createdAt ? formatDate(a.createdAt) : ''}{a.createdByName ? ` · ${a.createdByName}` : ''} — </span>{a.text}</p>
                            ))}
                          </div>
                        ) : null}
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
  );
};

export default Notes;
