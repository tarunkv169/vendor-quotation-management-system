package com.vqms.document.security;

import java.util.UUID;

/**
 * Identity of the caller, built only from the verified JWT.
 *
 * @param userId   user UUID from the userId claim
 * @param username JWT subject
 * @param role     role without the ROLE_ prefix
 * @param vendorId vendor UUID; present only for vendor users
 */
public record AuthenticatedUser(UUID userId, String username, String role, UUID vendorId) {

    public boolean isVendor() {
        return Roles.VENDOR.equals(role);
    }

    public boolean isAdministrator() {
        return Roles.ADMINISTRATORS.contains(role);
    }

    public boolean isReviewer() {
        return Roles.REVIEWERS.contains(role);
    }

    public boolean isInternalService() {
        return Roles.INTERNAL_SERVICE.equals(role);
    }

    /** Staff and internal services may see all documents; vendors only their own. */
    public boolean hasGlobalReadAccess() {
        return isAdministrator() || isReviewer() || isInternalService();
    }
}
