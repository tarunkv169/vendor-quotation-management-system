import { useSyncExternalStore } from 'react';
import { aiExtractionEnabled, subscribeExtractionStatus } from '@/utils/features';

/** true while AI extraction can run (build flag and no "extraction disabled" answer from the service). */
export function useAiExtraction() {
  return useSyncExternalStore(subscribeExtractionStatus, aiExtractionEnabled, aiExtractionEnabled);
}
