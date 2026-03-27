import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { patientDataAPI } from '../../services/api';
import { usePatientId } from '../../hooks/usePatientId';
import { format } from 'date-fns';
import IconSearch from '../../components/Icon/IconSearch';

interface AllergyRecord {
  _id: string;
  allergyName?: string;
  allergyType?: string;
  severity?: string;
  reaction?: string;
  status?: string;
  onsetDate?: string;
  [key: string]: any;
}

const Allergies: React.FC = () => {
  const patientId = usePatientId();
  const [allergiesList, setAllergiesList] = useState<AllergyRecord[]>([]);
  const [filteredTableList, setFilteredTableList] = useState<AllergyRecord[]>([]);
  const [filteredCardList, setFilteredCardList] = useState<AllergyRecord[]>([]);
  const [paginatedCardList, setPaginatedCardList] = useState<AllergyRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(2);

  const formatDate = (dateString: string): string => {
    if (!dateString || dateString.trim() === '') return '';
    try {
      let dateStr = dateString.trim();
      if (dateStr.includes(' EST') || dateStr.includes(' EDT') || dateStr.includes(' PST') || dateStr.includes(' PDT')) {
        dateStr = dateStr.split(' ')[0];
      }
      
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
          if (!isNaN(date.getTime())) {
            return format(date, 'MM/dd/yyyy');
          }
        }
      }
      
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return format(date, 'MM/dd/yyyy');
    } catch {
      return dateString;
    }
  };

  const getPatientAllergies = useCallback(async () => {
    const rcopiaID = patientId;
    if (!rcopiaID) {
      toast.error('Patient ID is required');
      return;
    }
    setLoading(true);
    try {
      const response = await patientDataAPI.getAllAllergyList(rcopiaID);
      if (response.data?.data || Array.isArray(response.data)) {
        const data = response.data?.data || response.data;
        const formattedData = data.map((item: any) => {
          let allergyName = '';
          if (item.Allergen && Array.isArray(item.Allergen) && item.Allergen.length > 0) {
            const allergen = item.Allergen[0];
            if (allergen.Name && Array.isArray(allergen.Name) && allergen.Name.length > 0) {
              allergyName = allergen.Name[0];
            } else if (allergen.Name) {
              allergyName = allergen.Name;
            }
          }
          
          let allergyType = '';
          if (item.Allergen && Array.isArray(item.Allergen) && item.Allergen.length > 0) {
            const allergen = item.Allergen[0];
            if (allergen.Drug && Array.isArray(allergen.Drug) && allergen.Drug.length > 0) {
              allergyType = 'Drug';
            } else if (allergen.Ingredient && Array.isArray(allergen.Ingredient) && allergen.Ingredient.length > 0) {
              allergyType = 'Ingredient';
            }
          }
          
          let reaction = '';
          if (item.ReactionList && Array.isArray(item.ReactionList) && item.ReactionList.length > 0) {
            const reactionList = item.ReactionList[0];
            if (reactionList.Reaction && Array.isArray(reactionList.Reaction) && reactionList.Reaction.length > 0) {
              const reactionObj = reactionList.Reaction[0];
              if (reactionObj.Description && Array.isArray(reactionObj.Description) && reactionObj.Description.length > 0) {
                reaction = reactionObj.Description[0];
              } else if (reactionObj.Description) {
                reaction = typeof reactionObj.Description === 'string' ? reactionObj.Description : String(reactionObj.Description);
              }
            }
          }

          let severity = '';
          if (item.Severity && Array.isArray(item.Severity) && item.Severity.length > 0) {
            const severityObj = item.Severity[0];
            if (severityObj.Description && Array.isArray(severityObj.Description) && severityObj.Description.length > 0) {
              severity = severityObj.Description[0];
            } else if (severityObj.Description) {
              severity = typeof severityObj.Description === 'string' ? severityObj.Description : String(severityObj.Description);
            }
          }
          
          let onsetDate = '';
          if (item.OnsetDate && Array.isArray(item.OnsetDate) && item.OnsetDate.length > 0) {
            const onsetDateRaw = item.OnsetDate[0];
            if (onsetDateRaw && onsetDateRaw.trim() !== '') {
              onsetDate = formatDate(onsetDateRaw);
            }
          } else if (item.OnsetDate && typeof item.OnsetDate === 'string' && item.OnsetDate.trim() !== '') {
            onsetDate = formatDate(item.OnsetDate);
          }
          
          let status = '';
          if (item.Status && Array.isArray(item.Status) && item.Status.length > 0) {
            const statusObj = item.Status[0];
            if (statusObj.Active !== undefined) {
              status = 'Active';
            } else if (statusObj.Inactive !== undefined) {
              status = 'Inactive';
            }
          }
          if (!status && item.status !== undefined) {
            status = item.status ? 'Active' : 'Inactive';
          }
          
          return {
            ...item,
            allergyName,
            allergyType,
            reaction,
            severity,
            status,
            onsetDate,
          };
        });
        setAllergiesList(formattedData);
        setPaginatedCardList(formattedData);
        setFilteredTableList(formattedData);
        setFilteredCardList(formattedData);
        updatePaginatedList(formattedData, 1);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch allergies');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    getPatientAllergies();
  }, [getPatientAllergies]);

  useEffect(() => {
    filterData();
  }, [searchText, allergiesList]);

  const filterData = () => {
    if (!searchText || searchText.trim() === '') {
      setFilteredTableList([...allergiesList]);
      setPaginatedCardList([...allergiesList]);
      setFilteredCardList(allergiesList.slice(0, rowsPerPage));
    } else {
      const filtered = allergiesList.filter((item) => matchesSearch(item));
      setFilteredTableList(filtered);
      setPaginatedCardList(filtered);
      updatePaginatedList(filtered, 1);
    }
  };

  const matchesSearch = (item: AllergyRecord): boolean => {
    const search = searchText.toLowerCase().trim();
    const containsSearchText = (value: any) =>
      value?.toString().toLowerCase().includes(search);

    return (
      containsSearchText(item.allergyName) ||
      containsSearchText(item.allergyType) ||
      containsSearchText(item.severity) ||
      containsSearchText(item.reaction) ||
      containsSearchText(item.status) ||
      containsSearchText(item.onsetDate)
    );
  };

  const updatePaginatedList = (data: AllergyRecord[], page: number = currentPage) => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    setFilteredCardList(data.slice(start, end));
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updatePaginatedList(paginatedCardList, page);
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
            <li className="text-gray-900 dark:text-white font-medium">Allergies</li>
          </ul>
        </div>

        {/* Page Header */}
        <div className="mb-5">
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
    
    {/* Left Section */}
    <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1">
      
      <h3 className="text-xl font-semibold">
        Allergies
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
                {allergiesList.length === 0
                  ? 'No allergies recorded for patient.'
                  : 'No record found.'}
              </div>
            ) : (
              filteredCardList.map((allergy) => (
                <div key={allergy._id} className="panel md:col-span-1 shadow-equal hover:shadow-equal-lg transition-shadow duration-200">
                  <div className="mb-4 pb-3 border-b border-white-light dark:border-[#191e3a]">
                    <h5 className="text-base font-semibold">
                      {allergy.allergyName || 'Allergy Record'}
                    </h5>
                  </div>
                  <div className="grid grid-cols-1 gap-3">                    <div>
                      <h6 className="text-primary text-sm uppercase font-semibold mb-2">
                        Allergy Details
                      </h6>
                      <div className="space-y-2">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Type:</span>
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">
                            {allergy.allergyType || '---'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Severity:</span>
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">
                            {allergy.severity || '---'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Reaction:</span>
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">
                            {allergy.reaction || '---'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Status:</span>
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">
                            {allergy.status || '---'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">Onset Date:</span>
                          <span className="font-bold ml-2 text-sm text-gray-900 dark:text-white">
                            {allergy.onsetDate || '---'}
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
    </div>
  );
};

export default Allergies;
