import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logApexExecution } from '../../dist/utils/logging.js';

test('logApexExecution — does not emit Apex source preview', () => {
  const originalError = console.error;
  const calls = [];

  console.error = (...args) => {
    calls.push(args.join(' '));
  };

  try {
    logApexExecution('System.debug("secret-token-123");');
  } finally {
    console.error = originalError;
  }

  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes('Execute Anonymous Apex'));
  assert.ok(!calls[0].includes('secret-token-123'));
  assert.ok(!calls[0].includes('System.debug'));
});
