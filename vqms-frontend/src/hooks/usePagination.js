import { useCallback, useState } from 'react';

// Server-side pagination + sorting state. Page index is 0-based like Spring.
export function usePagination({ size: initialSize = 10, sortBy: initialSortBy, direction: initialDirection = 'desc' } = {}) {
  const [page, setPage] = useState(0);
  const [size, setSizeState] = useState(initialSize);
  const [sort, setSortState] = useState({ sortBy: initialSortBy, direction: initialDirection });

  const setSize = useCallback((next) => {
    setSizeState(next);
    setPage(0);
  }, []);

  // Clicking the same column toggles direction; a new column starts ascending.
  const toggleSort = useCallback((field) => {
    setSortState((current) => ({
      sortBy: field,
      direction: current.sortBy === field && current.direction === 'asc' ? 'desc' : 'asc',
    }));
    setPage(0);
  }, []);

  // Explicit sort (e.g. from a "Sort by" select).
  const setSort = useCallback((sortBy, direction) => {
    setSortState({ sortBy, direction });
    setPage(0);
  }, []);

  const reset = useCallback(() => setPage(0), []);

  return { page, size, setPage, setSize, sortBy: sort.sortBy, direction: sort.direction, toggleSort, setSort, reset };
}
