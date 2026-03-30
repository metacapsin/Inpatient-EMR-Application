import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { patientDataAPI, aiHealthInsightsAPI } from '../../services/api';
import { usePatientId } from '../../hooks/usePatientId';
import { format } from 'date-fns';
import { FaDownload, FaTimes } from 'react-icons/fa';
import IconSparkles from '../../components/Icon/IconSparkles';
import IconSearch from '../../components/Icon/IconSearch';
import IconX from '@/components/Icon/IconX';

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
  const [notesList, setNotesList] = useState<NoteRecord[]>([]);
  const [filteredTableList, setFilteredTableList] = useState<NoteRecord[]>([]);
  const [filteredCardList, setFilteredCardList] = useState<NoteRecord[]>([]);
  const [paginatedCardList, setPaginatedCardList] = useState<NoteRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(2);

  // AI Modal states
  const [showAIModal, setShowAIModal] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [visitSummary, setVisitSummary] = useState<any>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Question Modal states
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionNoteId, setQuestionNoteId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [questionAnswer, setQuestionAnswer] = useState<string | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);

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
        const formattedData = data.map((item: any) => ({
          ...item,
          noteDate: item.noteDate || item.createdAt ? formatDate(item.noteDate || item.createdAt) : '',
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

  const downloadNote = async (id: string) => {
    try {
      const response = await patientDataAPI.downloadNotes(id);
      const blob = response.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `note-${id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Download failed');
    }
  };

  const handleAIClick = async (noteId: string) => {
    setSelectedNoteId(noteId);
    setShowAIModal(true);
    setLoadingAI(true);
    setAiError(null);
    setVisitSummary(null);

    try {
      const response = await aiHealthInsightsAPI.explainVisitSummary({ noteId });
      const summary = response.data?.data || response.data;
      setVisitSummary(summary || {});
    } catch (error: any) {
      console.error('Error fetching visit summary:', error);
      setAiError(error.response?.data?.message || 'Failed to fetch visit summary. Please try again.');
      toast.error('Failed to fetch visit summary');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleCloseAIModal = () => {
    setShowAIModal(false);
    setSelectedNoteId(null);
    setVisitSummary(null);
    setAiError(null);
  };

  const handleQuestionClick = (noteId: string) => {
    setQuestionNoteId(noteId);
    setShowQuestionModal(true);
    setQuestion('');
    setQuestionAnswer(null);
    setQuestionError(null);
  };

  const handleCloseQuestionModal = () => {
    setShowQuestionModal(false);
    setQuestionNoteId(null);
    setQuestion('');
    setQuestionAnswer(null);
    setQuestionError(null);
  };

  const handleSubmitQuestion = async () => {
    if (!questionNoteId || !question.trim()) {
      toast.error('Please enter a question');
      return;
    }

    setLoadingQuestion(true);
    setQuestionError(null);
    setQuestionAnswer(null);

    try {
      const response = await aiHealthInsightsAPI.askAboutVisit({
        noteId: questionNoteId,
        question: question.trim(),
      });
      const answer = response.data?.data?.answer || response.data?.answer || response.data;
      setQuestionAnswer(typeof answer === 'string' ? answer : JSON.stringify(answer, null, 2));
      toast.success('Question answered successfully');
    } catch (error: any) {
      console.error('Error asking question:', error);
      setQuestionError(error.response?.data?.message || 'Failed to get answer. Please try again.');
      toast.error('Failed to get answer');
    } finally {
      setLoadingQuestion(false);
    }
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
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleQuestionClick(note._id)}
                          className="btn btn-sm btn-outline-primary p-2"
                          aria-label="Ask about visit"
                          title="Ask About Visit"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAIClick(note._id)}
                          className="btn btn-sm btn-outline-primary p-2"
                          aria-label="View AI visit summary"
                          title="View AI Visit Summary"
                        >
                          <IconSparkles className="w-4 h-4" />
                        </button>
                        
                      <button
                        className="btn btn-sm btn-outline-primary p-2"
                        onClick={() => downloadNote(note._id)}
                      >
                        <FaDownload className="w-4 h-4" />
                        
                      </button>
                    
                      </div>
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
                            {note.noteType || '---'}
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
                            {note.noteDate || '---'}
                          </span>
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

      {/* AI Visit Summary Modal */}
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
              <h5 className="text-lg font-semibold">AI Visit Summary Explanation</h5>
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
                  <p className="text-gray-600 dark:text-gray-400">Generating visit summary explanation...</p>
                </div>
              )}

              {aiError && (
                <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 mb-4">
                  <p className="text-danger font-semibold mb-2">Error</p>
                  <p className="text-danger/80 text-sm">{aiError}</p>
                </div>
              )}

              {!loadingAI && !aiError && visitSummary && (
                <div className="space-y-6">
                  {visitSummary.plainLanguageSummary ? (
                    <div className="panel p-5 border border-white-light dark:border-[#191e3a]">
                      <h6 className="text-primary text-lg font-semibold mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        Visit Summary
                      </h6>
                      <div className="mt-4">
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {visitSummary.plainLanguageSummary}
                        </p>
                      </div>
                    </div>
                  ) : visitSummary.explanations && Array.isArray(visitSummary.explanations) && visitSummary.explanations.length > 0 ? (
                    visitSummary.explanations.map((explanation: any, index: number) => (
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
                  ) : visitSummary.summary ? (
                    <div className="panel p-5 border border-white-light dark:border-[#191e3a]">
                      <h6 className="text-primary text-lg font-semibold mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        Visit Summary
                      </h6>
                      <div className="mt-4">
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {visitSummary.summary}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <p>No explanation available for this visit summary.</p>
                    </div>
                  )}
                </div>
              )}

              {!loadingAI && !aiError && !visitSummary && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>No data available.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Question Modal */}
      {showQuestionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={handleCloseQuestionModal}
        >
          <div
            className="bg-white dark:bg-[#0e1726] rounded-lg shadow-xl max-w-2xl w-full flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 bg-success text-white rounded-t-lg shrink-0">
              <h5 className="text-lg font-semibold">Ask About Visit</h5>
              <button
                type="button"
                onClick={handleCloseQuestionModal}
                className="p-1.5 rounded hover:bg-white/20 transition-colors"
                aria-label="Close"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="question" className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    Your Question
                  </label>
                  <textarea
                    id="question"
                    rows={4}
                    className="form-textarea w-full"
                    placeholder="e.g., What did the doctor recommend for my condition?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    disabled={loadingQuestion}
                  />
                </div>

                {questionError && (
                  <div className="bg-danger/10 border border-danger/20 rounded-lg p-4">
                    <p className="text-danger font-semibold mb-2">Error</p>
                    <p className="text-danger/80 text-sm">{questionError}</p>
                  </div>
                )}

                {loadingQuestion && (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-success"></div>
                    <p className="text-gray-600 dark:text-gray-400">Getting answer...</p>
                  </div>
                )}

                {!loadingQuestion && questionAnswer && (
                  <div className="panel p-5 border border-white-light dark:border-[#191e3a]">
                    <h6 className="text-success text-lg font-semibold mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      Answer
                    </h6>
                    <div className="mt-4">
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {questionAnswer}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-white-light dark:border-[#191e3a] shrink-0">
              <button
                type="button"
                onClick={handleCloseQuestionModal}
                className="btn btn-outline-primary"
                disabled={loadingQuestion}
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSubmitQuestion}
                className="btn btn-success"
                disabled={loadingQuestion || !question.trim()}
              >
                {loadingQuestion ? 'Submitting...' : 'Ask Question'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notes;
