package com.vqms.validation.rules;

import com.vqms.validation.dto.internal.IssueDraft;
import com.vqms.validation.dto.internal.ValidationContext;

import java.util.List;

/**
 * A small, stateless check over the validation context. Every Spring bean implementing this
 * interface is picked up automatically by the ValidationEngine, so adding a rule needs no wiring.
 */
public interface ValidationRule {

    List<IssueDraft> validate(ValidationContext context);
}
