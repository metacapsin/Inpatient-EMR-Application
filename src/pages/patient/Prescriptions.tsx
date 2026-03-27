import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { patientDataAPI } from '../../services/api';
import { usePatientId } from '../../hooks/usePatientId';
import { format } from 'date-fns';
import IconSearch from '../../components/Icon/IconSearch';

interface PrescriptionRecord {
  _id: string;
  medicationName?: string;
  /** Card title: full drug line (name + strength + form / DrugDescription). */
  drugDisplayTitle?: string;
  dosage?: string;
  frequency?: string;
  quantity?: string;
  refills?: string;
  prescriberName?: string;
  /** Formatted display value (MM/dd/yyyy); source may be any of several API date fields. */
  prescriptionDate?: string;
  [key: string]: any;
}

/** Generic row label — multiple API date fields are merged into one displayed value. */
const PRESCRIPTION_DATE_LABEL = 'Date';

const NESTED_LIST_KEYS = [
  'prescriptions',
  'prescriptionList',
  'PrescriptionList',
  'list',
  'records',
  'items',
  'result',
  'rows',
  'data',
] as const;

function first(val: any): string {
  if (val == null) return '';
  if (Array.isArray(val) && val.length > 0) return String(val[0] ?? '').trim();
  return String(val).trim();
}

/** Supports { data: [...] }, { data: { prescriptionList: [...] } }}, top-level arrays, etc. */
function extractPrescriptionListFromResponse(res: any): any[] {
  if (res == null) return [];
  if (Array.isArray(res)) return res;
  const inner = res.data;
  if (Array.isArray(inner)) return inner;
  if (inner != null && typeof inner === 'object') {
    for (const k of NESTED_LIST_KEYS) {
      const v = inner[k as keyof typeof inner];
      if (Array.isArray(v)) return v;
    }
  }
  for (const k of NESTED_LIST_KEYS) {
    if (k === 'data') continue;
    if (Array.isArray(res[k])) return res[k];
  }
  return [];
}

/** Normalize API date payloads (strings, Rcopia arrays, epoch ms, Mongo-style, nested Sig). */
function coerceRawDateString(val: any): string {
  if (val == null) return '';
  if (typeof val === 'number' && !Number.isNaN(val)) {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? '' : val.toISOString();
  }
  if (typeof val === 'object') {
    const v = val as Record<string, unknown>;
    if (v.$date != null) return coerceRawDateString(v.$date);
    if (v.value != null) return coerceRawDateString(v.value);
  }
  if (Array.isArray(val)) {
    for (const el of val) {
      const s = coerceRawDateString(el);
      if (s) return s;
    }
    return '';
  }
  if (typeof val === 'string') {
    const t = val.trim();
    return t;
  }
  return String(val).trim();
}

const PRESCRIPTION_DATE_ITEM_KEYS: string[] = [
  'CreatedDate',
  'createdDate',
  'prescriptionDate',
  'PrescriptionDate',
  'writtenDate',
  'WrittenDate',
  'writtenOn',
  'WrittenOn',
  'issueDate',
  'IssueDate',
  'orderDate',
  'OrderDate',
  'fillDate',
  'FillDate',
  'firstFillDate',
  'FirstFillDate',
  'LastFillDate',
  'lastFillDate',
  'EffectiveDate',
  'effectiveDate',
  'StartDate',
  'startDate',
  'DatePrescribed',
  'datePrescribed',
  'prescribedDate',
  'PrescribedDate',
  'createdAt',
  'updatedAt',
];

const PRESCRIPTION_DATE_SIG_KEYS: string[] = [
  'WrittenDate',
  'writtenDate',
  'WrittenOn',
  'FillDate',
  'fillDate',
  'FirstFillDate',
  'LastFillDate',
  'EffectiveDate',
  'StartDate',
];

function rawPrescriptionDate(item: any): string {
  for (const k of PRESCRIPTION_DATE_ITEM_KEYS) {
    const s = coerceRawDateString(item[k]);
    if (s) return s;
  }
  const sig = item.Sig?.[0];
  if (sig && typeof sig === 'object') {
    for (const k of PRESCRIPTION_DATE_SIG_KEYS) {
      const s = coerceRawDateString((sig as Record<string, unknown>)[k]);
      if (s) return s;
    }
  }
  return '';
}

