/** What the current user may do with a comparison in its current state (same rules as the detail page). */
export function comparisonPermissions(comparison, can) {
  return {
    canCalculate: can('comparison.manage') && comparison.status !== 'COMPLETED',
    calculateLabel: comparison.status === 'CREATED' ? 'Calculate' : 'Recalculate',
    canComplete: can('comparison.complete') && comparison.status === 'CALCULATED',
    canRecommend: can('recommendation.generate') && comparison.status === 'COMPLETED',
  };
}
