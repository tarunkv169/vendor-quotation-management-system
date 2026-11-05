import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DataTable from '@/components/common/DataTable';
import SummaryPanel from '@/components/common/SummaryPanel';
import DetailList from '@/components/common/DetailList';
import JsonView from '@/components/common/JsonView';
import { humanize } from '@/utils/constants';
import { formatNumber } from '@/utils/formatCurrency';
import { AXIS_TICK, CHART } from '@/utils/chartTheme';

const isScalar = (value) => value === null || ['string', 'number', 'boolean'].includes(typeof value);
const label = (key) => humanize(key.replace(/([a-z])([A-Z])/g, '$1_$2'));
const show = (value) => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return formatNumber(value, 2);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (isScalar(value)) return String(value);
  return <code className="text-xs text-slate-500">{JSON.stringify(value).slice(0, 80)}</code>;
};

function NumberMap({ title, data }) {
  const rows = Object.entries(data).map(([key, value]) => ({ name: humanize(key), value: Number(value) }));
  return (
    <SummaryPanel title={label(title)}>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="name" tick={{ ...AXIS_TICK, fontSize: 11 }} interval={0} axisLine={{ stroke: CHART.axisLine }} />
            <YAxis allowDecimals={false} tick={{ ...AXIS_TICK, fontSize: 11 }} width={36} axisLine={{ stroke: CHART.axisLine }} />
            <Tooltip formatter={(value) => formatNumber(value, 2)} />
            <Bar dataKey="value" name={label(title)} fill={CHART.primary} radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SummaryPanel>
  );
}

function ObjectTable({ title, rows }) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}))));
  return (
    <SummaryPanel title={label(title)} footer={`${rows.length} rows`} bodyClassName="overflow-hidden p-0">
      <DataTable dense rowKey={(_, index) => index} columns={columns.map((key) => ({ key, header: label(key), render: (row) => show(row?.[key]) }))} rows={rows} empty={{ title: 'No rows' }} />
    </SummaryPanel>
  );
}

/** Renders the JSON `data` of a ReportResponse exactly as returned by the Reporting Service. */
export default function ReportDataView({ data }) {
  if (!data || typeof data !== 'object') return <JsonView value={data} />;
  const entries = Object.entries(data);
  const scalars = entries.filter(([, value]) => isScalar(value));
  const numberMaps = entries.filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).length > 0 && Object.values(value).every((item) => typeof item === 'number'));
  const tables = entries.filter(([, value]) => Array.isArray(value) && value.length > 0 && value.every((item) => item && typeof item === 'object'));
  const shown = new Set([...scalars, ...numberMaps, ...tables].map(([key]) => key));
  const rest = entries.filter(([key]) => !shown.has(key));

  return (
    <div className="space-y-6">
      {scalars.length > 0 && (
        <SummaryPanel title="Summary">
          <DetailList columns={4} items={scalars.map(([key, value]) => ({ label: label(key), value: show(value) }))} />
        </SummaryPanel>
      )}
      {numberMaps.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {numberMaps.map(([key, value]) => (
            <NumberMap key={key} title={key} data={value} />
          ))}
        </div>
      )}
      {tables.map(([key, value]) => (
        <ObjectTable key={key} title={key} rows={value} />
      ))}
      {rest.length > 0 && (
        <SummaryPanel title="Other data">
          <JsonView value={Object.fromEntries(rest)} />
        </SummaryPanel>
      )}
    </div>
  );
}
