import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleManageFieldPermissions } from '../../dist/tools/manageFieldPermissions.js';
import { createMockConnection } from '../helpers/mockConnection.js';
import { createSpy } from '../helpers/spy.js';

test('manageFieldPermissions — view operation returns formatted permissions', async () => {
  const conn = createMockConnection({
    query: async () => ({
      totalSize: 2,
      records: [
        {
          Id: 'fp1',
          ParentId: 'ps1',
          Parent: {
            IsOwnedByProfile: true,
            Profile: { Name: 'System Administrator' },
            Label: 'System Administrator',
          },
          Field: 'Account.Custom_Field__c',
          PermissionsRead: true,
          PermissionsEdit: true,
        },
        {
          Id: 'fp2',
          ParentId: 'ps2',
          Parent: {
            IsOwnedByProfile: false,
            Profile: null,
            Label: 'Sales Permission Set',
          },
          Field: 'Account.Custom_Field__c',
          PermissionsRead: true,
          PermissionsEdit: false,
        },
      ],
    }),
  });
  const result = await handleManageFieldPermissions(conn, {
    operation: 'view',
    objectName: 'Account',
    fieldName: 'Custom_Field__c',
  });
  assert.equal(result.isError, false);
  const text = result.content[0].text;
  assert.ok(text.includes('System Administrator'));
  assert.ok(text.includes('Profile'));
  assert.ok(text.includes('Permission Set'));
  assert.ok(text.includes('Read Access: Yes'));
  assert.ok(text.includes('Edit Access: No'));
});

test('manageFieldPermissions — grant operation with successful create', async () => {
  let queryCount = 0;
  const createSpy_ = createSpy(async () => ({ id: 'fp_new', success: true, errors: [] }));
  const conn = createMockConnection({
    query: async (soql) => {
      queryCount++;
      if (soql.includes('FROM Profile')) {
        return {
          totalSize: 1,
          records: [{ Id: 'prof1', Name: 'System Administrator' }],
        };
      }
      if (soql.includes('FROM FieldPermissions') && soql.includes('ProfileId')) {
        // No existing permission
        return { totalSize: 0, records: [] };
      }
      if (soql.includes('FROM PermissionSet') && soql.includes('ProfileId')) {
        return { totalSize: 1, records: [{ Id: 'ps1' }] };
      }
      return { totalSize: 0, records: [] };
    },
    sobject: (name) => ({
      create: createSpy_,
      update: async () => ({ success: true }),
      destroy: async () => ({ success: true }),
      delete: async () => ({ success: true }),
      upsert: async () => ({ success: true }),
    }),
  });
  const result = await handleManageFieldPermissions(conn, {
    operation: 'grant',
    objectName: 'Account',
    fieldName: 'Custom_Field__c',
    profileNames: ['System Administrator'],
  });
  assert.ok(result.isError !== true);
  const text = result.content[0].text;
  assert.ok(text.includes('Successful'));
  assert.ok(text.includes('System Administrator'));
  assert.ok(text.includes('created'));
});

test('manageFieldPermissions — grant operation with some profiles failing', async () => {
  const conn = createMockConnection({
    query: async (soql) => {
      if (soql.includes('FROM Profile')) {
        return {
          totalSize: 2,
          records: [
            { Id: 'prof1', Name: 'System Administrator' },
            { Id: 'prof2', Name: 'Standard User' },
          ],
        };
      }
      if (soql.includes('FROM FieldPermissions') && soql.includes('ProfileId')) {
        return { totalSize: 0, records: [] };
      }
      if (soql.includes('FROM PermissionSet') && soql.includes('prof1')) {
        return { totalSize: 1, records: [{ Id: 'ps1' }] };
      }
      if (soql.includes('FROM PermissionSet') && soql.includes('prof2')) {
        // No permission set found for Standard User
        return { totalSize: 0, records: [] };
      }
      return { totalSize: 0, records: [] };
    },
    sobject: (name) => ({
      create: async () => ({ id: 'fp_new', success: true, errors: [] }),
      update: async () => ({ success: true }),
      destroy: async () => ({ success: true }),
      delete: async () => ({ success: true }),
      upsert: async () => ({ success: true }),
    }),
  });
  const result = await handleManageFieldPermissions(conn, {
    operation: 'grant',
    objectName: 'Account',
    fieldName: 'Custom_Field__c',
    profileNames: ['System Administrator', 'Standard User'],
  });
  // Should have partial failure
  assert.equal(result.isError, true);
  const text = result.content[0].text;
  assert.ok(text.includes('Successful'));
  assert.ok(text.includes('Failed'));
  assert.ok(text.includes('Standard User'));
});

