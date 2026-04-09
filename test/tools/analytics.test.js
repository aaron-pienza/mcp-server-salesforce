import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleListAnalytics } from '../../dist/tools/listAnalytics.js';
import { handleDescribeAnalytics } from '../../dist/tools/describeAnalytics.js';
import { handleRunAnalytics } from '../../dist/tools/runAnalytics.js';
import { handleRefreshDashboard } from '../../dist/tools/refreshDashboard.js';
import { createMockConnection } from '../helpers/mockConnection.js';

// --- handleListAnalytics ---

test('listAnalytics — report listing with mock query returning report records', async () => {
  const conn = createMockConnection({
    analytics: {
      reports: async () => [
        { id: '00Oxx0001', name: 'Pipeline Report' },
        { id: '00Oxx0002', name: 'Sales Summary' },
      ],
      dashboards: async () => [],
      report: () => ({ describe: async () => ({}), execute: async () => ({}) }),
      dashboard: () => ({ describe: async () => ({}), components: async () => ({}), refresh: async () => ({}), status: async () => ({}) }),
    },
  });
  const result = await handleListAnalytics(conn, { type: 'report' });
  assert.equal(result.isError, false);
  assert.ok(result.content[0].text.includes('Pipeline Report'));
  assert.ok(result.content[0].text.includes('Sales Summary'));
  assert.ok(result.content[0].text.includes('2'));
});

test('listAnalytics — dashboard listing', async () => {
  const conn = createMockConnection({
    analytics: {
      reports: async () => [],
      dashboards: async () => [
        { id: '01Zxx0001', name: 'Executive Dashboard' },
      ],
      report: () => ({ describe: async () => ({}), execute: async () => ({}) }),
      dashboard: () => ({ describe: async () => ({}), components: async () => ({}), refresh: async () => ({}), status: async () => ({}) }),
    },
  });
  const result = await handleListAnalytics(conn, { type: 'dashboard' });
  assert.equal(result.isError, false);
  assert.ok(result.content[0].text.includes('Executive Dashboard'));
  assert.ok(result.content[0].text.includes('1'));
});

test('listAnalytics — search term filtering uses SOQL query', async () => {
  let capturedSoql = '';
  const conn = createMockConnection({
    query: async (soql) => {
      capturedSoql = soql;
      return {
        totalSize: 1,
        records: [
          { Id: '00Oxx0001', Name: 'Pipeline Report', FolderName: 'Sales', Format: 'TABULAR', Description: null },
        ],
      };
    },
  });
  const result = await handleListAnalytics(conn, { type: 'report', searchTerm: 'Pipeline' });
  assert.equal(result.isError, false);
  assert.ok(capturedSoql.includes('Pipeline'));
  assert.ok(result.content[0].text.includes('Pipeline Report'));
});

// --- handleDescribeAnalytics ---

test('describeAnalytics — report describe with mock analytics API', async () => {
  const conn = createMockConnection({
    analytics: {
      reports: async () => [],
      dashboards: async () => [],
      report: (id) => ({
        describe: async () => ({
          reportMetadata: {
            name: 'Test Report',
            reportFormat: 'TABULAR',
            reportType: { label: 'Opportunities' },
            detailColumns: ['ACCOUNT_NAME', 'AMOUNT'],
            groupingsDown: [],
            groupingsAcross: [],
            aggregates: ['RowCount'],
            reportFilters: [],
            reportBooleanFilter: null,
            standardDateFilter: null,
            scope: 'organization',
          },
          reportExtendedMetadata: {
            detailColumnInfo: {
              ACCOUNT_NAME: { label: 'Account Name', dataType: 'string' },
              AMOUNT: { label: 'Amount', dataType: 'currency' },
            },
            groupingColumnInfo: {},
            aggregateColumnInfo: {
              RowCount: { label: 'Record Count' },
            },
          },
        }),
        execute: async () => ({}),
      }),
      dashboard: () => ({ describe: async () => ({}), components: async () => ({}), refresh: async () => ({}), status: async () => ({}) }),
    },
  });
  const result = await handleDescribeAnalytics(conn, { type: 'report', resourceId: '00Oxx0001' });
  assert.equal(result.isError, false);
  const text = result.content[0].text;
  assert.ok(text.includes('Test Report'));
  assert.ok(text.includes('TABULAR'));
  assert.ok(text.includes('Account Name'));
  assert.ok(text.includes('Amount'));
});

