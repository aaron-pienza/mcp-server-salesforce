#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as dotenv from "dotenv";

import { createSalesforceConnection } from "./utils/connection.js";
import {
  assertEnum,
  assertOptionalBoolean,
  assertOptionalEnum,
  assertOptionalLogLevel,
  assertOptionalNumber,
  assertOptionalPicklistValues,
  assertOptionalPlainObject,
  assertOptionalQueryStringRecord,
  assertOptionalReportFilters,
  assertOptionalSearchIn,
  assertOptionalStandardDateFilter,
  assertOptionalString,
  assertOptionalStringArray,
  assertOptionalTopRows,
  assertOptionalWithClauses,
  assertPlainObject,
  assertRecordArray,
  assertSearchAllObjectSpecs,
  assertString,
  assertStringArray,
} from "./utils/validate.js";
import { SEARCH_OBJECTS, handleSearchObjects, SearchObjectsArgs } from "./tools/search.js";
import { DESCRIBE_OBJECT, handleDescribeObject } from "./tools/describe.js";
import { QUERY_RECORDS, handleQueryRecords, QueryArgs } from "./tools/query.js";
import { AGGREGATE_QUERY, handleAggregateQuery, AggregateQueryArgs } from "./tools/aggregateQuery.js";
import { DML_RECORDS, handleDMLRecords, DMLArgs } from "./tools/dml.js";
import { MANAGE_OBJECT, handleManageObject, ManageObjectArgs } from "./tools/manageObject.js";
import { MANAGE_FIELD, handleManageField, ManageFieldArgs } from "./tools/manageField.js";
import { MANAGE_FIELD_PERMISSIONS, handleManageFieldPermissions, ManageFieldPermissionsArgs } from "./tools/manageFieldPermissions.js";
import { SEARCH_ALL, handleSearchAll, SearchAllArgs } from "./tools/searchAll.js";
import { READ_APEX, handleReadApex, ReadApexArgs } from "./tools/readApex.js";
import { WRITE_APEX, handleWriteApex, WriteApexArgs } from "./tools/writeApex.js";
import { READ_APEX_TRIGGER, handleReadApexTrigger, ReadApexTriggerArgs } from "./tools/readApexTrigger.js";
import { WRITE_APEX_TRIGGER, handleWriteApexTrigger, WriteApexTriggerArgs } from "./tools/writeApexTrigger.js";
import { EXECUTE_ANONYMOUS, handleExecuteAnonymous, ExecuteAnonymousArgs } from "./tools/executeAnonymous.js";
import { MANAGE_DEBUG_LOGS, handleManageDebugLogs, ManageDebugLogsArgs } from "./tools/manageDebugLogs.js";
import { LIST_ANALYTICS, handleListAnalytics, ListAnalyticsArgs } from "./tools/listAnalytics.js";
import { DESCRIBE_ANALYTICS, handleDescribeAnalytics, DescribeAnalyticsArgs } from "./tools/describeAnalytics.js";
import { RUN_ANALYTICS, handleRunAnalytics, RunAnalyticsArgs } from "./tools/runAnalytics.js";
import { REFRESH_DASHBOARD, handleRefreshDashboard, RefreshDashboardArgs } from "./tools/refreshDashboard.js";
import { REST_API, handleRestApi, RestApiArgs } from "./tools/restApi.js";
import { RESOURCES, getResourceContent } from "./resources/index.js";

// Load environment variables — quiet: true suppresses dotenv 17.x stderr logging
// MCP servers require stdout to contain ONLY JSON-RPC messages
dotenv.config({ quiet: true });

