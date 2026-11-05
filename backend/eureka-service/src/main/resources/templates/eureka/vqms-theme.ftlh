<#-- VQMS look for the Eureka dashboard: same navy / indigo design system as the VQMS web app.
     Included by status.ftlh and lastn.ftlh (which replace the stock Spring Cloud templates). -->
<style>
  :root {
    --bg: #f5f6fb; --surface: #ffffff; --line: #e7e8f0; --line-strong: #d6d8e4;
    --text: #1c2033; --muted: #646b85; --faint: #9aa0b8;
    --brand: #4146e5; --brand-soft: #eef0ff; --brand-text: #3436c4;
    --success: #16a34a; --success-soft: #ecfdf5; --warning: #d97706; --warning-soft: #fffbeb;
    --danger: #dc2626; --danger-soft: #fef2f2; --info: #1d4ed8; --info-soft: #eff6ff;
    --head: #f8f9fc; --shadow: 0 1px 2px rgba(20, 28, 72, .06), 0 1px 3px rgba(20, 28, 72, .05);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #262626; --surface: #383838; --line: #474747; --line-strong: #5a5a5a;
      --text: #f2f2f2; --muted: #b3b3b3; --faint: #8c8c8c;
      --brand: #6366f1; --brand-soft: #272b4f; --brand-text: #a5abff;
      --success: #22a559; --success-soft: #243d31; --warning: #f59e0b; --warning-soft: #423624;
      --danger: #ef4444; --danger-soft: #432a2a; --info: #60a5fa; --info-soft: #243447;
      --head: #333333; --shadow: none;
    }
  }
  * { box-sizing: border-box; }
  html { -webkit-font-smoothing: antialiased; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.45 Inter, "Segoe UI", system-ui, -apple-system, sans-serif; }
  a { color: inherit; }
  .page { max-width: 1440px; margin: 0 auto; padding: 24px 32px 40px; }
  .row { display: flex; align-items: center; gap: 12px; }
  .between { justify-content: space-between; }
  .wrap { flex-wrap: wrap; }
  .grow { flex: 1; min-width: 0; }
  .icon-tile { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 56px; height: 56px; border-radius: 12px; background: var(--brand-soft); color: var(--brand); }
  .icon-tile svg { width: 28px; height: 28px; }
  h1 { margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -.01em; }
  .sub { margin: 2px 0 0; color: var(--muted); }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 13px; font-weight: 600; white-space: nowrap; }
  .pill-dot::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .pill-ok { background: var(--success-soft); color: var(--success); }
  .pill-bad { background: var(--danger-soft); color: var(--danger); }
  .pill-brand { background: var(--brand-soft); color: var(--brand-text); }
  .btn { display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--text); font: inherit; font-weight: 500; text-decoration: none; cursor: pointer; }
  .btn:hover { border-color: var(--line-strong); }
  .btn svg { width: 16px; height: 16px; }
  .muted { color: var(--muted); } .small { font-size: 12px; }
  .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-top: 24px; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; box-shadow: var(--shadow); min-width: 0; }
  .kpi { display: flex; align-items: center; gap: 16px; padding: 20px; }
  .kpi .circle { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 56px; height: 56px; border-radius: 50%; }
  .kpi .circle svg { width: 26px; height: 26px; }
  .kpi .label { font-size: 13px; color: var(--muted); }
  .kpi .value { font-size: 26px; font-weight: 600; line-height: 1.2; font-variant-numeric: tabular-nums; }
  .tone-brand { background: var(--brand-soft); color: var(--brand); } .tone-success { background: var(--success-soft); color: var(--success); }
  .tone-info { background: var(--info-soft); color: var(--info); } .tone-warning { background: var(--warning-soft); color: var(--warning); }
  .alert { display: flex; gap: 10px; align-items: flex-start; margin-top: 20px; padding: 12px 16px; border-radius: 8px; border: 1px solid; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: .01em; }
  .alert svg { width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }
  .alert-warn { background: var(--warning-soft); border-color: color-mix(in srgb, var(--warning) 35%, transparent); color: var(--danger); }
  .alert-danger { background: var(--danger-soft); border-color: color-mix(in srgb, var(--danger) 35%, transparent); color: var(--danger); }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 20px; margin-top: 20px; align-items: start; }
  .stack { display: grid; gap: 20px; min-width: 0; }
  .card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 20px 14px; }
  .card-head h2 { margin: 0; font-size: 17px; font-weight: 600; }
  .card-head .head-icon { width: 24px; height: 24px; color: var(--brand); flex-shrink: 0; margin-top: 2px; }
  .table-wrap { overflow-x: auto; padding: 0 16px 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th { background: var(--head); color: var(--muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; text-align: left; padding: 10px 12px; white-space: nowrap; }
  thead th:first-child { border-radius: 6px 0 0 6px; } thead th:last-child { border-radius: 0 6px 6px 0; }
  th.sortable { cursor: pointer; user-select: none; } th.sortable:hover { color: var(--text); }
  th.sortable::after { content: " \2195"; opacity: .5; }
  tbody td { padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: middle; }
  tbody tr:last-child td { border-bottom: 0; }
  tbody tr:hover td { background: color-mix(in srgb, var(--brand-soft) 45%, transparent); }
  .app { display: flex; align-items: center; gap: 12px; font-weight: 600; }
  .app .mini { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px; background: var(--brand-soft); color: var(--brand); flex-shrink: 0; }
  .app .mini svg { width: 16px; height: 16px; }
  .status-cell { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .instance { display: inline-flex; align-items: center; gap: 5px; color: var(--success); font-size: 13px; text-decoration: underline; text-underline-offset: 2px; word-break: break-all; }
  .instance.bad { color: var(--danger); }
  .instance svg { width: 14px; height: 14px; flex-shrink: 0; }
  .empty { padding: 32px 12px; text-align: center; color: var(--muted); }
  .kv { list-style: none; margin: 0; padding: 0 16px 16px; }
  .kv li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 4px; border-top: 1px solid var(--line); }
  .kv .tag { padding: 2px 8px; border-radius: 6px; background: var(--head); font-weight: 600; font-size: 13px; font-variant-numeric: tabular-nums; }
  .kv .tag.true { background: var(--success-soft); color: var(--success); } .kv .tag.false { background: var(--danger-soft); color: var(--danger); }
  .stat-name { display: flex; align-items: center; gap: 10px; }
  .stat-name svg { width: 16px; height: 16px; color: var(--brand); flex-shrink: 0; }
  details.card > summary { list-style: none; cursor: pointer; }
  details.card > summary::-webkit-details-marker { display: none; }
  details.card > summary .chev { transition: transform .15s; } details[open].card > summary .chev { transform: rotate(180deg); }
  .tabs { display: flex; gap: 24px; padding: 0 20px; border-bottom: 1px solid var(--line); }
  .tabs a { padding: 10px 0; color: var(--muted); text-decoration: none; font-weight: 500; border-bottom: 2px solid transparent; margin-bottom: -1px; }
  .tabs a.active { color: var(--brand-text); border-color: var(--brand); }
  .count { margin-left: 6px; padding: 0 6px; border-radius: 6px; background: var(--head); font-size: 12px; }
  footer { margin-top: 24px; text-align: center; color: var(--faint); font-size: 12px; }
  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 640px) { .page { padding: 16px; } .kpis { gap: 10px; } .kpi { padding: 14px; gap: 12px; } .kpi .circle { width: 42px; height: 42px; } .kpi .value { font-size: 20px; } .icon-tile { display: none; } }
</style>
<#-- Icons (lucide, MIT) -->
<#macro icon name>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <#switch name>
      <#case "layers"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/><#break>
      <#case "monitor"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/><#break>
      <#case "clock"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/><#break>
      <#case "refresh"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/><#break>
      <#case "alert"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/><#break>
      <#case "network"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><path d="M10.5 7.6 6.5 16.4"/><path d="m13.5 7.6 4 8.8"/><#break>
      <#case "box"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/><#break>
      <#case "external"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><#break>
      <#case "settings"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/><#break>
      <#case "info"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/><#break>
      <#case "cpu"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/><#break>
      <#case "memory"><path d="M6 19v-3"/><path d="M10 19v-3"/><path d="M14 19v-3"/><path d="M18 19v-3"/><path d="M8 11V9"/><path d="M16 11V9"/><path d="M12 11V9"/><path d="M2 15h20"/><path d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1.1a2 2 0 0 0 0 3.837V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5.1a2 2 0 0 0 0-3.837Z"/><#break>
      <#case "server"><rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/><#break>
      <#case "history"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/><#break>
      <#case "chevron"><path d="m6 9 6 6 6-6"/><#break>
      <#case "home"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><#break>
    </#switch>
  </svg>
</#macro>
<#-- Client-side column sorting for tables marked data-sortable (no external scripts). -->
<#macro sortScript>
<script>
  document.querySelectorAll('table[data-sortable]').forEach(function (table) {
    table.querySelectorAll('th.sortable').forEach(function (th, index) {
      var asc = true;
      th.addEventListener('click', function () {
        var body = table.tBodies[0];
        var rows = Array.prototype.slice.call(body.rows).filter(function (row) { return !row.hasAttribute('data-empty'); });
        var col = Number(th.getAttribute('data-col') || index);
        rows.sort(function (a, b) {
          var x = (a.cells[col] && a.cells[col].innerText.trim().toLowerCase()) || '';
          var y = (b.cells[col] && b.cells[col].innerText.trim().toLowerCase()) || '';
          return asc ? x.localeCompare(y, undefined, { numeric: true }) : y.localeCompare(x, undefined, { numeric: true });
        });
        asc = !asc;
        rows.forEach(function (row) { body.appendChild(row); });
      });
    });
  });
</script>
</#macro>
