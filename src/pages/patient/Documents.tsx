import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { patientDataAPI, aiHealthInsightsAPI } from '../../services/api';
import { usePatientId } from '../../hooks/usePatientId';
import { format } from 'date-fns';
import { FaEye, FaDownload,FaTimes  } from 'react-icons/fa';
import { FaWandMagicSparkles } from 'react-icons/fa6';
import IconSearch from '../../components/Icon/IconSearch';

interface DocumentRecord {
  _id: string;
  documentName?: string;
  documentType?: string;
  uploadDate?: string;
  fileURL?: string;
  notes?: string;
  [key: string]: any;
}

const Documents: React.FC = () => {
  const patientId = usePatientId();
  const [documentsList, setDocumentsList] = useState<DocumentRecord[]>([]);
  const [filteredTableList, setFilteredTableList] = useState<DocumentRecord[]>([]);
  const [filteredCardList, setFilteredCardList] = useState<DocumentRecord[]>([]);
  const [paginatedCardList, setPaginatedCardList] = useState<DocumentRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(2);
  const [previewDocument, setPreviewDocument] = useState<DocumentRecord | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewIsImage, setPreviewIsImage] = useState(true);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState<string>('');

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return format(date, 'MM/dd/yyyy');
    } catch {
      return dateString;
    }
  };

  const getPatientDocuments = useCallback(async () => {
    if (!patientId) {
      toast.error('Patient ID is required');
      return;
    }

    setLoading(true);
    try {
      const response = await patientDataAPI.getAllDocument(patientId);
      if (response.data?.data || Array.isArray(response.data)) {
        const data = response.data?.data || response.data;
        const formattedData = data.map((item: any) => {
          const documentName = item.name || item.documentName || '';
          
          let documentType = '';
          if (item.documentType) {
            documentType = item.documentType;
          } else if (item.name) {
            const nameLower = item.name.toLowerCase();
            if (nameLower.includes('directive')) {
              documentType = 'Healthcare Directive';
            } else if (nameLower.includes('lab') || nameLower.includes('test')) {
              documentType = 'Lab Report';
            } else if (nameLower.includes('report')) {
              documentType = 'Report';
            } else if (nameLower.includes('note')) {
              documentType = 'Note';
            } else if (item.fileURL) {
              const url = item.fileURL.toLowerCase();
              if (url.endsWith('.pdf')) {
                documentType = 'PDF';
              } else if (url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg')) {
                documentType = 'Image';
              } else if (url.endsWith('.doc') || url.endsWith('.docx')) {
                documentType = 'Word Document';
              } else {
                documentType = 'Document';
              }
            } else {
              documentType = 'Document';
            }
          }
          
          let uploadDate = '';
          if (item.date) {
            uploadDate = formatDate(item.date);
          } else if (item.createdOn) {
            uploadDate = formatDate(item.createdOn);
          } else if (item.uploadDate) {
            uploadDate = formatDate(item.uploadDate);
          } else if (item.createdAt) {
            uploadDate = formatDate(item.createdAt);
          }
          
          const notes = String(item.notes ?? item.note ?? item.description ?? item.comments ?? '').trim();
          return {
            ...item,
            documentName,
            documentType,
            uploadDate,
            notes,
          };
        });
        setDocumentsList(formattedData);
        setPaginatedCardList(formattedData);
        setFilteredTableList(formattedData);
        setFilteredCardList(formattedData);
        updatePaginatedList(formattedData, 1);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    getPatientDocuments();
  }, [getPatientDocuments]);

  useEffect(() => {
    filterData();
  }, [searchText, documentsList]);

  const filterData = () => {
    if (!searchText || searchText.trim() === '') {
      setFilteredTableList([...documentsList]);
      setPaginatedCardList([...documentsList]);
      setFilteredCardList(documentsList.slice(0, rowsPerPage));
    } else {
      const filtered = documentsList.filter((item) => matchesSearch(item));
      setFilteredTableList(filtered);
      setPaginatedCardList(filtered);
      updatePaginatedList(filtered, 1);
    }
  };

  const matchesSearch = (item: DocumentRecord): boolean => {
    const search = searchText.toLowerCase().trim();
    const containsSearchText = (value: any) =>
      value?.toString().toLowerCase().includes(search);

    return (
      containsSearchText(item.documentName) ||
      containsSearchText(item.documentType) ||
      containsSearchText(item.uploadDate) ||
      containsSearchText(item.notes)
    );
  };

  const updatePaginatedList = (data: DocumentRecord[], page: number = currentPage) => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    setFilteredCardList(data.slice(start, end));
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updatePaginatedList(paginatedCardList, page);
  };

  const downloadDocument = async (id: string) => {
    try {
      const response = await patientDataAPI.downloadDocument(id);
      const blob = response.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document-${id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Download failed');
    }
  };

  const openPreview = async (document: DocumentRecord) => {
    setPreviewDocument(document);
    setPreviewBlobUrl(null);
    setPreviewLoading(true);
    try {
      const response = await patientDataAPI.downloadDocument(document._id);
      const blob = response.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const mimeIsImage = blob.type.startsWith('image/');
      const urlLooksLikeImage =
        typeof document.fileURL === 'string' &&
        /\.(jpe?g|png|gif|webp|bmp)$/i.test(document.fileURL);
      const isImage = mimeIsImage || (!blob.type || blob.type === 'application/octet-stream') && urlLooksLikeImage;
      setPreviewBlobUrl(url);
      setPreviewIsImage(isImage);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load preview');
      setPreviewDocument(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewBlobUrl) {
      window.URL.revokeObjectURL(previewBlobUrl);
    }
    setPreviewDocument(null);
    setPreviewBlobUrl(null);
  };

  const handleAiExplain = async (documentId: string) => {
    setAiLoadingId(documentId);
    try {
      const response = await aiHealthInsightsAPI.explainPatientDocument(documentId);
      const explanation = response.data?.data?.explanations?.[0]?.plainLanguageExplanation || 'No explanation available';
      setAiExplanation(explanation);
      setShowAiModal(true);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to get AI explanation');
    } finally {
      setAiLoadingId(null);
    }
  };

  const openNotesModal = (notes: string) => {
    setSelectedNotes(notes);
    setShowNotesModal(true);
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
            <li className="text-gray-900 dark:text-white font-medium">Documents</li>
          </ul>
        </div>

        {/* Page Header */}
        <div className="mb-5">
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
    
    {/* Left Section */}
    <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1">
      
      <h3 className="text-xl font-semibold">
        Documents
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
                {documentsList.length === 0
                  ? 'No documents recorded for patient.'
                  : 'No record found.'}
              </div>
            ) : (
              filteredCardList.map((document) => (
                <div key={document._id} className="panel md:col-span-1 shadow-equal hover:shadow-equal-lg transition-shadow duration-200">
                  <div className="mb-4 pb-3 border-b border-white-light dark:border-[#191e3a] flex items-start justify-between gap-2">
                    <h5 className="text-base font-semibold flex-1 min-w-0">
                      {document.documentName || 'Document Record'}
                    </h5>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAiExplain(document._id)}
                        className="btn btn-sm btn-outline-info p-2"
                        disabled={aiLoadingId === document._id}
                        aria-label="AI Explain"
                      >
                        {aiLoadingId === document._id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-info border-t-transparent" />
                        ) : (
                          <FaWandMagicSparkles  className="w-4 h-4" />
                        )}
                      </button>
                      {document.fileURL && (
                        <button
                          type="button"
                          onClick={() => openPreview(document)}
                          className="btn btn-sm btn-outline-primary p-2"
                          aria-label="Preview"
                        >
                          <FaEye className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => downloadDocument(document._id)}
                        className="btn btn-sm btn-outline-primary p-2"
                        aria-label="Download"
                      >
                        <FaDownload className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">                    <div>
                      <h6 className="text-primary text-sm uppercase font-semibold mb-2">
                        Document Details
                      </h6>
                      <div className="space-y-2">
                      <div className="flex gap-2 items-start">
  <span className="text-gray-600 dark:text-gray-400 text-sm whitespace-nowrap">
    Notes:
  </span>

  <span className="text-sm text-gray-900 dark:text-white">
    <span className="font-bold">
      {document.notes ? document.notes.split(" ").slice(0, 4).join(" ") : "---"}
    </span>

    {document.notes && document.notes.split(" ").length > 4 && (
      <button
        onClick={() => openNotesModal(document.notes!)}
        className="text-primary hover:underline ml-1"
      >
        ...See more
      </button>
    )}
  </span>
</div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Upload Date:</span>
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">
                            {document.uploadDate || '---'}
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

      {/* Preview modal */}
      {previewDocument && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={closePreview}
        >
          <div
            className="bg-primary text-white rounded-lg shadow-xl max-w-5xl w-full flex flex-col"
            style={{ maxHeight: '92vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white-light dark:border-[#191e3a] shrink-0">
              <h5 className="text-lg font-semibold text-gray-900 text-white truncate pr-4">
                {previewDocument.documentName || 'Preview'}
              </h5>
              <button
                type="button"
                onClick={closePreview}
                className="btn btn-sm shrink-0"
                aria-label="Close"
              >
                Close
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-6 overflow-auto bg-gray-200 dark:bg-gray-900/70 rounded-b-lg min-h-[70vh]">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 text-gray-500">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
                  <span>Loading preview...</span>
                </div>
              ) : previewBlobUrl ? (
                previewIsImage ? (
                  <img
                    src={previewBlobUrl}
                    alt={previewDocument.documentName || 'Document'}
                    className="max-w-full w-auto max-h-[80vh] object-contain block rounded shadow-lg"
                    style={{ minHeight: 0 }}
                  />
                ) : (
                  <iframe
                    src={previewBlobUrl}
                    title={previewDocument.documentName || 'Document'}
                    className="w-full border-0 rounded flex-1 min-h-[75vh]"
                  />
                )
              ) : (
                <p className="text-gray-500">Unable to load preview.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Explanation Modal */}
      {showAiModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setShowAiModal(false)}
        >
          <div
            className="bg-white dark:bg-[#0e1726] rounded-lg shadow-xl max-w-3xl w-full"
            style={{ maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white-light dark:border-[#191e3a]">
              <h5 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <FaWandMagicSparkles  className="mr-2" />
                AI Document Explanation
              </h5>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="btn btn-sm btn-outline-danger"
              >
                <FaTimes />
              </button>
            </div>
            <div className="p-6 overflow-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
                {aiExplanation}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {showNotesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setShowNotesModal(false)}
        >
          <div
            className="bg-white dark:bg-[#0e1726] rounded-lg shadow-xl max-w-2xl w-full"
            style={{ maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white-light dark:border-[#191e3a]">
              <h5 className="text-lg font-semibold text-gray-900 dark:text-white">
                Notes
              </h5>
              <button
                type="button"
                onClick={() => setShowNotesModal(false)}
                className="btn btn-sm btn-outline-danger"
              >
                <FaTimes />
              </button>
            </div>
            <div className="p-6 overflow-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              <p className="text-gray-900 dark:text-white whitespace-pre-wrap break-words">
                {selectedNotes}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documents;