const server = new Server(
  {
    name: "salesforce-mcp-server",
    version: "1.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

// Resource handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: RESOURCES,
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const content = getResourceContent(request.params.uri);
  if (!content) {
    throw new Error(`Resource not found: ${request.params.uri}`);
  }
  return { contents: [content] };
});

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    SEARCH_OBJECTS,
    DESCRIBE_OBJECT,
    QUERY_RECORDS,
    AGGREGATE_QUERY,
    DML_RECORDS,
    MANAGE_OBJECT,
    MANAGE_FIELD,
    MANAGE_FIELD_PERMISSIONS,
    SEARCH_ALL,
    READ_APEX,
    WRITE_APEX,
    READ_APEX_TRIGGER,
    WRITE_APEX_TRIGGER,
    EXECUTE_ANONYMOUS,
    MANAGE_DEBUG_LOGS,
    LIST_ANALYTICS,
    DESCRIBE_ANALYTICS,
    RUN_ANALYTICS,
    REFRESH_DASHBOARD,
    REST_API
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    if (!args) throw new Error('Arguments are required');

    const conn = await createSalesforceConnection();

    switch (name) {
      case "salesforce_search_objects": {
        const a = assertPlainObject(args, 'arguments');
        const validatedArgs: SearchObjectsArgs = {
          searchPattern: assertString(a.searchPattern, 'searchPattern'),
          limit: assertOptionalNumber(a.limit, 'limit'),
          offset: assertOptionalNumber(a.offset, 'offset'),
        };
        return await handleSearchObjects(conn, validatedArgs);
      }

      case "salesforce_describe_object": {
        const a = assertPlainObject(args, 'arguments');
        return await handleDescribeObject(conn, assertString(a.objectName, 'objectName'));
      }

      case "salesforce_query_records": {
        const a = assertPlainObject(args, 'arguments');
        const validatedArgs: QueryArgs = {
          objectName: assertString(a.objectName, 'objectName'),
          fields: assertStringArray(a.fields, 'fields'),
          whereClause: assertOptionalString(a.whereClause, 'whereClause'),
          orderBy: assertOptionalString(a.orderBy, 'orderBy'),
          limit: assertOptionalNumber(a.limit, 'limit'),
          offset: assertOptionalNumber(a.offset, 'offset'),
        };
        return await handleQueryRecords(conn, validatedArgs);
      }

      case "salesforce_aggregate_query": {
        const a = assertPlainObject(args, 'arguments');
        const validatedArgs: AggregateQueryArgs = {
          objectName: assertString(a.objectName, 'objectName'),
          selectFields: assertStringArray(a.selectFields, 'selectFields'),
          groupByFields: assertStringArray(a.groupByFields, 'groupByFields'),
          whereClause: assertOptionalString(a.whereClause, 'whereClause'),
          havingClause: assertOptionalString(a.havingClause, 'havingClause'),
          orderBy: assertOptionalString(a.orderBy, 'orderBy'),
          limit: assertOptionalNumber(a.limit, 'limit'),
        };
        return await handleAggregateQuery(conn, validatedArgs);
      }

      case "salesforce_dml_records": {
        const a = assertPlainObject(args, 'arguments');
        const validatedArgs: DMLArgs = {
          operation: assertEnum(a.operation, 'operation', ['insert', 'update', 'delete', 'upsert'] as const),
          objectName: assertString(a.objectName, 'objectName'),
          records: assertRecordArray(a.records, 'records'),
          externalIdField: assertOptionalString(a.externalIdField, 'externalIdField'),
        };
        return await handleDMLRecords(conn, validatedArgs);
      }

      case "salesforce_manage_object": {
        const a = assertPlainObject(args, 'arguments');
        const validatedArgs: ManageObjectArgs = {
          operation: assertEnum(a.operation, 'operation', ['create', 'update'] as const),
          objectName: assertString(a.objectName, 'objectName'),
          label: assertOptionalString(a.label, 'label'),
          pluralLabel: assertOptionalString(a.pluralLabel, 'pluralLabel'),
          description: assertOptionalString(a.description, 'description'),
          nameFieldLabel: assertOptionalString(a.nameFieldLabel, 'nameFieldLabel'),
          nameFieldType: assertOptionalEnum(a.nameFieldType, 'nameFieldType', ['Text', 'AutoNumber'] as const),
          nameFieldFormat: assertOptionalString(a.nameFieldFormat, 'nameFieldFormat'),
          sharingModel: assertOptionalEnum(a.sharingModel, 'sharingModel', [
            'ReadWrite', 'Read', 'Private', 'ControlledByParent',
          ] as const),
        };
        return await handleManageObject(conn, validatedArgs);
      }

      case "salesforce_manage_field": {
        const a = assertPlainObject(args, 'arguments');
        const validatedArgs: ManageFieldArgs = {
          operation: assertEnum(a.operation, 'operation', ['create', 'update'] as const),
          objectName: assertString(a.objectName, 'objectName'),
          fieldName: assertString(a.fieldName, 'fieldName'),
          label: assertOptionalString(a.label, 'label'),
          type: assertOptionalString(a.type, 'type'),
          required: assertOptionalBoolean(a.required, 'required'),
          unique: assertOptionalBoolean(a.unique, 'unique'),
          externalId: assertOptionalBoolean(a.externalId, 'externalId'),
          length: assertOptionalNumber(a.length, 'length'),
          precision: assertOptionalNumber(a.precision, 'precision'),
          scale: assertOptionalNumber(a.scale, 'scale'),
          referenceTo: assertOptionalString(a.referenceTo, 'referenceTo'),
          relationshipLabel: assertOptionalString(a.relationshipLabel, 'relationshipLabel'),
          relationshipName: assertOptionalString(a.relationshipName, 'relationshipName'),
          deleteConstraint: assertOptionalEnum(a.deleteConstraint, 'deleteConstraint', [
            'Cascade', 'Restrict', 'SetNull',
          ] as const),
          picklistValues: assertOptionalPicklistValues(a.picklistValues, 'picklistValues'),
          description: assertOptionalString(a.description, 'description'),
          grantAccessTo: assertOptionalStringArray(a.grantAccessTo, 'grantAccessTo'),
        };
        return await handleManageField(conn, validatedArgs);
      }

      case "salesforce_manage_field_permissions": {
        const a = assertPlainObject(args, 'arguments');
        const validatedArgs: ManageFieldPermissionsArgs = {
          operation: assertEnum(a.operation, 'operation', ['grant', 'revoke', 'view'] as const),
          objectName: assertString(a.objectName, 'objectName'),
          fieldName: assertString(a.fieldName, 'fieldName'),
          profileNames: assertOptionalStringArray(a.profileNames, 'profileNames'),
          readable: assertOptionalBoolean(a.readable, 'readable'),
          editable: assertOptionalBoolean(a.editable, 'editable'),
        };
        return await handleManageFieldPermissions(conn, validatedArgs);
      }

      case "salesforce_search_all": {
        const a = assertPlainObject(args, 'arguments');
        const validatedArgs: SearchAllArgs = {
          searchTerm: assertString(a.searchTerm, 'searchTerm'),
          searchIn: assertOptionalSearchIn(a.searchIn, 'searchIn'),
          objects: assertSearchAllObjectSpecs(a.objects, 'objects'),
          withClauses: assertOptionalWithClauses(a.withClauses, 'withClauses'),
          updateable: assertOptionalBoolean(a.updateable, 'updateable'),
          viewable: assertOptionalBoolean(a.viewable, 'viewable'),
        };
        return await handleSearchAll(conn, validatedArgs);
      }

      case "salesforce_read_apex": {
        const a = assertPlainObject(args, 'arguments');
        const validatedArgs: ReadApexArgs = {
          className: assertOptionalString(a.className, 'className'),
          namePattern: assertOptionalString(a.namePattern, 'namePattern'),
          includeMetadata: assertOptionalBoolean(a.includeMetadata, 'includeMetadata'),
          limit: assertOptionalNumber(a.limit, 'limit'),
          offset: assertOptionalNumber(a.offset, 'offset'),
        };
        return await handleReadApex(conn, validatedArgs);
      }

      case "salesforce_write_apex": {
        const a = assertPlainObject(args, 'arguments');
        const validatedArgs: WriteApexArgs = {
          operation: assertEnum(a.operation, 'operation', ['create', 'update'] as const),
          className: assertString(a.className, 'className'),
          apiVersion: assertOptionalString(a.apiVersion, 'apiVersion'),
          body: assertString(a.body, 'body'),
        };
        return await handleWriteApex(conn, validatedArgs);
      }

      case "salesforce_read_apex_trigger": {
        const a = assertPlainObject(args, 'arguments');
        const validatedArgs: ReadApexTriggerArgs = {
          triggerName: assertOptionalString(a.triggerName, 'triggerName'),
          namePattern: assertOptionalString(a.namePattern, 'namePattern'),
          includeMetadata: assertOptionalBoolean(a.includeMetadata, 'includeMetadata'),
          limit: assertOptionalNumber(a.limit, 'limit'),
          offset: assertOptionalNumber(a.offset, 'offset'),
        };
        return await handleReadApexTrigger(conn, validatedArgs);
      }

      case "salesforce_write_apex_trigger": {
        const a = assertPlainObject(args, 'arguments');
        const validatedArgs: WriteApexTriggerArgs = {
          operation: assertEnum(a.operation, 'operation', ['create', 'update'] as const),
          triggerName: assertString(a.triggerName, 'triggerName'),
          objectName: assertOptionalString(a.objectName, 'objectName'),
          apiVersion: assertOptionalString(a.apiVersion, 'apiVersion'),
          body: assertString(a.body, 'body'),
        };
        return await handleWriteApexTrigger(conn, validatedArgs);
      }

      case "salesforce_execute_anonymous": {
        const a = assertPlainObject(args, 'arguments');
        const validatedArgs: ExecuteAnonymousArgs = {
          apexCode: assertString(a.apexCode, 'apexCode'),
          logLevel: assertOptionalLogLevel(a.logLevel, 'logLevel'),
        };
        return await handleExecuteAnonymous(conn, validatedArgs);
      }

      case "salesforce_manage_debug_logs": {
        const a = assertPlainObject(args, 'arguments');
        const validatedArgs: ManageDebugLogsArgs = {
          operation: assertEnum(a.operation, 'operation', ['enable', 'disable', 'retrieve'] as const),
          username: assertString(a.username, 'username'),
          logLevel: assertOptionalLogLevel(a.logLevel, 'logLevel'),
          expirationTime: assertOptionalNumber(a.expirationTime, 'expirationTime'),
          limit: assertOptionalNumber(a.limit, 'limit'),
          logId: assertOptionalString(a.logId, 'logId'),
          includeBody: assertOptionalBoolean(a.includeBody, 'includeBody'),
          offset: assertOptionalNumber(a.offset, 'offset'),
        };
        return await handleManageDebugLogs(conn, validatedArgs);
      }

      case "salesforce_list_analytics": {
        const a = assertPlainObject(args, 'arguments');
        const validatedArgs: ListAnalyticsArgs = {
          type: assertEnum(a.type, 'type', ['report', 'dashboard'] as const),
          searchTerm: assertOptionalString(a.searchTerm, 'searchTerm'),
        };
        return await handleListAnalytics(conn, validatedArgs);
      }

      case "salesforce_describe_analytics": {
        const a = assertPlainObject(args, 'arguments');
        const validatedArgs: DescribeAnalyticsArgs = {
          type: assertEnum(a.type, 'type', ['report', 'dashboard'] as const),
          resourceId: assertString(a.resourceId, 'resourceId'),
        };
        return await handleDescribeAnalytics(conn, validatedArgs);
      }

      case "salesforce_run_analytics": {
        const a = assertPlainObject(args, 'arguments');
        const validatedArgs: RunAnalyticsArgs = {
          type: assertEnum(a.type, 'type', ['report', 'dashboard'] as const),
          resourceId: assertString(a.resourceId, 'resourceId'),
          includeDetails: assertOptionalBoolean(a.includeDetails, 'includeDetails'),
          filters: assertOptionalReportFilters(a.filters, 'filters'),
          booleanFilter: assertOptionalString(a.booleanFilter, 'booleanFilter'),
          standardDateFilter: assertOptionalStandardDateFilter(a.standardDateFilter, 'standardDateFilter'),
          topRows: assertOptionalTopRows(a.topRows, 'topRows'),
        };
        return await handleRunAnalytics(conn, validatedArgs);
      }

      case "salesforce_refresh_dashboard": {
        const a = assertPlainObject(args, 'arguments');
        const validatedArgs: RefreshDashboardArgs = {
          operation: assertEnum(a.operation, 'operation', ['refresh', 'status'] as const),
          dashboardId: assertString(a.dashboardId, 'dashboardId'),
        };
        return await handleRefreshDashboard(conn, validatedArgs);
      }

      case "salesforce_rest_api": {
        const a = assertPlainObject(args, 'arguments');
        const validatedArgs: RestApiArgs = {
          method: assertEnum(a.method, 'method', ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const),
          endpoint: assertString(a.endpoint, 'endpoint'),
          body: assertOptionalPlainObject(a.body, 'body'),
          queryParameters: assertOptionalQueryStringRecord(a.queryParameters, 'queryParameters'),
          apiVersion: assertOptionalString(a.apiVersion, 'apiVersion'),
          rawPath: assertOptionalBoolean(a.rawPath, 'rawPath'),
        };
        return await handleRestApi(conn, validatedArgs);
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }],
      isError: true,
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Salesforce MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
