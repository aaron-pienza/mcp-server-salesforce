#!/usr/bin/env node

/**
 * Exhaustive production test: runs every report and dashboard in the org
 * through list, describe, and run (default + all rows).
 *
 * Usage: SALESFORCE_CONNECTION_TYPE=Salesforce_CLI node scripts/run-all-analytics.mjs
 */

import { createSalesforceConnection } from '../dist/utils/connection.js';
import { handleListAnalytics } from '../dist/tools/listAnalytics.js';
import { handleDescribeAnalytics } from '../dist/tools/describeAnalytics.js';
import { handleRunAnalytics } from '../dist/tools/runAnalytics.js';
import { handleRefreshDashboard } from '../dist/tools/refreshDashboard.js';

const conn = await createSalesforceConnection();

// ── Collect all reports and dashboards via SOQL (not just recently viewed) ──

async function getAllReports() {
  const result = await conn.query(
    "SELECT Id, Name, FolderName, Format FROM Report ORDER BY Name LIMIT 2000"
  );
  return result.records;
}

async function getAllDashboards() {
  const result = await conn.query(
    "SELECT Id, Title, FolderName FROM Dashboard ORDER BY Title LIMIT 2000"
  );
  return result.records;
}

// ── Helpers ──

const results = { pass: 0, fail: 0, skip: 0, errors: [] };

function log(msg) { console.log(msg); }
function logResult(testName, result) {
  if (result.isError) {
    const text = result.content[0].text;
    // Some errors are expected (permissions, deleted reports, etc.)
    if (text.includes('Insufficient permissions') ||
        text.includes('not found') ||
        text.includes('unavailable') ||
        text.includes('FUNCTIONALITY_NOT_ENABLED') ||
        text.includes('This resource does not exist') ||
        text.includes('Unable to Access Page') ||
        text.includes("can't run more than") ||
        text.includes('running user for this dashboard is inactive') ||
        text.includes('report definition is obsolete') ||
        text.includes("don't have sufficient privileges") ||
        text.includes('sufficient privileges')) {
      results.skip++;
      log(`  SKIP (expected): ${text.substring(0, 120)}`);
    } else {
      results.fail++;
      results.errors.push({ test: testName, error: text.substring(0, 300) });
      log(`  FAIL: ${text.substring(0, 200)}`);
    }
  } else {
    results.pass++;
    const text = result.content[0].text;
    // Print a brief summary (first 2 lines)
    const summary = text.split('\n').slice(0, 3).join(' | ');
    log(`  PASS: ${summary.substring(0, 150)}`);
  }
}

function textLength(result) {
  return result.content[0].text.length;
}

// ── Phase 1: List all reports and dashboards ──

log('\n════════════════════════════════════════════════════════');
log('PHASE 1: Collecting all reports and dashboards via SOQL');
log('════════════════════════════════════════════════════════\n');

const reports = await getAllReports();
const dashboards = await getAllDashboards();
log(`Found ${reports.length} reports and ${dashboards.length} dashboards in the org.\n`);

// Also test the list tool itself
log('── Testing salesforce_list_analytics ──');
for (const type of ['report', 'dashboard']) {
  log(`\n  list(${type}, no search):`);
  const r1 = await handleListAnalytics(conn, { type });
  logResult(`list_${type}`, r1);

  log(`  list(${type}, search="Pipeline"):`);
  const r2 = await handleListAnalytics(conn, { type, searchTerm: 'Pipeline' });
  logResult(`list_${type}_search`, r2);

  log(`  list(${type}, search="xyznonexistent12345"):`);
  const r3 = await handleListAnalytics(conn, { type, searchTerm: 'xyznonexistent12345' });
  logResult(`list_${type}_noresults`, r3);
}

// ── Phase 2: Describe + Run every report ──

log('\n════════════════════════════════════════════════════════');
log(`PHASE 2: Testing all ${reports.length} reports`);
log('════════════════════════════════════════════════════════\n');

