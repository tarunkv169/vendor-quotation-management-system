<#import "/spring.ftl" as spring />
<#-- VQMS version of the "last 1000 events" page (replaces the stock Spring Cloud Netflix template; same model data). -->
<!doctype html>
<html lang="en">
  <head>
    <base href="<@spring.url basePath/>">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Eureka · Last 1000 events</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%234146e5'/%3E%3Cpath d='M9 10l7 13 7-13' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
    <#include "vqms-theme.ftlh">
    <style>.panel[hidden] { display: none; }</style>
  </head>
  <body>
    <main class="page">
      <header class="row between wrap">
        <div class="row grow" style="gap:16px">
          <span class="icon-tile"><@icon "history"/></span>
          <div class="grow">
            <h1>Lease Events</h1>
            <p class="sub">Last 1000 newly registered and cancelled leases since the registry started.</p>
          </div>
        </div>
        <div class="row wrap">
          <a class="btn" href="<@spring.url dashboardPath/>"><@icon "home"/>Back to registry</a>
          <button type="button" class="btn" onclick="location.reload()"><@icon "refresh"/>Refresh</button>
        </div>
      </header>

      <section class="card" style="margin-top:24px">
        <nav class="tabs" role="tablist">
          <a href="#registered" role="tab" data-tab="registered" class="active">Newly registered<span class="count">${lastNRegistered?size}</span></a>
          <a href="#cancelled" role="tab" data-tab="cancelled">Cancelled<span class="count">${lastNCanceled?size}</span></a>
        </nav>
        <div class="table-wrap" style="padding-top:16px">
          <div class="panel" id="panel-registered">
            <table id="lastNRegistered" data-sortable>
              <thead><tr><th class="sortable" data-col="0">Timestamp</th><th class="sortable" data-col="1">Lease</th></tr></thead>
              <tbody>
                <#if lastNRegistered?has_content>
                  <#list lastNRegistered as entry>
                    <tr><td style="white-space:nowrap">${entry.date?datetime}</td><td><span class="app"><span class="mini"><@icon "box"/></span>${entry.id}</span></td></tr>
                  </#list>
                <#else>
                  <tr data-empty><td colspan="2" class="empty">No results available</td></tr>
                </#if>
              </tbody>
            </table>
          </div>
          <div class="panel" id="panel-cancelled" hidden>
            <table id="lastNCanceled" data-sortable>
              <thead><tr><th class="sortable" data-col="0">Timestamp</th><th class="sortable" data-col="1">Lease</th></tr></thead>
              <tbody>
                <#if lastNCanceled?has_content>
                  <#list lastNCanceled as entry>
                    <tr><td style="white-space:nowrap">${entry.date?datetime}</td><td><span class="app"><span class="mini"><@icon "box"/></span>${entry.id}</span></td></tr>
                  </#list>
                <#else>
                  <tr data-empty><td colspan="2" class="empty">No results available</td></tr>
                </#if>
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <footer>VQMS · Eureka</footer>
    </main>
    <@sortScript/>
    <script>
      function showTab(name) {
        document.querySelectorAll('.tabs a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-tab') === name); });
        document.getElementById('panel-registered').hidden = name !== 'registered';
        document.getElementById('panel-cancelled').hidden = name !== 'cancelled';
      }
      document.querySelectorAll('.tabs a').forEach(function (a) {
        a.addEventListener('click', function (event) { event.preventDefault(); history.replaceState(null, '', location.pathname + location.search + a.getAttribute('href')); showTab(a.getAttribute('data-tab')); });
      });
      showTab(location.hash === '#cancelled' ? 'cancelled' : 'registered');
    </script>
  </body>
</html>
