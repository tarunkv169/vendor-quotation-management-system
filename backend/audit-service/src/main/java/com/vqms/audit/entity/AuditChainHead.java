package com.vqms.audit.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Last link of the hash chain (single row, id = 1). Locked pessimistically while appending. */
@Entity
@Table(name = "audit_chain_head")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AuditChainHead {

    public static final short ID = 1;

    @Id
    @Column(name = "id")
    private short id;

    @Column(name = "last_sequence", nullable = false)
    private long lastSequence;

    @Column(name = "last_hash", nullable = false, length = 64)
    private String lastHash;

    public void advance(long sequence, String hash) {
        this.lastSequence = sequence;
        this.lastHash = hash;
    }
}