// --- handleRunAnalytics ---

test('runAnalytics — report execution with mock data', async () => {
  const conn = createMockConnection({
    analytics: {
      reports: async () => [],
      dashboards: async () => [],
      report: (id) => ({
        describe: async () => ({}),
        execute: async (opts) => ({
          reportMetadata: {
            name: 'Pipeline Report',
            reportFormat: 'SUMMARY',
            detailColumns: ['ACCOUNT_NAME'],
          },
          reportExtendedMetadata: {
            detailColumnInfo: {
              ACCOUNT_NAME: { label: 'Account Name', dataType: 'string' },
            },
            groupingColumnInfo: {},
            aggregateColumnInfo: {
              RowCount: { label: 'Record Count' },
            },
          },
          factMap: {
            'T!T': {
              aggregates: [{ label: '42', value: 42 }],
            },
          },
          groupingsDown: { groupings: [] },
          groupingsAcross: { groupings: [] },
          hasDetailRows: false,
          allData: true,
        }),
      }),
      dashboard: () => ({ describe: async () => ({}), components: async () => ({}), refresh: async () => ({}), status: async () => ({}) }),
    },
  });
  const result = await handleRunAnalytics(conn, { type: 'report', resourceId: '00Oxx0001' });
  assert.equal(result.isError, false);
  const text = result.content[0].text;
  assert.ok(text.includes('Pipeline Report'));
  assert.ok(text.includes('Record Count'));
  assert.ok(text.includes('42'));
});

// --- handleRefreshDashboard ---

test('refreshDashboard — refresh operation', async () => {
  const conn = createMockConnection({
    analytics: {
      reports: async () => [],
      dashboards: async () => [],
      report: () => ({ describe: async () => ({}), execute: async () => ({}) }),
      dashboard: (id) => ({
        describe: async () => ({}),
        components: async () => ({}),
        refresh: async () => ({ statusUrl: '/services/data/v59.0/analytics/dashboards/01Zxx0001/status' }),
        status: async () => ({ componentStatus: [] }),
      }),
    },
  });
  const result = await handleRefreshDashboard(conn, { operation: 'refresh', dashboardId: '01Zxx0001' });
  assert.equal(result.isError, false);
  assert.ok(result.content[0].text.includes('refresh initiated'));
  assert.ok(result.content[0].text.includes('Status URL'));
});

test('refreshDashboard — status check operation', async () => {
  const conn = createMockConnection({
    analytics: {
      reports: async () => [],
      dashboards: async () => [],
      report: () => ({ describe: async () => ({}), execute: async () => ({}) }),
      dashboard: (id) => ({
        describe: async () => ({}),
        components: async () => ({}),
        refresh: async () => ({}),
        status: async () => ({
          componentStatus: [
            { componentId: 'comp1', refreshStatus: 'IDLE', refreshDate: '2025-06-01T00:00:00.000Z' },
            { componentId: 'comp2', refreshStatus: 'RUNNING', refreshDate: null },
          ],
        }),
      }),
    },
  });
  const result = await handleRefreshDashboard(conn, { operation: 'status', dashboardId: '01Zxx0001' });
  assert.equal(result.isError, false);
  const text = result.content[0].text;
  assert.ok(text.includes('comp1'));
  assert.ok(text.includes('IDLE'));
  assert.ok(text.includes('comp2'));
  assert.ok(text.includes('RUNNING'));
});
