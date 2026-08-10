export type StoredValueAdminState = { status: 'idle' | 'success' | 'error'; message: string };

export const initialStoredValueAdminState: StoredValueAdminState = { status: 'idle', message: '' };
