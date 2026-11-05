package com.vqms.approval.entity;

import com.vqms.approval.entity.base.BaseEntity;
import com.vqms.approval.entity.json.PolicyLevel;
import com.vqms.approval.enums.ApprovalMode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Approval policy for an amount band in one currency: which levels must approve, in which mode,
 * with which limits and deadlines, and who receives escalations.
 */
@Entity
@Table(name = "approval_policies")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalPolicy extends BaseEntity {

    @Column(name = "code", nullable = false, length = 40, unique = true)
    private String code;

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "currency_code", nullable = false, length = 3)
    private String currencyCode;

    @Column(name = "min_amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal minAmount;

    /** Null = no upper bound. */
    @Column(name = "max_amount", precision = 19, scale = 4)
    private BigDecimal maxAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "approval_mode", nullable = false, length = 20)
    private ApprovalMode mode;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "levels", nullable = false, columnDefinition = "jsonb")
    private List<PolicyLevel> levels;

    @Column(name = "escalation_role", nullable = false, length = 40)
    private String escalationRole;

    @Column(name = "escalation_hours", nullable = false)
    private int escalationHours;

    /** Higher wins when several active policies match the same amount. */
    @Column(name = "priority", nullable = false)
    private int priority;

    @Column(name = "active", nullable = false)
    private boolean active;

    @Column(name = "created_by")
    private UUID createdBy;

    public ApprovalPolicy(String code, UUID createdBy) {
        this.code = code;
        this.createdBy = createdBy;
        this.active = true;
    }

    public void update(String name, String description, String currencyCode, BigDecimal minAmount,
                       BigDecimal maxAmount, ApprovalMode mode, List<PolicyLevel> levels, String escalationRole,
                       int escalationHours, int priority) {
        this.name = name;
        this.description = description;
        this.currencyCode = currencyCode;
        this.minAmount = minAmount;
        this.maxAmount = maxAmount;
        this.mode = mode;
        this.levels = List.copyOf(levels);
        this.escalationRole = escalationRole;
        this.escalationHours = escalationHours;
        this.priority = priority;
    }

    public void deactivate() {
        this.active = false;
    }

    public boolean covers(BigDecimal amount, String currency) {
        return active && currencyCode.equals(currency) && amount.compareTo(minAmount) >= 0
                && (maxAmount == null || amount.compareTo(maxAmount) <= 0);
    }
}
