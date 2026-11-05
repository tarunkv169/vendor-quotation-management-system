package com.vqms.comparison.exception;

import java.util.Set;

/**
 * Quotations use different currencies and no comparison currency was chosen.
 * Amounts in different currencies are never compared without an approved exchange-rate source. HTTP 422.
 */
public class IncompatibleCurrencyException extends RuntimeException {

    public IncompatibleCurrencyException(Set<String> currencies) {
        super("Quotations use different currencies " + currencies
                + "; specify currencyCode to compare only quotations in one currency");
    }
}
