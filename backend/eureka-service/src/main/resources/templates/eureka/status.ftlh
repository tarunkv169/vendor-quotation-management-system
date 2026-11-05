<#import "/spring.ftl" as spring />
<#-- VQMS version of the Eureka dashboard (replaces the stock Spring Cloud Netflix template; same model data). -->
<#assign upInstances = 0>
<#assign allInstances = 0>
<#list apps as app>
  <#list app.instanceInfos as info>
    <#assign allInstances = allInstances + info.instances?size>
    <#if !info.isNotUp><#assign upInstances = upInstances + info.instances?size></#if>
  </#list>
</#list>
<!doctype html>
<html lang="en">
  <head>
    <base href="<@spring.url basePath/>">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Eureka · VQMS Service Registry</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%234146e5'/%3E%3Cpath d='M9 10l7 13 7-13' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
    <#include "vqms-theme.ftlh">
  </head>
  <body>
    <main class="page">
      <#-- Header -->
      <header class="row between wrap">
        <div class="row grow" style="gap:16px">
          <span class="icon-tile"><@icon "layers"/></span>
          <div class="grow">
            <h1>Eureka Service Registry</h1>
            <p class="sub">Service discovery and registration dashboard for VQMS microservices</p>
          </div>
        </div>
        <div class="row wrap">
          <#if isBelowRenewThreshold>
            <span class="pill pill-dot pill-bad">Below renew threshold</span>
          <#else>
            <span class="pill pill-dot pill-ok">Running</span>
          </#if>
          <button type="button" class="btn" onclick="location.reload()"><@icon "refresh"/>Refresh</button>
          <a class="btn" href="<@spring.url dashboardPath/>/lastn"><@icon "history"/>Last 1000 events</a>
          <span class="muted small">Last updated: ${currentTime}</span>
        </div>
      </header>

      <#-- KPIs -->
      <section class="kpis" aria-label="Registry figures">
        <div class="card kpi">
          <span class="circle tone-brand"><@icon "layers"/></span>
          <div><div class="label">Registered Services</div><div class="value">${apps?size}</div></div>
        </div>
        <div class="card kpi">
          <span class="circle tone-success"><@icon "monitor"/></span>
          <div>
            <div class="label">Healthy Instances</div>
            <div class="value">${upInstances}</div>
            <#if allInstances != upInstances><div class="small" style="color:var(--danger)">${allInstances - upInstances} not up</div></#if>
          </div>
        </div>
        <div class="card kpi">
          <span class="circle tone-info"><@icon "clock"/></span>
          <div><div class="label">Uptime</div><div class="value">${upTime}</div></div>
        </div>
        <div class="card kpi">
          <span class="circle tone-warning"><@icon "refresh"/></span>
          <div><div class="label">Renewals (last min)</div><div class="value">${registry.numOfRenewsInLastMin}</div></div>
        </div>
      </section>

      <#-- Self-preservation / renew threshold messages (same conditions as the stock dashboard) -->
      <#if isBelowRenewThreshold>
        <#if !registry.selfPreservationModeEnabled>
          <div class="alert alert-danger" role="alert"><@icon "alert"/>Renewals are lesser than the threshold. The self preservation mode is turned off. This may not protect instance expiry in case of network/other problems.</div>
        <#else>
          <div class="alert alert-danger" role="alert"><@icon "alert"/>Emergency! Eureka may be incorrectly claiming instances are up when they're not. Renewals are lesser than threshold and hence the instances are not being expired just to be safe.</div>
        </#if>
      <#elseif !registry.selfPreservationModeEnabled>
        <div class="alert alert-warn" role="status"><@icon "alert"/>The self preservation mode is turned off. This may not protect instance expiry in case of network/other problems.</div>
      </#if>

      <div class="layout">
        <div class="stack">
          <#-- Registered instances -->
          <section class="card" aria-labelledby="instances-title">
            <div class="card-head">
              <div class="row" style="align-items:flex-start">
                <span class="head-icon"><@icon "network"/></span>
                <div>
                  <h2 id="instances-title">Instances Currently Registered with Eureka</h2>
                  <p class="sub small">List of all registered applications and their current status.</p>
                </div>
              </div>
              <div class="row">
                <span class="pill pill-brand">${apps?size} <#if apps?size == 1>Service<#else>Services</#if></span>
                <button type="button" class="btn" onclick="location.reload()"><@icon "refresh"/>Refresh</button>
              </div>
            </div>
            <div class="table-wrap">
              <table id="instances" data-sortable>
                <thead>
                  <tr><th class="sortable" data-col="0">Application</th><th>AMIs</th><th>Availability Zones</th><th class="sortable" data-col="3">Status</th></tr>
                </thead>
                <tbody>
                  <#if apps?has_content>
                    <#list apps as app>
                      <tr>
                        <td><span class="app"><span class="mini"><@icon "box"/></span>${app.name}</span></td>
                        <td class="muted"><#list app.amiCounts as amiCount>${amiCount.key} (${amiCount.value})<#sep>, </#sep></#list></td>
                        <td class="muted"><#list app.zoneCounts as zoneCount>${zoneCount.key} (${zoneCount.value})<#sep>, </#sep></#list></td>
                        <td>
                          <div class="status-cell">
                            <#list app.instanceInfos as info>
                              <span class="pill pill-dot <#if info.isNotUp>pill-bad<#else>pill-ok</#if>">${info.status} (${info.instances?size})</span>
                              <#list info.instances as instance>
                                <#if instance.isHref>
                                  <a class="instance<#if info.isNotUp> bad</#if>" href="${instance.url}" target="_blank" rel="noopener">${instance.id}<@icon "external"/></a>
                                <#else>
                                  <span class="instance<#if info.isNotUp> bad</#if>" style="text-decoration:none">${instance.id}</span>
                                </#if>
                              </#list>
                            </#list>
                          </div>
                        </td>
                      </tr>
                    </#list>
                  <#else>
                    <tr data-empty><td colspan="4" class="empty">No instances available. Services appear here once they register (EUREKA_ENABLED=true).</td></tr>
                  </#if>
                </tbody>
              </table>
            </div>
          </section>

          <#-- General information -->
          <section class="card" aria-labelledby="general-title">
            <div class="card-head">
              <div class="row" style="align-items:flex-start">
                <span class="head-icon"><@icon "info"/></span>
                <div>
                  <h2 id="general-title">General Information</h2>
                  <p class="sub small">System and JVM runtime details.</p>
                </div>
              </div>
            </div>
            <div class="table-wrap">
              <table id="generalInfo" data-sortable>
                <thead><tr><th class="sortable" data-col="0">Name</th><th>Value</th></tr></thead>
                <tbody>
                  <#list statusInfo.generalStats?keys as stat>
                    <tr>
                      <td><span class="stat-name"><#if stat?contains("cpu")><@icon "cpu"/><#elseif stat?contains("memory")><@icon "memory"/><#elseif stat?contains("uptime")><@icon "clock"/><#else><@icon "server"/></#if>${stat}</span></td>
                      <td>${statusInfo.generalStats[stat]!""}</td>
                    </tr>
                  </#list>
                  <#list statusInfo.applicationStats?keys as stat>
                    <tr>
                      <td><span class="stat-name"><@icon "network"/>${stat}</span></td>
                      <td style="word-break:break-all">${statusInfo.applicationStats[stat]!""}</td>
                    </tr>
                  </#list>
                </tbody>
              </table>
            </div>
          </section>

          <#-- Instance info of the registry itself (kept from the stock page, collapsed) -->
          <details class="card">
            <summary class="card-head">
              <div class="row" style="align-items:flex-start">
                <span class="head-icon"><@icon "server"/></span>
                <div>
                  <h2>Registry Instance Info</h2>
                  <p class="sub small">Address, status and identifiers of this Eureka server.</p>
                </div>
              </div>
              <span class="head-icon chev"><@icon "chevron"/></span>
            </summary>
            <div class="table-wrap">
              <table id="instanceInfo">
                <thead><tr><th>Name</th><th>Value</th></tr></thead>
                <tbody>
                  <#list instanceInfo?keys as key>
                    <tr><td>${key}</td><td style="word-break:break-all">${instanceInfo[key]!""}</td></tr>
                  </#list>
                </tbody>
              </table>
            </div>
          </details>
        </div>

        <#-- Registry configuration -->
        <aside class="stack">
          <section class="card" aria-labelledby="config-title">
            <div class="card-head">
              <div class="row">
                <span class="head-icon"><@icon "settings"/></span>
                <h2 id="config-title">Registry Configuration</h2>
              </div>
            </div>
            <ul class="kv">
              <#if amazonInfo??>
                <li><span>AMI</span><span class="tag">${amiId!}</span></li>
                <li><span>Zone</span><span class="tag">${availabilityZone!}</span></li>
                <li><span>Instance ID</span><span class="tag">${instanceId!}</span></li>
              </#if>
              <li><span>Environment</span><span class="tag">${environment!"—"}</span></li>
              <li><span>Data center</span><span class="tag">${datacenter!"—"}</span></li>
              <li><span>Lease expiration enabled</span><span class="tag ${registry.leaseExpirationEnabled?c}">${registry.leaseExpirationEnabled?c}</span></li>
              <li><span>Self preservation</span><span class="tag ${registry.selfPreservationModeEnabled?c}">${registry.selfPreservationModeEnabled?then("on", "off")}</span></li>
              <li><span>Renews threshold</span><span class="tag">${registry.numOfRenewsPerMinThreshold}</span></li>
              <li><span>Renews (last min)</span><span class="tag">${registry.numOfRenewsInLastMin}</span></li>
              <li><span>Current time</span><span class="tag">${currentTime}</span></li>
            </ul>
          </section>

          <section class="card" aria-labelledby="replicas-title">
            <div class="card-head">
              <div class="row">
                <span class="head-icon"><@icon "network"/></span>
                <h2 id="replicas-title">DS Replicas</h2>
              </div>
            </div>
            <#if replicas?has_content>
              <ul class="kv">
                <#list replicas as replica>
                  <li><a class="instance" style="color:var(--brand-text)" href="${replica.value}">${replica.key}<@icon "external"/></a></li>
                </#list>
              </ul>
            <#else>
              <p class="empty" style="padding-top:0">No replicas configured (single registry).</p>
            </#if>
          </section>
        </aside>
      </div>

      <footer>VQMS · Eureka ${environment!""}</footer>
    </main>
    <@sortScript/>
  </body>
</html>
