import { z } from 'zod';
import { isUuid } from '@/components/common/EntitySelect';

const nonNegative = (message) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || (!Number.isNaN(Number(value)) && Number(value) >= 0), message);

const optionalInt = z
  .string()
  .trim()
  .refine((value) => value === '' || (Number.isInteger(Number(value)) && Number(value) >= 0), 'Delivery days must be non-negative');

// Mirrors QuotationItemRequest.
export const quotationItemSchema = z.object({
  itemName: z.string().trim().min(1, 'Item name is required').max(255),
  description: z.string().trim().max(5000),
  quantity: z
    .string()
    .trim()
    .min(1, 'Quantity is required')
    .refine((value) => Number.isInteger(Number(value)) && Number(value) >= 1, 'Quantity must be at least 1'),
  unit: z.string().trim().min(1, 'Unit is required').max(50),
  unitPrice: z
    .string()
    .trim()
    .min(1, 'Unit price is required')
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, 'Unit price must be non-negative'),
  specification: z.string().trim().max(5000),
  deliveryDays: optionalInt,
});

// Mirrors QuotationRequest.
export const quotationSchema = z.object({
  purchaseRequestId: z.string().trim().refine(isUuid, 'Purchase request is required'),
  vendorId: z.string().trim().refine(isUuid, 'Vendor is required'),
  quotationDate: z.string().min(1, 'Quotation date is required'),
  validUntil: z.string(),
  submissionDeadline: z.string(),
  currency: z.string().min(3).max(3),
  taxAmount: nonNegative('Tax amount must be non-negative'),
  discountAmount: nonNegative('Discount amount must be non-negative'),
  paymentTerms: z.string().trim().max(500, 'Payment terms cannot exceed 500 characters'),
  deliveryDays: optionalInt,
  warrantyPeriod: z.string().trim().max(200, 'Warranty period cannot exceed 200 characters'),
  notes: z.string().trim().max(5000, 'Notes cannot exceed 5000 characters'),
  items: z.array(quotationItemSchema),
});

export const emptyQuotationItem = { itemName: '', description: '', quantity: '1', unit: '', unitPrice: '', specification: '', deliveryDays: '' };

const num = (value) => (value === '' || value === undefined || value === null ? undefined : Number(value));
const str = (value) => (value ? value : undefined);

export function toQuotationItemPayload(item, currency) {
  return {
    itemName: item.itemName,
    description: str(item.description),
    quantity: Number(item.quantity),
    unit: item.unit,
    unitPrice: Number(item.unitPrice),
    currency,
    specification: str(item.specification),
    deliveryDays: num(item.deliveryDays),
  };
}

export function toQuotationPayload(values, { includeItems = true } = {}) {
  return {
    purchaseRequestId: values.purchaseRequestId,
    vendorId: values.vendorId,
    quotationDate: values.quotationDate,
    validUntil: str(values.validUntil),
    submissionDeadline: str(values.submissionDeadline),
    currency: values.currency,
    taxAmount: num(values.taxAmount),
    discountAmount: num(values.discountAmount),
    paymentTerms: str(values.paymentTerms),
    deliveryDays: num(values.deliveryDays),
    warrantyPeriod: str(values.warrantyPeriod),
    notes: str(values.notes),
    items: includeItems && values.items.length ? values.items.map((item) => toQuotationItemPayload(item, values.currency)) : undefined,
  };
}

export function fromQuotation(data) {
  const text = (value) => (value === null || value === undefined ? '' : String(value));
  return {
    purchaseRequestId: text(data.purchaseRequestId),
    vendorId: text(data.vendorId),
    quotationDate: text(data.quotationDate),
    validUntil: text(data.validUntil),
    submissionDeadline: text(data.submissionDeadline),
    currency: data.currency || 'USD',
    taxAmount: text(data.taxAmount),
    discountAmount: text(data.discountAmount),
    paymentTerms: text(data.paymentTerms),
    deliveryDays: text(data.deliveryDays),
    warrantyPeriod: text(data.warrantyPeriod),
    notes: text(data.notes),
    items: [],
  };
}
