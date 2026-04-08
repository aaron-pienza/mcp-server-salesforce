import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleExecuteAnonymous } from '../../dist/tools/executeAnonymous.js';
import { createMockConnection } from '../helpers/mockConnection.js';

test('executeAnonymous — success', async () => {
  let capturedSoql = '';
  const conn = createMockConnection({
    tooling: {
      executeAnonymous: async () => ({
        compiled: true,
        compileProblem: null,
        success: true,
        exceptionMessage: null,
        exceptionStackTrace: null,
        line: -1,
        column: -1,
      }),
      request: async () => '',
      query: async () => ({ totalSize: 0, records: [] }),
      sobject: () => ({ create: async () => ({}), update: async () => ({}), delete: async () => ({}) }),
    },
    identity: async () => ({ user_id: '005current' }),
    query: async (soql) => {
      capturedSoql = soql;
      return { totalSize: 0, records: [] };
    },
  });
  const result = await handleExecuteAnonymous(conn, { apexCode: 'System.debug("test");' });
  assert.equal(result.isError, false);
  assert.ok(result.content[0].text.includes('Success'));
  assert.ok(capturedSoql.includes("WHERE LogUserId = '005current'"));
});

test('executeAnonymous — compilation failure', async () => {
  const conn = createMockConnection({
    tooling: {
      executeAnonymous: async () => ({
        compiled: false,
        compileProblem: 'Unexpected token',
        success: false,
        exceptionMessage: null,
        exceptionStackTrace: null,
        line: 1,
        column: 5,
      }),
      request: async () => '',
      query: async () => ({ totalSize: 0, records: [] }),
      sobject: () => ({ create: async () => ({}), update: async () => ({}), delete: async () => ({}) }),
    },
    query: async () => ({ totalSize: 0, records: [] }),
  });
  const result = await handleExecuteAnonymous(conn, { apexCode: 'bad code' });
  assert.equal(result.isError, true);
  assert.ok(result.content[0].text.includes('Failed'));
  assert.ok(result.content[0].text.includes('Unexpected token'));
});

test('executeAnonymous — execution exception', async () => {
  const conn = createMockConnection({
    tooling: {
      executeAnonymous: async () => ({
        compiled: true,
        compileProblem: null,
        success: false,
        exceptionMessage: 'System.NullPointerException: Attempt to de-reference a null object',
        exceptionStackTrace: 'AnonymousBlock: line 1, column 1',
        line: 1,
        column: 1,
      }),
      request: async () => '',
      query: async () => ({ totalSize: 0, records: [] }),
      sobject: () => ({ create: async () => ({}), update: async () => ({}), delete: async () => ({}) }),
    },
    query: async () => ({ totalSize: 0, records: [] }),
  });
  const result = await handleExecuteAnonymous(conn, { apexCode: 'String s; s.length();' });
  assert.equal(result.isError, true);
  assert.ok(result.content[0].text.includes('NullPointerException'));
});

test('executeAnonymous — API error', async () => {
  const conn = createMockConnection({
    tooling: {
      executeAnonymous: async () => { throw new Error('INVALID_SESSION'); },
      request: async () => '',
      query: async () => ({ totalSize: 0, records: [] }),
      sobject: () => ({ create: async () => ({}), update: async () => ({}), delete: async () => ({}) }),
    },
    query: async () => ({ totalSize: 0, records: [] }),
  });
  const result = await handleExecuteAnonymous(conn, { apexCode: 'System.debug("x");' });
  assert.equal(result.isError, true);
  assert.ok(result.content[0].text.includes('INVALID_SESSION'));
});

test('executeAnonymous — skips debug log retrieval when current user cannot be resolved', async () => {
  const conn = createMockConnection({
    tooling: {
      executeAnonymous: async () => ({
        compiled: true,
        compileProblem: null,
        success: true,
        exceptionMessage: null,
        exceptionStackTrace: null,
        line: -1,
        column: -1,
      }),
      request: async () => '',
      query: async () => ({ totalSize: 0, records: [] }),
      sobject: () => ({ create: async () => ({}), update: async () => ({}), delete: async () => ({}) }),
    },
    query: async () => {
      throw new Error('should not query logs without user identity');
    },
  });
  const result = await handleExecuteAnonymous(conn, { apexCode: 'System.debug("test");' });
  assert.equal(result.isError, false);
  assert.ok(result.content[0].text.includes('logs were not retrieved safely'));
});
