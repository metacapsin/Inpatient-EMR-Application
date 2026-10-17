// Family member / patient data (matches API response data object)

export interface FamilyMemberData {
    _id: string;
    profilePictureUrl?: string | null;
    firstName: string;
    middleName?: string;
    lastName: string;
    suffix?: string;
    prefix?: string;
    dOB?: string;
    sex?: string;
    emailAddress?: string;
    fullName: string;
    homePhone?: string;
    mobilePhone?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    mrn?: string;
    lastVisitDate?: string;
    [key: string]: any;
}

export interface FamilyMemberApiResponse {
    data: FamilyMemberData;
    status: string;
    message: string;
}
