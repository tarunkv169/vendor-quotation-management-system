package com.vqms.recommendation.security;

import java.util.UUID;

/** Caller identity built only from the verified JWT. */
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

    /** Procurement staff and internal services. */
    public boolean isStaff() {
        return isAdministrator() || isReviewer() || isInternalService();
    }
}
