import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSalesforceOrgInfo } from '../../dist/utils/connection.js';

test('getSalesforceOrgInfo — surfaces missing Salesforce CLI clearly', async () => {
  await assert.rejects(
    () => getSalesforceOrgInfo(async () => {
      const error = new Error('spawn sf ENOENT');
      error.code = 'ENOENT';
      throw error;
    }),
    /Salesforce CLI \(sf\) is not installed or not in PATH/
  );
});

test('getSalesforceOrgInfo — keeps parse failure message for invalid JSON output', async () => {
  await assert.rejects(
    () => getSalesforceOrgInfo(async () => ({
      stdout: 'not json',
      stderr: '',
    })),
    /Failed to get Salesforce org info: Failed to parse Salesforce CLI output/
  );
});
