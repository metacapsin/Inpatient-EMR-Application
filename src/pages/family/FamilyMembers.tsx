import React, { useState, useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Search, UserPlus, Users, Phone, Mail, Calendar, Hash } from 'lucide-react';
import { patientSubscriptionAPI } from '../../services/api';
import type { FamilyMemberData } from '../../types/family';
import type { SubscriptionMember } from '../../types/premium';
import { IRootState } from '../../store';

// Static JSON: searchable "patients" by MRN (simulates search API results)
const STATIC_SEARCH_PATIENTS: FamilyMemberData[] = [
    {
        _id: '696b3e59d0c882d0b569684f',
        profilePictureUrl: 'https://emr-backend-files.s3.us-east-1.amazonaws.com/94f6a6d9-7871-4a7a-beed-e4f72ec4a7fa/696b3e59d0c882d0b569684f/profile/5f11e46144b1d1ce5f682427dba2c41a8157dd9b.png',
        firstName: 'Akbaruddin',
        middleName: 'AO',
        lastName: 'Owaisi',
        suffix: 'Sr.',
        prefix: 'Mr.',
        dOB: '12/12/2000',
        sex: 'M',
        emailAddress: 'akbar@yopmail.com',
        fullName: 'Akbaruddin AO Owaisi',
        homePhone: '(830) 250-8166',
        mobilePhone: '(830) 250-8166',
        address1: 'bijainagar',
        address2: 'ajmer',
        city: 'Bijainagar',
        state: 'NY',
        zip: '90001',
        mrn: '25000207',
        lastVisitDate: '02/14/2026',
    },
    {
        _id: '696b3e59d0c882d0b569684e',
        firstName: 'Jane',
        middleName: 'M',
        lastName: 'Doe',
        fullName: 'Jane M Doe',
        emailAddress: 'jane.doe@example.com',
        mobilePhone: '(555) 123-4567',
        dOB: '05/15/1995',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90001',
        mrn: '25000208',
    },
    {
        _id: '696b3e59d0c882d0b569684d',
        firstName: 'John',
        lastName: 'Smith',
        fullName: 'John Smith',
        emailAddress: 'john.smith@example.com',
        homePhone: '(555) 987-6543',
        dOB: '08/22/1988',
        city: 'Chicago',
        state: 'IL',
        zip: '60601',
        mrn: '25000209',
    },
    {
        _id: '696b3e59d0c882d0b569684c',
        firstName: 'Maria',
        middleName: 'R',
        lastName: 'Garcia',
        fullName: 'Maria R Garcia',
        emailAddress: 'maria.garcia@example.com',
        mobilePhone: '(555) 456-7890',
        dOB: '03/10/1992',
        city: 'Houston',
        state: 'TX',
        zip: '77001',
        mrn: '25000210',
    },
];