test('manageFieldPermissions — revoke operation queries and deletes', async () => {
  const deleteSpy = createSpy(async () => ({ success: true }));
  const conn = createMockConnection({
    query: async (soql) => {
      if (soql.includes('FROM Profile')) {
        return {
          totalSize: 1,
          records: [{ Id: 'prof1', Name: 'System Administrator' }],
        };
      }
      if (soql.includes('FROM FieldPermissions')) {
        return {
          totalSize: 1,
          records: [{ Id: 'fp1' }],
        };
      }
      return { totalSize: 0, records: [] };
    },
    sobject: (name) => ({
      create: async () => ({}),
      update: async () => ({}),
      destroy: async () => ({}),
      delete: deleteSpy,
      upsert: async () => ({}),
    }),
  });
  const result = await handleManageFieldPermissions(conn, {
    operation: 'revoke',
    objectName: 'Account',
    fieldName: 'Custom_Field__c',
    profileNames: ['System Administrator'],
  });
  assert.ok(result.isError !== true);
  const text = result.content[0].text;
  assert.ok(text.includes('revoked'));
  assert.ok(text.includes('System Administrator'));
  assert.equal(deleteSpy.calls.length, 1);
});

test('manageFieldPermissions — isError true when all grants fail', async () => {
  const conn = createMockConnection({
    query: async (soql) => {
      if (soql.includes('FROM Profile')) {
        return {
          totalSize: 1,
          records: [{ Id: 'prof1', Name: 'System Administrator' }],
        };
      }
      if (soql.includes('FROM FieldPermissions')) {
        return { totalSize: 0, records: [] };
      }
      if (soql.includes('FROM PermissionSet')) {
        return { totalSize: 1, records: [{ Id: 'ps1' }] };
      }
      return { totalSize: 0, records: [] };
    },
    sobject: (name) => ({
      create: async () => { throw new Error('FIELD_INTEGRITY_EXCEPTION'); },
      update: async () => ({}),
      destroy: async () => ({}),
      delete: async () => ({}),
      upsert: async () => ({}),
    }),
  });
  const result = await handleManageFieldPermissions(conn, {
    operation: 'grant',
    objectName: 'Account',
    fieldName: 'Custom_Field__c',
    profileNames: ['System Administrator'],
  });
  assert.equal(result.isError, true);
  assert.ok(result.content[0].text.includes('FIELD_INTEGRITY_EXCEPTION'));
});

test('manageFieldPermissions — standard field names without __c are handled correctly', async () => {
  let capturedSoql = '';
  const conn = createMockConnection({
    query: async (soql) => {
      capturedSoql = soql;
      return {
        totalSize: 0,
        records: [],
      };
    },
  });
  const result = await handleManageFieldPermissions(conn, {
    operation: 'view',
    objectName: 'Account',
    fieldName: 'Revenue',
  });
  // The handler should append __c since 'Revenue' has no '__' in it
  assert.ok(capturedSoql.includes('Account.Revenue__c'));
  // Should NOT have 'Account.Revenue__c__c' (double suffix)
  assert.ok(!capturedSoql.includes('Revenue__c__c'));
});
