package com.vqms.audit.dto.response;

import java.time.Instant;

/**
 * Result of re-computing the whole hash chain.
 *
 * @param firstBrokenSequence sequence number of the first record whose hash or link does not match (null if intact)
 */
public record ChainVerificationResponse(boolean intact, long recordsChecked, Long firstBrokenSequence,
                                        String reason, Instant verifiedAt) {
}
