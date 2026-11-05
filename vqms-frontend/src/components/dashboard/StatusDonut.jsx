import { Link } from 'react-router-dom';
import { Cell, Pie, PieChart } from 'recharts';
import { formatNumber } from '@/utils/formatCurrency';
import { CHART } from '@/utils/chartTheme';

/**
 * Donut with the total in the centre and a legend of counts, each underlined in its colour.
 * rows: [{ key, label, value, color, to? }]. Legend rows with value 0 stay visible (a real 0 is information);
 * the ring only draws non-zero segments.
 */
export default function StatusDonut({ rows, total, centerLabel = 'Total' }) {
  const ring = rows.filter((row) => row.value > 0);
  const sum = total ?? rows.reduce((acc, row) => acc + row.value, 0);

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-[124px] w-[124px] shrink-0">
        {ring.length > 0 ? (
          <PieChart width={124} height={124}>
            <Pie
              data={ring}
              dataKey="value"
              nameKey="label"
              innerRadius={40}
              outerRadius={60}
              startAngle={90}
              endAngle={-270}
              paddingAngle={ring.length > 1 ? 3 : 0}
              cornerRadius={ring.length > 1 ? 3 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {ring.map((row) => (
                <Cell key={row.key} fill={row.color} />
              ))}
            </Pie>
          </PieChart>
        ) : (
          <div className="absolute inset-[2px] rounded-full border-[18px] border-slate-100" aria-hidden="true" />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-xl font-semibold text-slate-900">{formatNumber(sum)}</span>
          <span className="text-2xs text-slate-500">{centerLabel}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2.5">
        {rows.map((row) => {
          const body = (
            <>
              <span className="flex items-center justify-between gap-3 text-13">
                <span className="flex min-w-0 items-center gap-2 text-slate-700">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.color }} aria-hidden="true" />
                  <span className="truncate">{row.label}</span>
                </span>
                <span className="num font-medium text-slate-900">{formatNumber(row.value)}</span>
              </span>
              <span className="mt-1.5 block h-0.5 rounded-full" style={{ background: row.value ? row.color : CHART.track }} aria-hidden="true" />
            </>
          );
          return (
            <li key={row.key}>
              {row.to ? (
                <Link to={row.to} className="block rounded hover:opacity-80">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