for (let i = 0; i < reports.length; i++) {
  const r = reports[i];
  log(`\n[${i + 1}/${reports.length}] ${r.Name} (${r.Id}) — ${r.Format} — Folder: ${r.FolderName}`);

  // 2a: Describe
  log('  describe:');
  const descResult = await handleDescribeAnalytics(conn, { type: 'report', resourceId: r.Id });
  logResult(`describe_report_${r.Id}`, descResult);

  // 2b: Run with defaults (no detail rows)
  log('  run(defaults):');
  const runDefault = await handleRunAnalytics(conn, { type: 'report', resourceId: r.Id });
  logResult(`run_default_${r.Id}`, runDefault);
  if (!runDefault.isError) {
    log(`    Response size: ${textLength(runDefault)} chars`);
  }

  // 2c: Run with includeDetails=true (default 100-row cap, with auto-retry for unsupported topRows)
  log('  run(includeDetails=true, default cap):');
  const runDetails = await handleRunAnalytics(conn, {
    type: 'report', resourceId: r.Id, includeDetails: true
  });
  logResult(`run_details_${r.Id}`, runDetails);
  if (!runDetails.isError) {
    log(`    Response size: ${textLength(runDetails)} chars`);
    // Check for truncation/cap warnings
    const text = runDetails.content[0].text;
    if (text.includes('Results are truncated')) log('    ⚠ Truncation warning present');
    if (text.includes('default limit')) log('    ⚠ Default cap note present');
    if (text.includes('Showing') && text.includes('of') && text.includes('detail rows')) log('    ⚠ Display cap note present');
  }

  // 2d: Run with includeDetails=true and high topRows to get all rows
  // Only attempt if the report format likely supports topRows (skip tabular to avoid known issue)
  if (r.Format !== 'Tabular') {
    log('  run(includeDetails=true, topRows=2000):');
    const runAll = await handleRunAnalytics(conn, {
      type: 'report', resourceId: r.Id,
      includeDetails: true,
      topRows: { rowLimit: 2000, direction: 'Desc' }
    });
    logResult(`run_allrows_${r.Id}`, runAll);
    if (!runAll.isError) {
      log(`    Response size: ${textLength(runAll)} chars`);
      const text = runAll.content[0].text;
      if (text.includes('Results are truncated')) log('    ⚠ Truncation warning (>2000 rows)');
      if (text.includes('Showing') && text.includes('of') && text.includes('detail rows')) log('    ⚠ Display cap note present');
    }
  } else {
    log('  run(all rows): SKIP — Tabular reports do not support topRows');
    results.skip++;
  }
}

// ── Phase 3: Describe + Run every dashboard ──

log('\n════════════════════════════════════════════════════════');
log(`PHASE 3: Testing all ${dashboards.length} dashboards`);
log('════════════════════════════════════════════════════════\n');

for (let i = 0; i < dashboards.length; i++) {
  const d = dashboards[i];
  log(`\n[${i + 1}/${dashboards.length}] ${d.Title} (${d.Id}) — Folder: ${d.FolderName}`);

  // 3a: Describe
  log('  describe:');
  const descResult = await handleDescribeAnalytics(conn, { type: 'dashboard', resourceId: d.Id });
  logResult(`describe_dashboard_${d.Id}`, descResult);

  // 3b: Run (get component data)
  log('  run:');
  const runResult = await handleRunAnalytics(conn, { type: 'dashboard', resourceId: d.Id });
  logResult(`run_dashboard_${d.Id}`, runResult);
  if (!runResult.isError) {
    log(`    Response size: ${textLength(runResult)} chars`);
  }

  // 3c: Check status
  log('  status:');
  const statusResult = await handleRefreshDashboard(conn, { operation: 'status', dashboardId: d.Id });
  logResult(`status_dashboard_${d.Id}`, statusResult);
}

// ── Phase 4: Error handling tests ──

log('\n════════════════════════════════════════════════════════');
log('PHASE 4: Error handling edge cases');
log('════════════════════════════════════════════════════════\n');

const errorTests = [
  { name: 'invalid_report_id', fn: () => handleDescribeAnalytics(conn, { type: 'report', resourceId: '00O000000000000' }) },
  { name: 'invalid_dashboard_id', fn: () => handleDescribeAnalytics(conn, { type: 'dashboard', resourceId: '01Z000000000000' }) },
  { name: 'run_invalid_report', fn: () => handleRunAnalytics(conn, { type: 'report', resourceId: '00O000000000000' }) },
  { name: 'run_invalid_dashboard', fn: () => handleRunAnalytics(conn, { type: 'dashboard', resourceId: '01Z000000000000' }) },
  { name: 'dashboard_with_report_params', fn: () => handleRunAnalytics(conn, {
      type: 'dashboard', resourceId: dashboards[0]?.Id || '01Z000000000000', includeDetails: true
    })},
  { name: 'refresh_invalid_dashboard', fn: () => handleRefreshDashboard(conn, { operation: 'refresh', dashboardId: '01Z000000000000' }) },
  { name: 'report_bad_filter', fn: () => handleRunAnalytics(conn, {
      type: 'report', resourceId: reports[0]?.Id || '00O000000000000',
      filters: [{ column: 'FAKE_COLUMN_XYZ', operator: 'equals', value: 'test' }]
    })},
];

for (const t of errorTests) {
  log(`  ${t.name}:`);
  const result = await t.fn();
  if (result.isError) {
    results.pass++;
    log(`    PASS (expected error): ${result.content[0].text.substring(0, 150)}`);
  } else {
    results.fail++;
    results.errors.push({ test: t.name, error: 'Expected isError:true but got isError:false' });
    log(`    FAIL: Expected error but got success`);
  }
}

// ── Summary ──

log('\n════════════════════════════════════════════════════════');
log('SUMMARY');
log('════════════════════════════════════════════════════════\n');
log(`  PASS: ${results.pass}`);
log(`  FAIL: ${results.fail}`);
log(`  SKIP: ${results.skip}`);
log(`  Total: ${results.pass + results.fail + results.skip}`);

if (results.errors.length > 0) {
  log('\n  Failures:');
  for (const e of results.errors) {
    log(`    - ${e.test}: ${e.error}`);
  }
}

log('');
process.exit(results.fail > 0 ? 1 : 0);
