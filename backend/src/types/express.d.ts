import 'express';

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                tenantId: string;
                role: 'admin' | 'physician' | 'nurse' | 'pharmacist' | 'billing' | 'staff';
                name: string;
                email: string;
            };
            tenant?: {
                status: string;
                enabledModules: string[];
            };
            smart?: {
                patientId: string;
                patientAccountId: string;
                clientId: string;
                scopes: string[];
                tenantId: string;
                authorizationId: string;
            };
        }
    }
}

export {};
