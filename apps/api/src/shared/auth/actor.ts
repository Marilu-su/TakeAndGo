export type Role =
    | 'CUSTOMER'
    | 'STORE_EMPLOYEE'
    | 'STORE_ADMIN'
    | 'ORGANIZATION_ADMIN';

export type Actor = {
    userId: string;
    role: Role;
    organizationId?: string;
    storeId?: string;
};