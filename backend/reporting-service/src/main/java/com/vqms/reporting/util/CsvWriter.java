package com.vqms.reporting.util;

import java.util.List;

/**
 * RFC 4180 CSV with spreadsheet formula-injection protection: cells starting with = + - @ (or tab/CR)
 * are prefixed with an apostrophe so Excel treats them as text, not as formulas.
 */
public final class CsvWriter {

    private CsvWriter() {
    }

    public static String write(List<List<String>> rows) {
        StringBuilder sb = new StringBuilder();
        for (List<String> row : rows) {
            for (int i = 0; i < row.size(); i++) {
                if (i > 0) {
                    sb.append(',');
                }
                sb.append(cell(row.get(i)));
            }
            sb.append("\r\n");
        }
        return sb.toString();
    }

    static String cell(String value) {
        String v = value == null ? "" : value;
        if (!v.isEmpty() && "=+-@\t\r".indexOf(v.charAt(0)) >= 0 && !isNumber(v)) {
            v = "'" + v;
        }
        if (v.contains(",") || v.contains("\"") || v.contains("\n") || v.contains("\r")) {
            v = "\"" + v.replace("\"", "\"\"") + "\"";
        }
        return v;
    }

    private static boolean isNumber(String v) {
        return v.matches("^-?\\d+(\\.\\d+)?$");
    }
}
