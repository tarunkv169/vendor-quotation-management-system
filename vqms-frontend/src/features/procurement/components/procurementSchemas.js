import { z } from 'zod';

const decimal = (message) =>
  z
    .string()
    .trim()
    .min(1, message)
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, 'Enter a valid non-negative amount');

const optionalDecimal = z
  .string()
  .trim()
  .refine((value) => value === '' || (!Number.isNaN(Number(value)) && Number(value) >= 0), 'Enter a valid non-negative amount');

const positiveInt = (message) =>
  z
    .string()
    .trim()
    .min(1, message)
    .refine((value) => Number.isInteger(Number(value)) && Number(value) >= 1, 'Quantity must be greater than zero');

// Mirrors ProcurementItemRequest.
export const itemSchema = z.object({
  description: z.string().trim().min(3, 'Description must contain between 3 and 200 characters').max(200, 'Description must contain between 3 and 200 characters'),
  quantity: positiveInt('Quantity is required'),
  unit: z.string().trim().min(2, 'Unit must contain between 2 and 50 characters').max(50, 'Unit must contain between 2 and 50 characters'),
  expectedUnitPrice: decimal('Expected unit price is required'),
  category: z.string().trim().max(100, 'Category cannot exceed 100 characters'),
  specification: z.string().trim().max(5000, 'Specification cannot exceed 5000 characters'),
  priority: z.string().trim().max(20, 'Priority cannot exceed 20 characters'),
});

// Mirrors ProcurementRequestRequest.
export const requestSchema = z.object({
  title: z.string().trim().min(1, 'Procurement request title is required').max(200),
  description: z.string().trim().min(1, 'Procurement request description is required').max(5000),
  quantity: positiveInt('Quantity is required'),
  unit: z.string().trim().min(1, 'Unit is required').max(50),
  requiredBy: z
    .string()
    .min(1, 'Required delivery date is required')
    .refine((value) => new Date(value).getTime() > Date.now(), 'Required delivery date must be in the future'),
  budget: optionalDecimal,
  items: z.array(itemSchema),
});

export const emptyItem = { description: '', quantity: '1', unit: '', expectedUnitPrice: '', category: '', specification: '', priority: '' };

export function toItemPayload(item) {
  return {
    description: item.description,
    quantity: Number(item.quantity),
    unit: item.unit,
    expectedUnitPrice: Number(item.expectedUnitPrice),
    category: item.category || undefined,
    specification: item.specification || undefined,
    priority: item.priority || undefined,
  };
}

// LocalDateTime without zone, as the backend expects.
export function toRequestPayload(values) {
  return {
    title: values.title,
    description: values.description,
    quantity: Number(values.quantity),
    unit: values.unit,
    requiredBy: values.requiredBy.length === 16 ? `${values.requiredBy}:00` : values.requiredBy,
    budget: values.budget === '' ? undefined : Number(values.budget),
    items: values.items?.length ? values.items.map(toItemPayload) : undefined,
  };
}

