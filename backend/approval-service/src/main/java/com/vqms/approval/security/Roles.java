package com.vqms.approval.security;

import java.util.Set;

/** Role names from the Identity Service "role" claim (without ROLE_ prefix). */
public final class Roles {

    public static final String ADMIN = "ADMIN";
    public static final String PROCUREMENT_ADMIN = "PROCUREMENT_ADMIN";
    public static final String PROCUREMENT_MANAGER = "PROCUREMENT_MANAGER";
    public static final String EMPLOYEE = "EMPLOYEE";
    public static final String VENDOR = "VENDOR";
    public static final String INTERNAL_SERVICE = "INTERNAL_SERVICE";

    public static final Set<String> ADMINISTRATORS = Set.of(ADMIN, PROCUREMENT_ADMIN);
    public static final Set<String> REVIEWERS = Set.of(PROCUREMENT_MANAGER, EMPLOYEE);

    private Roles() {
    }
}
