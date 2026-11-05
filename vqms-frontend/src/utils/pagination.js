// Normalises the three list formats returned by the backend into one shape:
//   Spring Page (monolith):        { content, number, size, totalElements, totalPages }
//   Spring Page via DTO:            { content, page: { number, size, totalElements, totalPages } }
//   PageResponse (microservices):   { content, page, size, totalElements, totalPages }
//   plain array (some endpoints)
export function normalizePage(data) {
  if (Array.isArray(data)) {
    return { items: data, page: 0, size: data.length, totalElements: data.length, totalPages: data.length ? 1 : 0 };
  }
  if (!data || typeof data !== 'object') {
    return { items: [], page: 0, size: 0, totalElements: 0, totalPages: 0 };
  }
  const meta = data.page && typeof data.page === 'object' ? data.page : data;
  const page = typeof meta.number === 'number' ? meta.number : typeof meta.page === 'number' ? meta.page : 0;
  return {
    items: data.content || [],
    page,
    size: meta.size ?? (data.content || []).length,
    totalElements: meta.totalElements ?? (data.content || []).length,
    totalPages: meta.totalPages ?? 1,
  };
}

// Monolith endpoints: page, size, sortBy, direction.
export function monolithPageParams({ page = 0, size = 10, sortBy, direction } = {}) {
  const params = { page, size };
  if (sortBy) params.sortBy = sortBy;
  if (direction) params.direction = direction;
  return params;
}

// Microservice endpoints (Spring Pageable): page, size, sort=field,dir.
export function pageableParams({ page = 0, size = 20, sortBy, direction } = {}) {
  const params = { page, size };
  if (sortBy) params.sort = `${sortBy},${direction || 'desc'}`;
  return params;
}

// Drops empty filter values so they are not sent as "?status=".
export function compactParams(params) {
  return Object.fromEntries(
    Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}
