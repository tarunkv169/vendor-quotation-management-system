-- Default INR policies (adjust through the approval-policy API; amounts in INR).
-- STANDARD: up to 5,00,000 -> procurement manager.
-- HIGH_VALUE: above 5,00,000 -> procurement manager, then procurement admin.
INSERT INTO approval_policies (id, code, name, description, currency_code, min_amount, max_amount, approval_mode,
                               levels, escalation_role, escalation_hours, priority, active, created_at, updated_at, version)
VALUES
    ('7a1f0000-0000-4000-8000-000000000001', 'STANDARD', 'Standard purchases', 'Single-level approval',
     'INR', 0, 500000, 'SEQUENTIAL',
     '[{"levelNumber":1,"level":"LEVEL_1","requiredRole":"PROCUREMENT_MANAGER","approvalLimit":500000,"deadlineHours":48}]',
     'PROCUREMENT_ADMIN', 24, 0, TRUE, now(), now(), 0),
    ('7a1f0000-0000-4000-8000-000000000002', 'HIGH_VALUE', 'High-value purchases', 'Two-level sequential approval',
     'INR', 500000.0001, NULL, 'SEQUENTIAL',
     '[{"levelNumber":1,"level":"LEVEL_1","requiredRole":"PROCUREMENT_MANAGER","approvalLimit":500000,"deadlineHours":48},
       {"levelNumber":2,"level":"LEVEL_2","requiredRole":"PROCUREMENT_ADMIN","approvalLimit":999999999999,"deadlineHours":72}]',
     'ADMIN', 24, 0, TRUE, now(), now(), 0);
