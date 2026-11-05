import { useSyncExternalStore } from 'react';
import { documentStorageEnabled, subscribeStorageStatus } from '@/utils/features';

/** true while uploads/downloads are possible (build flag and no "storage disabled" answer from the server). */
export function useDocumentStorage() {
  return useSyncExternalStore(subscribeStorageStatus, documentStorageEnabled, documentStorageEnabled);
}