function mapSubscriptionMemberToDisplay(m: SubscriptionMember): { _id: string; fullName: string; emailAddress?: string; dOB?: string; firstName?: string; lastName?: string } {
    const fullName = [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Family Member';
    return {
        _id: m.patientId,
        fullName,
        emailAddress: m.email,
        dOB: m.dob,
        firstName: m.firstName,
        lastName: m.lastName,
    };
}

const FamilyMembers: React.FC = () => {
    const patientData = useSelector((state: IRootState) => state.auth.patientData);
    const patient = patientData?.data ?? patientData;
    const patientId = patient?._id ?? patient?.patientId ?? patient?.id;

    const [mrnSearch, setMrnSearch] = useState('');
    const [addedMembers, setAddedMembers] = useState<FamilyMemberData[]>([]);
    const [addingId, setAddingId] = useState<string | null>(null);
    const [subscriptionMembers, setSubscriptionMembers] = useState<SubscriptionMember[]>([]);
    const [loadingSubscription, setLoadingSubscription] = useState(true);
    const [maxMembers, setMaxMembers] = useState(5);

    useEffect(() => {
        if (!patientId) {
            setLoadingSubscription(false);
            return;
        }
        patientSubscriptionAPI.getSubscription(patientId)
            .then((res) => {
                const data = res.data?.data;
                if (data?.members) {
                    setSubscriptionMembers(data.members);
                    setMaxMembers(data.plan?.numberOfMembers ?? 5);
                }
            })
            .catch(() => {})
            .finally(() => setLoadingSubscription(false));
    }, [patientId]);

    const displayMembers = useMemo(() => {
        const fromApi = subscriptionMembers.map(mapSubscriptionMemberToDisplay);
        const fromLocal = addedMembers.filter((m) => !fromApi.some((a) => a._id === m._id));
        return [...fromApi, ...fromLocal];
    }, [subscriptionMembers, addedMembers]);

    // Filter static list by MRN (partial match)
    const searchResults = useMemo(() => {
        const q = mrnSearch.trim().toLowerCase();
        if (!q) return [];
        return STATIC_SEARCH_PATIENTS.filter(
            (p) => p.mrn?.toLowerCase().includes(q) || p._id?.toLowerCase().includes(q)
        );
    }, [mrnSearch]);

    const isAlreadyAdded = (id: string) => addedMembers.some((m) => m._id === id);

    const handleAddMember = async (member: FamilyMemberData) => {
        if (isAlreadyAdded(member._id)) {
            toast.error('This member is already added.');
            return;
        }
        setAddingId(member._id);
        try {
            // Simulate API request - replace with real add-family-member API later
            await new Promise((r) => setTimeout(r, 600));
            setAddedMembers((prev) => [...prev, member]);
            toast.success(`${member.fullName} added as family member.`);
            setMrnSearch('');
        } catch {
            toast.error('Failed to add family member.');
        } finally {
            setAddingId(null);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Family Members</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Search by MRN and add family members to your account.
                </p>
            </div>

            {/* Add Family Member - top section */}
            <div className="panel border border-primary-200/50 dark:border-primary-800/50 bg-white dark:bg-black rounded-2xl shadow-equal overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-primary-100/50 dark:border-primary-900/50">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-primary" />
                        Add Family Member
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Enter the patient MRN number to search and add a family member.
                    </p>
                </div>
                <div className="p-5 sm:p-6">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                        <input
                            type="text"
                            value={mrnSearch}
                            onChange={(e) => setMrnSearch(e.target.value)}
                            placeholder="Search by MRN number..."
                            className="form-input pl-10 pr-4 py-2.5 w-full rounded-xl border-primary-200/60 dark:border-primary-800/60 bg-white dark:bg-black focus:border-primary focus:ring-primary/20"
                        />
                    </div>

                    {/* Search results list */}
                    {mrnSearch.trim() && (
                        <div className="mt-4 space-y-3">
                            {searchResults.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                                    No patients found for this MRN. Try another number.
                                </p>
                            ) : (
                                <ul className="space-y-3">
                                    {searchResults.map((patient) => (
                                        <li
                                            key={patient._id}
                                            className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-primary-100/50 dark:border-primary-900/50 bg-primary-50/30 dark:bg-primary-950/20 hover:border-primary-200 dark:hover:border-primary-700 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                {patient.profilePictureUrl ? (
                                                    <img
                                                        src={patient.profilePictureUrl}
                                                        alt=""
                                                        className="w-12 h-12 rounded-full object-cover border-2 border-primary-200/60 dark:border-primary-700/60 shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-full bg-primary/15 dark:bg-primary/25 flex items-center justify-center shrink-0">
                                                        <Users className="w-6 h-6 text-primary" />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                                                        {patient.fullName}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                                        <Hash className="w-3.5 h-3.5" /> MRN: {patient.mrn || patient._id}
                                                    </p>
                                                    {patient.emailAddress && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                                            <Mail className="w-3.5 h-3.5" /> {patient.emailAddress}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleAddMember(patient)}
                                                disabled={isAlreadyAdded(patient._id) || addingId !== null}
                                                className="btn btn-primary py-2 px-4 rounded-xl text-sm font-semibold shrink-0 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                {addingId === patient._id ? (
                                                    <>
                                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                        </svg>
                                                        Adding...
                                                    </>
                                                ) : isAlreadyAdded(patient._id) ? (
                                                    'Added'
                                                ) : (
                                                    <>
                                                        <UserPlus className="w-4 h-4" />
                                                        Add
                                                    </>
                                                )}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Your added family members */}
            <div className="panel border border-primary-200/50 dark:border-primary-800/50 bg-white dark:bg-black rounded-2xl shadow-equal overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-primary-100/50 dark:border-primary-900/50">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        Your Family Members
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Family members from your subscription{subscriptionMembers.length > 0 ? ` (${displayMembers.length}/${maxMembers})` : ''}.
                    </p>
                </div>
                <div className="p-5 sm:p-6">
                    {loadingSubscription ? (
                        <div className="flex items-center justify-center py-12">
                            <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        </div>
                    ) : displayMembers.length === 0 ? (
                        <div className="text-center py-12 rounded-xl bg-primary-50/30 dark:bg-primary-950/20 border border-dashed border-primary-200 dark:border-primary-800">
                            <Users className="w-12 h-12 text-primary/50 mx-auto mb-3" />
                            <p className="text-gray-500 dark:text-gray-400 font-medium">No family members added yet</p>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                                {subscriptionMembers.length > 0 ? 'No additional members beyond your subscription.' : 'Use the search above to find and add family members by MRN.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {displayMembers.map((member) => {
                                const familyMember = member as FamilyMemberData;
                                const memberEmail = member.emailAddress ?? (member as { email?: string }).email;
                                const memberDob = member.dOB ?? (member as { dob?: string }).dob;

                                return (
                                    <div
                                        key={member._id}
                                        className="rounded-xl border border-primary-200/50 dark:border-primary-800/50 bg-white dark:bg-black overflow-hidden shadow-equal hover:shadow-primary/10 hover:border-primary-300/60 dark:hover:border-primary-600/60 transition-all"
                                    >
                                        <div className="p-4 sm:p-5">
                                            <div className="flex items-start gap-3 mb-4">
                                                {familyMember.profilePictureUrl ? (
                                                    <img
                                                        src={familyMember.profilePictureUrl}
                                                        alt=""
                                                        className="w-14 h-14 rounded-full object-cover border-2 border-primary-200/60 dark:border-primary-700/60 shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-14 h-14 rounded-full bg-primary/15 dark:bg-primary/25 flex items-center justify-center shrink-0">
                                                        <Users className="w-7 h-7 text-primary" />
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                                                        {member.fullName || [member.firstName, member.lastName].filter(Boolean).join(' ') || 'Family Member'}
                                                    </p>
                                                    {familyMember.mrn && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                            MRN: {familyMember.mrn}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <ul className="space-y-2 text-sm">
                                                {memberEmail && (
                                                    <li className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                                        <Mail className="w-4 h-4 text-primary shrink-0" />
                                                        <span className="truncate">{memberEmail}</span>
                                                    </li>
                                                )}
                                                {(familyMember.mobilePhone || familyMember.homePhone) && (
                                                    <li className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                                        <Phone className="w-4 h-4 text-primary shrink-0" />
                                                        <span>{familyMember.mobilePhone || familyMember.homePhone}</span>
                                                    </li>
                                                )}
                                                {memberDob && (
                                                    <li className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                                        <Calendar className="w-4 h-4 text-primary shrink-0" />
                                                        <span>DOB: {memberDob}</span>
                                                    </li>
                                                )}
                                                {(familyMember.city || familyMember.state) && (
                                                    <li className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                                        <span className="shrink-0 w-4 h-4 rounded bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">@</span>
                                                        <span>
                                                            {[familyMember.city, familyMember.state, familyMember.zip].filter(Boolean).join(', ')}
                                                        </span>
                                                    </li>
                                                )}
                                            </ul>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FamilyMembers;
