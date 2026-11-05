// Chart colours. Recharts needs literal colour values (CSS variables are not supported in SVG attributes),
// so neutrals use semi-transparent greys that read correctly on both the light and the dark theme.
export const CHART = {
  primary: '#f26a1b', // brand-600 (same in both themes)
  grid: 'rgba(128, 128, 128, 0.18)',
  axisLine: 'rgba(128, 128, 128, 0.35)',
  axisText: '#8c8c8c', // mid grey: readable on white and on charcoal
  cursor: 'rgba(128, 128, 128, 0.10)',
  track: 'rgba(128, 128, 128, 0.25)', // empty legend underline / tracks
};

export const AXIS_TICK = { fontSize: 12, fill: CHART.axisText };

// Categorical series (no status meaning), led by the accent.
export const SERIES = ['#f26a1b', '#3b82f6', '#8b5cf6', '#14b8a6', '#eab308', '#ec4899'];