/** Prefer full DrugDescription when present; otherwise brand/generic + strength + dosage form (Rcopia + flat fallbacks). */
function buildDrugDisplayTitle(item: any, medicationName: string): string {
  const drug = item.Sig?.[0]?.Drug?.[0] as Record<string, unknown> | undefined;
  const fullDesc = drug ? first(drug.DrugDescription) : '';

  const name =
    (drug && (first(drug.BrandName) || first(drug.GenericName))) ||
    first(item.drugName) ||
    first(item.DrugName) ||
    '';

  const strength =
    (drug && first(drug.Strength)) ||
    first(item.strength) ||
    first(item.drugStrength) ||
    '';

  const form =
    (drug &&
      (first(drug.Form) ||
        first(drug.DoseForm) ||
        first(drug.DosageForm) ||
        first(drug.Formulation))) ||
    first(item.form) ||
    first(item.dosageForm) ||
    '';

  const baseLabel = fullDesc || name || medicationName || '';
  const pieces: string[] = [];
  if (baseLabel) pieces.push(baseLabel);

  const pushIfNotEmbedded = (segment: string) => {
    if (!segment?.trim()) return;
    const blob = pieces.join(' ').toLowerCase();
    if (!blob.includes(segment.toLowerCase().trim())) pieces.push(segment.trim());
  };
  pushIfNotEmbedded(strength);
  pushIfNotEmbedded(form);

  const joined = pieces.join(' · ').trim();
  return joined || 'Prescription Record';
}

