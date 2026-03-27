import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { patientDataAPI } from '../../services/api';
import { usePatientId } from '../../hooks/usePatientId';
import { format } from 'date-fns';
import { FaEye, FaTimes } from 'react-icons/fa';
import IconSearch from '../../components/Icon/IconSearch';
import MedicationAIExplanationSidebar from '../../components/MedicationAIExplanationSidebar';
import { generateMedicationExplanation } from '../../services/geminiApi';
import { parseMedicationData } from '../../utils/medicationParser';
import { MedicationExplanation } from '../../types/medication';
import IconX from '@/components/Icon/IconX';

interface MedicationRecord {
  _id: string;
  id?: string;
  medicationName?: string;
  name?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  [key: string]: any;
}

const Medications: React.FC = () => {
  const patientId = usePatientId();
  const [medicationsList, setMedicationsList] = useState<MedicationRecord[]>([]);
  const [filteredTableList, setFilteredTableList] = useState<MedicationRecord[]>([]);
  const [filteredCardList, setFilteredCardList] = useState<MedicationRecord[]>([]);
  const [paginatedCardList, setPaginatedCardList] = useState<MedicationRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(2);
  const [viewMedication, setViewMedication] = useState<MedicationRecord | null>(null);
  const [aiExplanation, setAiExplanation] = useState<MedicationExplanation | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [showAIExplanation, setShowAIExplanation] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showTextModal, setShowTextModal] = useState(false);
  const [textModalTitle, setTextModalTitle] = useState<string>('');
  const [textModalValue, setTextModalValue] = useState<string>('');

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return format(date, 'MM/dd/yyyy');
    } catch {
      return dateString;
    }
  };

  const getPatientMedications = useCallback(async () => {
    const rcopiaID = patientId;
    if (!rcopiaID) {
      toast.error('Patient ID is required');
      return;
    }
    setLoading(true);
    try {
      const response = await patientDataAPI.getAllMedicationList(rcopiaID);
      if (response.data?.data || Array.isArray(response.data)) {
        const data = response.data?.data || response.data;
        const formattedData = data.map((item: any) => {
          let medicationName = '';
          if (item.Sig && Array.isArray(item.Sig) && item.Sig.length > 0) {
            const sig = item.Sig[0];
            if (sig.Drug && Array.isArray(sig.Drug) && sig.Drug.length > 0) {
              const drug = sig.Drug[0];
              if (drug.BrandName && Array.isArray(drug.BrandName) && drug.BrandName[0]) {
                medicationName = drug.BrandName[0];
              } else if (drug.DrugDescription && Array.isArray(drug.DrugDescription) && drug.DrugDescription[0]) {
                medicationName = drug.DrugDescription[0];
              } else if (drug.GenericName && Array.isArray(drug.GenericName) && drug.GenericName[0]) {
                medicationName = drug.GenericName[0];
              }
            }
          }
          
          let dosage = '';
          if (item.Sig && Array.isArray(item.Sig) && item.Sig.length > 0) {
            const sig = item.Sig[0];
            if (sig.Dosage && Array.isArray(sig.Dosage) && sig.Dosage.length > 0) {
              const dosageObj = sig.Dosage[0];
              if (dosageObj.DosageText && Array.isArray(dosageObj.DosageText) && dosageObj.DosageText[0]) {
                dosage = dosageObj.DosageText[0];
              }
            }
            if (!dosage && sig.Drug && Array.isArray(sig.Drug) && sig.Drug.length > 0) {
              const drug = sig.Drug[0];
              if (drug.Strength && Array.isArray(drug.Strength) && drug.Strength[0]) {
                dosage = drug.Strength[0];
              }
            }
          }
          
          let frequency = '';
          if (item.Sig && Array.isArray(item.Sig) && item.Sig.length > 0) {
            const sig = item.Sig[0];
            if (sig.Dosage && Array.isArray(sig.Dosage) && sig.Dosage.length > 0) {
              const dosageObj = sig.Dosage[0];
              if (dosageObj.InstructionList && Array.isArray(dosageObj.InstructionList) && dosageObj.InstructionList.length > 0) {
                const instruction = dosageObj.InstructionList[0];
                if (instruction.Number && Array.isArray(instruction.Number) && instruction.Number[0]) {
                  frequency = instruction.Number[0];
                }
                if (instruction.Instruction && Array.isArray(instruction.Instruction) && instruction.Instruction.length > 0) {
                  const inst = instruction.Instruction[0];
                  if (inst.ClinicalInstruction && Array.isArray(inst.ClinicalInstruction) && inst.ClinicalInstruction[0]) {
                    frequency = inst.ClinicalInstruction[0];
                  }
                }
              }
            }
          }
          
          let route = '';
          if (item.Sig && Array.isArray(item.Sig) && item.Sig.length > 0) {
            const sig = item.Sig[0];
            if (sig.Drug && Array.isArray(sig.Drug) && sig.Drug.length > 0) {
              const drug = sig.Drug[0];
              if (drug.Route && Array.isArray(drug.Route) && drug.Route[0]) {
                route = drug.Route[0];
              }
            }
          }
          
          let startDate = '';
          if (item.StartDate && Array.isArray(item.StartDate) && item.StartDate.length > 0) {
            const startDateRaw = item.StartDate[0];
            if (startDateRaw && startDateRaw.trim() !== '') {
              startDate = formatDate(startDateRaw);
            }
          } else if (item.StartDate && typeof item.StartDate === 'string' && item.StartDate.trim() !== '') {
            startDate = formatDate(item.StartDate);
          }
          
          let endDate = '';
          if (item.StopDate && Array.isArray(item.StopDate) && item.StopDate.length > 0) {
            const endDateRaw = item.StopDate[0];
            if (endDateRaw && endDateRaw.trim() !== '') {
              endDate = formatDate(endDateRaw);
            }
          } else if (item.StopDate && typeof item.StopDate === 'string' && item.StopDate.trim() !== '') {
            endDate = formatDate(item.StopDate);
          }
          
          let status = '';
          if (endDate && endDate.trim() !== '') {
            status = 'Stopped';
          } else if (item.status !== undefined) {
            status = item.status ? 'Active' : 'Inactive';
          } else {
            status = 'Active';
          }
          
          return {
            ...item,
            medicationName,
            dosage,
            frequency,
            route,
            startDate,
            endDate,
            status,
          };
        });
        setMedicationsList(formattedData);
        setPaginatedCardList(formattedData);
        setFilteredTableList(formattedData);
        setFilteredCardList(formattedData);
        updatePaginatedList(formattedData, 1);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch medications');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    getPatientMedications();
  }, [getPatientMedications]);

  useEffect(() => {
    filterData();
  }, [searchText, medicationsList]);

  const filterData = () => {
    if (!searchText || searchText.trim() === '') {
      setFilteredTableList([...medicationsList]);
      setPaginatedCardList([...medicationsList]);
      setFilteredCardList(medicationsList.slice(0, rowsPerPage));
    } else {
      const filtered = medicationsList.filter((item) => matchesSearch(item));
      setFilteredTableList(filtered);
      setPaginatedCardList(filtered);
      updatePaginatedList(filtered, 1);
    }
  };

  const matchesSearch = (item: MedicationRecord): boolean => {
    const search = searchText.toLowerCase().trim();
    const containsSearchText = (value: any) =>
      value?.toString().toLowerCase().includes(search);
    const name = item.medicationName ?? item.name ?? '';
    return (
      containsSearchText(name) ||
      containsSearchText(item.dosage) ||
      containsSearchText(item.frequency) ||
      containsSearchText(item.route) ||
      containsSearchText(item.status) ||
      containsSearchText(item.startDate) ||
      containsSearchText(item.endDate)
    );
  };

  const updatePaginatedList = (data: MedicationRecord[], page: number = currentPage) => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    setFilteredCardList(data.slice(start, end));
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updatePaginatedList(paginatedCardList, page);
  };

  const first = (v: any): string => {
    if (v == null) return '';
    if (Array.isArray(v) && v.length > 0) return String(v[0] ?? '').trim();
    return String(v).trim();
  };

  const wordsPreview = (value: any, wordLimit: number) => {
    const trimmed = String(value ?? '').trim();
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    const preview = words.length > wordLimit ? words.slice(0, wordLimit).join(' ') : trimmed;
    return { trimmed, preview, needsMore: words.length > wordLimit };
  };

  const openTextModal = (title: string, value: any) => {
    setTextModalTitle(title);
    setTextModalValue(String(value ?? '').trim());
    setShowTextModal(true);
  };

  const handleMedicationNameClick = async (medication: MedicationRecord) => {
    try {
      setLoadingAI(true);
      setAiError(null);
      setShowAIExplanation(true);
      
      // Parse medication data
      const parsedData = parseMedicationData(medication);
      
      // Generate AI explanation
      const explanation = await generateMedicationExplanation(parsedData, medication);
      setAiExplanation(explanation);
    } catch (error: any) {
      console.error('Error generating medication explanation:', error);
      setAiError(error.message || 'Failed to generate medication explanation. Please try again.');
      toast.error('Failed to generate AI explanation');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleCloseAIExplanation = () => {
    setShowAIExplanation(false);
    setAiExplanation(null);
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
            <li className="text-gray-900 dark:text-white font-medium">Medications</li>
          </ul>
        </div>

        {/* Page Header */}
        <div className="mb-5">
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
    
    {/* Left Section */}
    <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1">
      
      <h3 className="text-xl font-semibold">
        Medications
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
                {medicationsList.length === 0
                  ? 'No medications recorded for patient.'
                  : 'No record found.'}
              </div>
            ) : (
              filteredCardList.map((medication) => (
                <div key={medication._id} className="panel md:col-span-1 shadow-equal hover:shadow-equal-lg transition-shadow duration-200">
                  <div className="mb-4 pb-3 border-b border-white-light dark:border-[#191e3a] flex items-start justify-between gap-2">
                    <h5 
                      className="text-base font-semibold flex-1 min-w-0 cursor-pointer hover:underline text-primary outline-none focus:outline-none select-none active:no-underline"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        handleMedicationNameClick(medication);
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      title="Click for AI explanation"
                    >
                      {medication.medicationName || 'Medication Record'}
                    </h5>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setViewMedication(medication)}
                        className="btn btn-sm btn-outline-primary p-2"
                        aria-label="View medication"
                      >
                        <FaEye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">                
                        <div>
                      <h6 className="text-primary text-sm uppercase font-semibold mb-2">
                        Medication Details
                      </h6>
                      <div className="space-y-2">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Dosage:</span>
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">
                            <span className="hidden sm:inline">{medication.dosage || '---'}</span>
                            <span className="sm:hidden">
                              {(() => {
                                const { trimmed, preview, needsMore } = wordsPreview(medication.dosage, 4);
                                return (
                                  <>
                                    <span className="break-words">{preview || '---'}</span>
                                    {needsMore && (
                                      <button
                                        type="button"
                                        onClick={() => openTextModal('Dosage', trimmed)}
                                        className="text-primary hover:underline ml-1"
                                      >
                                        ...See more
                                      </button>
                                    )}
                                  </>
                                );
                              })()}
                            </span>
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Frequency:</span>
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">
                            <span className="hidden sm:inline">{medication.frequency || '---'}</span>
                            <span className="sm:hidden">
                              {(() => {
                                const { trimmed, preview, needsMore } = wordsPreview(medication.frequency, 4);
                                return (
                                  <>
                                    <span className="break-words">{preview || '---'}</span>
                                    {needsMore && (
                                      <button
                                        type="button"
                                        onClick={() => openTextModal('Frequency', trimmed)}
                                        className="text-primary hover:underline ml-1"
                                      >
                                        ...See more
                                      </button>
                                    )}
                                  </>
                                );
                              })()}
                            </span>
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Route:</span>
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">
                            {medication.route || '---'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Status:</span>
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">
                            {medication.status || '---'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Start Date:</span>
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">
                            {medication.startDate || '---'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">End Date:</span>
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">
                            {medication.endDate || '---'}
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

      {/* View Medication modal */}
      {viewMedication && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setViewMedication(null)}
        >
          <div
            className="bg-white dark:bg-[#0e1726] rounded-lg shadow-xl max-w-2xl w-full flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 bg-primary text-white rounded-t-lg shrink-0">
              <h5 className="text-lg font-semibold">View Medication</h5>
              <button
                type="button"
                onClick={() => setViewMedication(null)}
                className="p-1.5 rounded hover:bg-white/20 transition-colors"
                aria-label="Close"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5 space-y-5">
              {/* Last Modified */}
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  Last Modified:{' '}
                  {first(viewMedication.LastModifiedDate) || first(viewMedication.LastUpdateDate) || '--'}
                </span>
              </div>

              {/* Drug Information */}
              <div className="panel p-4 border border-white-light dark:border-[#191e3a]">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-primary shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                  <h6 className="text-primary text-sm font-semibold uppercase">Drug Information</h6>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between sm:block gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Brand Name:</span>
                    <span className="font-bold text-gray-900 dark:text-white sm:ml-2">
                      {viewMedication.Sig?.[0]?.Drug?.[0] ? first((viewMedication.Sig[0].Drug[0] as any).BrandName) : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between sm:block gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Brand Type:</span>
                    <span className="font-bold text-gray-900 dark:text-white sm:ml-2">
                      {viewMedication.Sig?.[0]?.Drug?.[0] ? first((viewMedication.Sig[0].Drug[0] as any).BrandType) : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between sm:block gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Route:</span>
                    <span className="font-bold text-gray-900 dark:text-white sm:ml-2">
                      {viewMedication.Sig?.[0]?.Drug?.[0] ? first((viewMedication.Sig[0].Drug[0] as any).Route) : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between sm:block gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Strength:</span>
                    <span className="font-bold text-gray-900 dark:text-white sm:ml-2">
                      {viewMedication.Sig?.[0]?.Drug?.[0] ? first((viewMedication.Sig[0].Drug[0] as any).Strength) : '--'}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-gray-600 dark:text-gray-400">Drug Description:</span>
                    <span className="font-bold text-gray-900 dark:text-white ml-2">
                      {viewMedication.Sig?.[0]?.Drug?.[0] ? first((viewMedication.Sig[0].Drug[0] as any).DrugDescription) : '--'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Provider Details */}
              <div className="panel p-4 border border-white-light dark:border-[#191e3a]">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-primary shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  <h6 className="text-primary text-sm font-semibold uppercase">Provider Details</h6>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between sm:block gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Provider Name:</span>
                    <span className="font-bold text-gray-900 dark:text-white sm:ml-2">
                      {viewMedication.Provider?.[0]
                        ? [first((viewMedication.Provider[0] as any).FirstName), first((viewMedication.Provider[0] as any).LastName)].filter(Boolean).join(' ') || '--'
                        : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between sm:block gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Office Comments:</span>
                    <span className="font-bold text-gray-900 dark:text-white sm:ml-2">
                      {viewMedication.Sig?.[0] ? first((viewMedication.Sig[0] as any).Comments) : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between sm:block gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Start Date:</span>
                    <span className="font-bold text-gray-900 dark:text-white sm:ml-2">
                      {viewMedication.startDate || first(viewMedication.StartDate) || '--'}
                    </span>
                  </div>
                  <div className="flex justify-between sm:block gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Stop Date:</span>
                    <span className="font-bold text-gray-900 dark:text-white sm:ml-2">
                      {viewMedication.endDate || first(viewMedication.StopDate) || '--'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Prescription Details */}
              <div className="panel p-4 border border-white-light dark:border-[#191e3a]">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-primary shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                  </svg>
                  <h6 className="text-primary text-sm font-semibold uppercase">Prescription Details</h6>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between sm:block gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Quantity:</span>
                    <span className="font-bold text-gray-900 dark:text-white sm:ml-2">
                      {viewMedication.Sig?.[0] ? first((viewMedication.Sig[0] as any).Quantity) || '--' : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between sm:block gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Refills:</span>
                    <span className="font-bold text-gray-900 dark:text-white sm:ml-2">
                      {viewMedication.Sig?.[0] ? first((viewMedication.Sig[0] as any).Refills) || '0' : '0'}
                    </span>
                  </div>
                  <div className="flex justify-between sm:block gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Dose:</span>
                    <span className="font-bold text-gray-900 dark:text-white sm:ml-2">
                      {(() => {
                        const sig = viewMedication.Sig?.[0];
                        if (!sig) return '--';
                        const dosage = (sig as any).Dosage?.[0];
                        const instr = dosage?.InstructionList?.[0]?.Instruction?.[0];
                        const num = dosage?.InstructionList?.[0]?.Number;
                        const numVal = Array.isArray(num) && num.length > 0 ? num[0] : '';
                        const unit = instr?.DoseUnit;
                        const unitVal = Array.isArray(unit) && unit.length > 0 ? unit[0] : 'tablet';
                        return (numVal ? `${numVal} ` : '-- ') + (unitVal || '');
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between sm:block gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                    <span className="font-bold text-gray-900 dark:text-white sm:ml-2">
                      {viewMedication.Sig?.[0] ? first((viewMedication.Sig[0] as any).Duration) || '--' : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between sm:block gap-2 sm:col-span-2">
                    <span className="text-gray-600 dark:text-gray-400">Instruction:</span>
                    <span className="font-bold text-gray-900 dark:text-white sm:ml-2">
                      {(() => {
                        const sig = viewMedication.Sig?.[0];
                        const instr = (sig as any)?.Dosage?.[0]?.InstructionList?.[0]?.Instruction?.[0];
                        return instr ? first((instr as any).ClinicalInstruction) || '--' : '--';
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Explanation Sidebar */}
      <MedicationAIExplanationSidebar
        isOpen={showAIExplanation}
        onClose={handleCloseAIExplanation}
        explanation={aiExplanation}
        loading={loadingAI}
        error={aiError}
      />

      {/* Text Modal (Documents-style) */}
      {showTextModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setShowTextModal(false)}
        >
          <div
            className="bg-white dark:bg-[#0e1726] rounded-lg shadow-xl max-w-2xl w-full"
            style={{ maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white-light dark:border-[#191e3a]">
              <h5 className="text-lg font-semibold text-gray-900 dark:text-white">{textModalTitle}</h5>
              <button
                type="button"
                onClick={() => setShowTextModal(false)}
                className="btn btn-sm btn-outline-danger"
              >
                <FaTimes />
              </button>
            </div>
            <div className="p-6 overflow-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              <p className="text-gray-900 dark:text-white whitespace-pre-wrap break-words">
                {textModalValue || '---'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Medications;