function mapRawToPrescriptionRecord(item: any, index: number, formatDateFn: (s: string) => string): PrescriptionRecord {
  let medicationName =
    item.medicationName ||
    first(item.drugName) ||
    first(item.DrugName) ||
    '';
  let dosage = item.dosage != null ? String(item.dosage) : '';
  let frequency = item.frequency != null ? String(item.frequency) : '';
  let quantity = item.quantity != null && !Array.isArray(item.quantity) ? String(item.quantity) : '';
  let refills = item.refills != null && !Array.isArray(item.refills) ? String(item.refills) : '';

  if (item.Sig && Array.isArray(item.Sig) && item.Sig.length > 0) {
    const sig = item.Sig[0] as any;
    if (!medicationName && sig.Drug && Array.isArray(sig.Drug) && sig.Drug.length > 0) {
      const drug = sig.Drug[0];
      if (drug.BrandName && Array.isArray(drug.BrandName) && drug.BrandName[0]) {
        medicationName = drug.BrandName[0];
      } else if (drug.DrugDescription && Array.isArray(drug.DrugDescription) && drug.DrugDescription[0]) {
        medicationName = drug.DrugDescription[0];
      } else if (drug.GenericName && Array.isArray(drug.GenericName) && drug.GenericName[0]) {
        medicationName = drug.GenericName[0];
      }
    }
    if (!dosage && sig.Dosage && Array.isArray(sig.Dosage) && sig.Dosage.length > 0) {
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
    if (!frequency && sig.Dosage && Array.isArray(sig.Dosage) && sig.Dosage.length > 0) {
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
    if (!quantity) quantity = first(sig.Quantity);
    if (!refills) refills = first(sig.Refills);
  }

  if (!quantity) quantity = first(item.quantity);
  if (!refills) refills = first(item.refills);

  let prescriberName =
    item.prescriberName ||
    item.providerName ||
    item.orderingProviderName ||
    '';
  if (!prescriberName && item.Provider && Array.isArray(item.Provider) && item.Provider.length > 0) {
    const p = item.Provider[0] as any;
    prescriberName = [first(p.FirstName), first(p.LastName)].filter(Boolean).join(' ');
  }
  if (!prescriberName) prescriberName = first(item.Prescriber) || first(item.prescriber);

  const dateRaw = rawPrescriptionDate(item);
  const prescriptionDate = dateRaw ? formatDateFn(dateRaw) : '';

  const drugDisplayTitle = buildDrugDisplayTitle(item, medicationName);

  const _id = String(
    item._id ?? item.id ?? item.RcopiaID ?? item.rcopiaID ?? item.rxID ?? item.RxID ?? `rx-${index}`,
  );

  return {
    ...item,
    _id,
    medicationName,
    drugDisplayTitle,
    dosage,
    frequency,
    quantity,
    refills,
    prescriberName,
    prescriptionDate,
  };
}

const Prescriptions: React.FC = () => {
  const patientId = usePatientId();
  const [prescriptionsList, setPrescriptionsList] = useState<PrescriptionRecord[]>([]);
  const [filteredTableList, setFilteredTableList] = useState<PrescriptionRecord[]>([]);
  const [filteredCardList, setFilteredCardList] = useState<PrescriptionRecord[]>([]);
  const [paginatedCardList, setPaginatedCardList] = useState<PrescriptionRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(2);
  const [showTextModal, setShowTextModal] = useState(false);
  const [textModalTitle, setTextModalTitle] = useState<string>('');
  const [textModalValue, setTextModalValue] = useState<string>('');

  const formatDate = (dateString: string): string => {
    if (!dateString || !String(dateString).trim()) return '';
    try {
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return '';
      return format(date, 'MM/dd/yyyy');
    } catch {
      return '';
    }
  };

  const getPatientPrescriptions = useCallback(async () => {
    const rcopiaID = patientId;
    if (!rcopiaID) {
      toast.error('Patient ID is required');
      return;
    }

    setLoading(true);
    try {
      const response = await patientDataAPI.getAllPrescriptionList(rcopiaID);
      const rawList = extractPrescriptionListFromResponse(response.data);
      const formattedData = rawList.map((item: any, index: number) =>
        mapRawToPrescriptionRecord(item, index, formatDate),
      );
      setPrescriptionsList(formattedData);
      setPaginatedCardList(formattedData);
      setFilteredTableList(formattedData);
      setFilteredCardList(formattedData);
      updatePaginatedList(formattedData, 1);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch prescriptions');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    getPatientPrescriptions();
  }, [getPatientPrescriptions]);

  useEffect(() => {
    filterData();
  }, [searchText, prescriptionsList]);

  const filterData = () => {
    if (!searchText || searchText.trim() === '') {
      setFilteredTableList([...prescriptionsList]);
      setPaginatedCardList([...prescriptionsList]);
      setFilteredCardList(prescriptionsList.slice(0, rowsPerPage));
    } else {
      const filtered = prescriptionsList.filter((item) => matchesSearch(item));
      setFilteredTableList(filtered);
      setPaginatedCardList(filtered);
      updatePaginatedList(filtered, 1);
    }
  };

  const matchesSearch = (item: PrescriptionRecord): boolean => {
    const search = searchText.toLowerCase().trim();
    const containsSearchText = (value: any) =>
      value?.toString().toLowerCase().includes(search);

    return (
      containsSearchText(item.medicationName) ||
      containsSearchText(item.drugDisplayTitle) ||
      containsSearchText(item.dosage) ||
      containsSearchText(item.frequency) ||
      containsSearchText(item.quantity) ||
      containsSearchText(item.refills) ||
      containsSearchText(item.prescriberName) ||
      containsSearchText(item.prescriptionDate)
    );
  };

  const updatePaginatedList = (data: PrescriptionRecord[], page: number = currentPage) => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    setFilteredCardList(data.slice(start, end));
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updatePaginatedList(paginatedCardList, page);
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
            <li className="text-gray-900 dark:text-white font-medium">Prescriptions</li>
          </ul>
        </div>

        {/* Page Header */}
        <div className="mb-5">
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
    
    {/* Left Section */}
    <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1">
      
      <h3 className="text-xl font-semibold">
        Prescriptions
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
                {prescriptionsList.length === 0
                  ? 'No prescriptions recorded for patient.'
                  : 'No record found.'}
              </div>
            ) : (
              filteredCardList.map((prescription) => (
                <div
                  key={prescription._id}
                  className="panel md:col-span-1 shadow-equal hover:shadow-equal-lg transition-shadow duration-200"
                >
                  <div className="mb-4 pb-3 border-b border-white-light dark:border-[#191e3a] flex items-start justify-between gap-2">
                    <h5 className="text-base font-semibold flex-1 min-w-0 text-primary break-words line-clamp-2">
                      {prescription.drugDisplayTitle || prescription.medicationName || 'Prescription Record'}
                    </h5>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <h6 className="text-primary text-sm uppercase font-semibold mb-2">Prescription Details</h6>
                      <div className="space-y-2">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Dosage:</span>
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white break-words">
                            <span className="hidden sm:inline">{prescription.dosage || '---'}</span>
                            <span className="sm:hidden">
                              {(() => {
                                const { trimmed, preview, needsMore } = wordsPreview(prescription.dosage, 4);
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
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white break-words">
                            <span className="hidden sm:inline">{prescription.frequency || '---'}</span>
                            <span className="sm:hidden">
                              {(() => {
                                const { trimmed, preview, needsMore } = wordsPreview(prescription.frequency, 4);
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
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Quantity:</span>
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white break-words">
                            {prescription.quantity || '---'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Refills:</span>
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white break-words">
                            {prescription.refills || '---'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Prescriber:</span>
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white break-words">
                            {prescription.prescriberName || '---'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">{PRESCRIPTION_DATE_LABEL}:</span>
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white break-words">
                            {prescription.prescriptionDate?.trim() || '---'}
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
                <span aria-hidden>×</span>
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

export default Prescriptions;
