export const SALESFORCE_GUIDE_CONTENT = `# Salesforce MCP Tools — Reference Guide

Read this guide before working with Salesforce data through the MCP tools. It documents which tool to use for each task, known limitations, and patterns that work reliably.

## Available Tools

| Tool | Use For |
|------|---------|
| \`salesforce_query_records\` | SOQL queries that return individual records |
| \`salesforce_aggregate_query\` | SOQL queries with GROUP BY and aggregate functions |
| \`salesforce_describe_object\` | Get object schema — fields, types, relationships, picklist values |
| \`salesforce_search_objects\` | Find objects by name pattern (e.g., find all objects matching "Order") |
| \`salesforce_search_all\` | SOSL cross-object text search |
| \`salesforce_dml_records\` | Insert, update, delete, upsert records |
| \`salesforce_manage_object\` | Create or modify custom objects |
| \`salesforce_manage_field\` | Create or modify custom fields |
| \`salesforce_manage_field_permissions\` | Grant, revoke, or view field-level security per profile |
| \`salesforce_execute_anonymous\` | Run anonymous Apex code |
| \`salesforce_read_apex\` | Read Apex class source code |
| \`salesforce_write_apex\` | Create or update Apex classes |
| \`salesforce_read_apex_trigger\` | Read Apex trigger source code |
| \`salesforce_write_apex_trigger\` | Create or update Apex triggers |
| \`salesforce_manage_debug_logs\` | Enable, disable, or retrieve debug logs |
| \`salesforce_list_analytics\` | List/search reports and dashboards |
| \`salesforce_describe_analytics\` | Get report/dashboard metadata (columns, filters, components) |
| \`salesforce_run_analytics\` | Execute reports with filter overrides; retrieve dashboard component data |
| \`salesforce_refresh_dashboard\` | Trigger dashboard refresh or check refresh status |
| \`salesforce_rest_api\` | Direct REST API passthrough — call any Salesforce REST endpoint |

## Querying Data

### Simple record queries — use \`salesforce_query_records\`

Use this for fetching individual records with filters, sorting, and relationship traversal.

\`\`\`
objectName: "Contact"
fields: ["FirstName", "LastName", "Account.Name"]
whereClause: "Account.Industry = 'Technology'"
orderBy: "LastName ASC"
limit: 50
\`\`\`

**What works well:**
- Parent-to-child subqueries: \`"(SELECT Name, StageName FROM Opportunities WHERE IsClosed = false)"\`
- Child-to-parent dot notation: \`"Account.Name"\`, \`"Owner.Name"\`, \`"Account.Owner.Name"\` — these resolve to actual names in query results.
- SOQL date literals: \`THIS_QUARTER\`, \`LAST_N_DAYS:30\`, \`THIS_YEAR\`, etc. all work in \`whereClause\`.
- ORDER BY with ASC/DESC works. Note: nulls sort first in DESC order.

**Pagination:** Results default to 200 records per page. Use \`limit\` and \`offset\` to page through results. The response includes total record count and a hint for the next page offset. Pages are not snapshot-consistent — if data changes between requests, records may shift.

**Known limitations:**
- Offset max is 2,000 (Salesforce SOQL limit). For larger offsets, use a \`WHERE Id > 'lastSeenId' ORDER BY Id\` pattern.
- Results that exceed ~80KB are saved to a file instead of returned inline. If this happens, read the file to extract the data.
- **Do not use aggregate functions** (COUNT, SUM, etc.) with this tool — it will return null values. Use \`salesforce_aggregate_query\` or \`salesforce_execute_anonymous\` instead.

### Grouped/aggregate queries — use \`salesforce_aggregate_query\`

Use this for GROUP BY queries with COUNT, SUM, AVG, MIN, MAX, COUNT_DISTINCT.

\`\`\`
objectName: "Opportunity"
selectFields: ["StageName", "COUNT(Id) OpportunityCount", "SUM(Amount) TotalAmount"]
groupByFields: ["StageName"]
\`\`\`

**What works well:**
- COUNT, SUM, AVG all return correct values.
- ORDER BY aggregate functions works: \`"orderBy": "COUNT(Id) DESC"\` or \`"orderBy": "SUM(Amount) DESC"\`.
- HAVING clause works: \`"havingClause": "COUNT(Id) > 1"\`.
- Date function grouping works: \`CALENDAR_YEAR(CloseDate)\`, \`CALENDAR_QUARTER(CloseDate)\`, \`CALENDAR_MONTH(CloseDate)\` in both \`selectFields\` and \`groupByFields\`. Combine year + month for monthly breakdowns:
  \`\`\`
  selectFields: ["CALENDAR_YEAR(CloseDate) Year", "CALENDAR_MONTH(CloseDate) Month", "SUM(Amount) Total"]
  groupByFields: ["CALENDAR_YEAR(CloseDate)", "CALENDAR_MONTH(CloseDate)"]
  orderBy: "CALENDAR_YEAR(CloseDate) ASC, CALENDAR_MONTH(CloseDate) ASC"
  \`\`\`
  Note: months are returned as integers (1-12), not names.

**Known limitations:**
- **Requires at least one field in \`groupByFields\`** — passing an empty array causes a SOQL syntax error. This means you cannot use this tool for ungrouped aggregates like \`SELECT COUNT() FROM Account\`.
- **Relationship fields return null in grouped results.** Grouping by \`Account.Name\` or \`Owner.Name\` will produce results where the field value is null, even though the grouping itself works (you'll see the correct number of groups with correct counts, but the name field will be null). **Workaround — two-step pattern:**
  1. Group by the Id field instead (e.g., \`OwnerId\`):
     \`\`\`
     objectName: "Opportunity"
     selectFields: ["OwnerId", "COUNT(Id) OppCount", "SUM(Amount) TotalAmount"]
     groupByFields: ["OwnerId"]
     \`\`\`
  2. Resolve the Ids to names with a follow-up query:
     \`\`\`
     objectName: "User"
     fields: ["Id", "Name"]
     whereClause: "Id IN ('005xx...', '005xx...')"
     \`\`\`
  This two-step pattern is necessary any time you need human-readable names in aggregate reports (e.g., "pipeline by rep", "deals by account").
- All non-aggregate fields in \`selectFields\` must also appear in \`groupByFields\`.
- OFFSET is not supported with GROUP BY in Salesforce.

### Getting a total record count

The MCP tools don't cleanly support \`SELECT COUNT() FROM Object\` (no GROUP BY). Use one of these approaches:

**Option 1 — Group by a filtered boolean (preferred):**
\`\`\`
Tool: salesforce_aggregate_query
objectName: "Account"
selectFields: ["COUNT(Id) Total"]
groupByFields: ["IsDeleted"]
whereClause: "IsDeleted = false"
\`\`\`
This works because the WHERE clause reduces the grouping to a single row. The same pattern works with any boolean — for example, to count open opportunities, group by \`IsClosed\` with \`whereClause: "IsClosed = false"\`. You can also combine aggregates:
\`\`\`
selectFields: ["SUM(Amount) TotalAmount"]
groupByFields: ["IsClosed"]
whereClause: "IsClosed = false"
\`\`\`

**Option 2 — Anonymous Apex (requires debug logs enabled):**
\`\`\`
Tool: salesforce_execute_anonymous
apexCode: "System.debug(LoggingLevel.ERROR, 'Count: ' + [SELECT COUNT() FROM Account]);"
logLevel: "ERROR"
\`\`\`
Note: You must enable debug logs for the user first (see Debug Logs section below). Use \`LoggingLevel.ERROR\` to cut through log noise.

**Option 3 — Query Ids and count from the result file:**
Query with a high limit — the results will be saved to a file due to size. Parse the file to count records. Be aware that responses over ~80KB are truncated to a file, and very large objects (tens of thousands of records) will produce extremely large result files. Options 1 and 2 are more efficient.

### Cross-object text search — use \`salesforce_search_all\`

Use SOSL when searching for a text value across multiple objects simultaneously.

\`\`\`
searchTerm: "Acme*"
searchIn: "NAME FIELDS"
objects: [
  { "name": "Account", "fields": ["Name", "Industry"], "limit": 10 },
  { "name": "Contact", "fields": ["FirstName", "LastName", "Email"], "limit": 10 }
]
\`\`\`

Supports wildcards (\`*\` and \`?\`). Each object can have its own WHERE, ORDER BY, and LIMIT.

**What works well:**
- Cross-object search returns results from all specified objects in a single call.
- Per-object WHERE filters work inside SOSL (e.g., \`"where": "Industry != null"\`).
- Wildcard search (\`Cloud*\`) matches across all specified fields.

## Inspecting Schemas

### Describe an object — use \`salesforce_describe_object\`

Returns all fields, their types, relationships, picklist values, and properties.

\`\`\`
objectName: "Account"
\`\`\`

Use this before writing queries to confirm field API names, especially for custom fields (\`Field__c\`) and relationships (\`Relationship__r\`).

**Caveat:** The picklist values returned by \`describe_object\` are the *configured* values in Salesforce Setup, not necessarily the values that exist in actual records. Data may contain values that were added through imports, integrations, or since-removed picklist options. If filtering by a picklist value returns 0 records, query the actual data to see what values are in use (e.g., use \`salesforce_aggregate_query\` to GROUP BY that field).

### Find objects — use \`salesforce_search_objects\`

Search for objects by name pattern when you don't know the exact API name.

\`\`\`
searchPattern: "Order"
\`\`\`

Returns matching standard and custom objects (e.g., Order, WorkOrder, ServiceOrder__c).

## Modifying Data

### DML operations — use \`salesforce_dml_records\`

Supports insert, update, delete, and upsert.

**Insert:**
\`\`\`
operation: "insert"
objectName: "Account"
records: [{ "Name": "New Account", "Industry": "Technology" }]
\`\`\`

**Update (requires Id):**
\`\`\`
operation: "update"
objectName: "Account"
records: [{ "Id": "001xx000003ABCDEF", "Industry": "Healthcare" }]
\`\`\`

**Upsert (requires externalIdField):**
\`\`\`
operation: "upsert"
objectName: "Account"
externalIdField: "External_Id__c"
records: [{ "External_Id__c": "EXT-001", "Name": "Upserted Account" }]
\`\`\`

**Delete (requires Id):**
\`\`\`
operation: "delete"
objectName: "Account"
records: [{ "Id": "001xx000003ABCDEF" }]
\`\`\`

## Managing Field-Level Security

### View, grant, or revoke field permissions — use \`salesforce_manage_field_permissions\`

> **Known bug:** The \`view\` operation is currently broken due to a SOQL error in the MCP server (\`No such column 'PermissionSetId' on entity 'PermissionSet'\`). Grant and revoke may still work, but view does not. This is an upstream bug in the MCP server.

**View current permissions:**
\`\`\`
operation: "view"
objectName: "Account"
fieldName: "Custom_Field__c"
\`\`\`

**Grant access to profiles:**
\`\`\`
operation: "grant"
objectName: "Account"
fieldName: "Custom_Field__c"
profileNames: ["System Administrator", "Sales User"]
readable: true
editable: true
\`\`\`

**Revoke access:**
\`\`\`
operation: "revoke"
objectName: "Account"
fieldName: "Custom_Field__c"
profileNames: ["Sales User"]
\`\`\`

## Working with Apex

### Reading Apex — use \`salesforce_read_apex\` / \`salesforce_read_apex_trigger\`

- Pass \`className\` or \`triggerName\` to get the full source code of a specific class/trigger.
- Pass \`namePattern\` with wildcards to search (e.g., \`"*Controller*"\` to find all controller classes).
- Omit both to list all class/trigger names.
- Set \`includeMetadata: true\` to get API version, length, and last modified date.

**Pagination:** Listing queries default to 50 results. Use \`limit\` and \`offset\` to page through results.

**Tips from testing:**
- Listing all Apex classes with \`"*"\` on a large org can exceed the response size limit and get saved to a file. Use a more specific \`namePattern\` to narrow results.
- Trigger listing with \`includeMetadata: true\` returns a clean table with name, API version, object, status, validity, and last modified date.
- The \`username\` parameter in \`manage_debug_logs\` must match the Salesforce \`Username\` field exactly, not the display name. Query the User object first if unsure.

### Writing Apex — use \`salesforce_write_apex\` / \`salesforce_write_apex_trigger\`

**Apex classes:**
\`\`\`
operation: "create"  (or "update")
className: "AccountService"
body: "public class AccountService { ... }"
apiVersion: "58.0"  (optional, defaults to latest)
\`\`\`

**Apex triggers** (create requires \`objectName\`):
\`\`\`
operation: "create"
triggerName: "AccountTrigger"
objectName: "Account"
body: "trigger AccountTrigger on Account (before insert) { ... }"
apiVersion: "58.0"  (optional)
\`\`\`

For updates, \`objectName\` is not required — just \`triggerName\` and \`body\`.

Note: The \`className\`/\`triggerName\` in the \`body\` must match the \`className\`/\`triggerName\` parameter.

### Execute Anonymous — use \`salesforce_execute_anonymous\`

Runs Apex code without saving it to the org. Useful for one-off data operations, queries that other tools can't handle, or quick calculations.

**Important:** The output of \`System.debug()\` is only visible if debug logs are enabled for the user. If you get "No logs available," enable debug logs first (see below).

**Tips from testing:**
- Do not use HTML entities in \`apexCode\`. For example, write \`List<User>\` literally, not \`List&lt;User&gt;\` — the tool sends the string as-is to Salesforce, and entities will cause compilation errors.
- The tool confirms compilation and execution success/failure even without debug logs, so it's useful for validating Apex syntax.
- For read-only count queries that the other tools can't handle, anonymous Apex with \`[SELECT COUNT() FROM Object]\` works — but you need debug logs enabled to see the result.

## Debug Logs

### Enable logs before using \`salesforce_execute_anonymous\`

\`\`\`
Tool: salesforce_manage_debug_logs
operation: "enable"
username: "user@example.com"
logLevel: "DEBUG"
expirationTime: 30
\`\`\`

### Retrieve logs

\`\`\`
Tool: salesforce_manage_debug_logs
operation: "retrieve"
username: "user@example.com"
limit: 5
includeBody: true
\`\`\`

### Disable logs when done

\`\`\`
Tool: salesforce_manage_debug_logs
operation: "disable"
username: "user@example.com"
\`\`\`

## Reports & Dashboards

### Finding reports and dashboards — use \`salesforce_list_analytics\`

\`\`\`
type: "report"
searchTerm: "Pipeline"
limit: 10
\`\`\`

Returns report/dashboard IDs, names, folders, and formats. Use this to find IDs before describing or running them.

### Inspecting report/dashboard metadata — use \`salesforce_describe_analytics\`

\`\`\`
type: "report"
resourceId: "00Oxx000000XXXXX"
\`\`\`

For reports: returns columns, groupings, filters, aggregates, date filter, and scope. Use this to understand a report's structure before running it with filter overrides.

For dashboards: returns component list with headers, visualization types, and associated report IDs.

### Running reports — use \`salesforce_run_analytics\`

\`\`\`
type: "report"
resourceId: "00Oxx000000XXXXX"
includeDetails: true
filters: [{ "column": "STAGE_NAME", "operator": "equals", "value": "Closed Won" }]
\`\`\`

**What works well:**
- Grand totals and grouping summaries are always returned in full.
- Runtime filter overrides, boolean filter logic, standard date filter overrides.
- \`includeDetails: true\` returns detail rows (capped at 100 displayed, adjustable with \`topRows\`).
- Dashboard component data via \`type: "dashboard"\` — returns aggregates and grouping summaries per component.

**Known limitations:**
- Salesforce sync report API has a hard 2,000 detail row limit.
- Some report formats don't support \`topRows\` — the tool retries without it automatically.
- Salesforce enforces a 500 reports/hour synchronous execution limit.

### Refreshing dashboards — use \`salesforce_refresh_dashboard\`

\`\`\`
operation: "refresh"
dashboardId: "01Zxx000000XXXXX"
\`\`\`

Triggers a dashboard refresh. Use \`operation: "status"\` to check progress, then \`salesforce_run_analytics\` with \`type: "dashboard"\` to retrieve updated data.

## REST API Passthrough

### Direct API calls — use \`salesforce_rest_api\`

A generic passthrough to any Salesforce REST endpoint. Use this for APIs not covered by dedicated tools.

\`\`\`
method: "GET"
endpoint: "/limits"
\`\`\`

**Common uses:**
- \`GET /limits\` — org API usage limits
- \`GET /analytics/reports/{id}/describe\` — report metadata via REST
- \`GET /query?q=SELECT...\` — SOQL via REST
- \`GET /tooling/query?q=SELECT...\` — Tooling API queries
- \`GET /sobjects/{object}/describe\` — object metadata via REST
- \`POST /composite\` — batch multiple operations (with \`body\` parameter)

**Options:**
- \`queryParameters\` — URL query params as key-value pairs
- \`apiVersion\` — override the default API version
- \`rawPath: true\` — treat endpoint as a full path (e.g., \`/services/apexrest/MyEndpoint\`)

**Note:** This tool supports all HTTP methods including POST, PATCH, PUT, and DELETE. Access is governed by the connected Salesforce user's permissions.

## Known Bugs and Gotchas

These are issues discovered during testing that may cause unexpected behavior:

1. **Relationship fields return null in aggregate queries.** Grouping by \`Account.Name\` or \`Owner.Name\` in \`salesforce_aggregate_query\` returns null for those fields. Group by the Id field instead and resolve names separately.

2. **\`salesforce_manage_field_permissions\` view operation is broken.** Returns a SOQL error (\`No such column 'PermissionSetId'\`). This is an upstream bug in the MCP server.

3. **Picklist values from \`describe_object\` may not match actual data.** The describe returns configured picklist options from Salesforce Setup, but records may contain values from imports, integrations, or removed options. Always verify with a GROUP BY query if a filter returns 0 records unexpectedly.

4. **\`salesforce_aggregate_query\` cannot do ungrouped aggregates.** \`SELECT COUNT() FROM Account\` (no GROUP BY) is not supported — \`groupByFields\` must have at least one field. Workaround: group by \`IsDeleted\` with \`whereClause: "IsDeleted = false"\`.

5. **Large result sets overflow to a file.** Responses over ~80KB are saved to a temp file. This affects \`query_records\` (at ~2,000 records) and \`read_apex\` (listing all classes on a large org). Set explicit limits or use narrower patterns.

6. **\`execute_anonymous\` output requires debug logs.** The tool confirms success/failure but \`System.debug()\` output is only visible if debug logs are enabled for the running user via \`manage_debug_logs\`.

7. **Debug log \`username\` must be the Salesforce Username, not the display name.** For example, \`user@company.com\` works but \`Jane Smith\` does not. Query the User object first if you don't know the username.

## General Best Practices

1. **Describe before querying.** If you're unsure of field names, run \`salesforce_describe_object\` first. Custom fields end in \`__c\`, custom relationships end in \`__r\`.

2. **Set explicit limits.** The default query limit is 2,000 records. For large objects, always set a limit to avoid oversized responses.

3. **Use \`salesforce_search_objects\` to find object API names.** Don't guess — search for the object first if you're not sure of the exact name.

4. **Prefer the specific tool over anonymous Apex.** Use \`salesforce_query_records\` for queries, \`salesforce_dml_records\` for data changes, etc. Fall back to \`salesforce_execute_anonymous\` only when the dedicated tools can't handle the operation.

5. **Enable debug logs before running anonymous Apex that uses System.debug().** Without them, you'll get "No logs available" and lose all output.

6. **Be cautious with DML operations.** These modify production data. Confirm the operation with the user before executing inserts, updates, or deletes.
`;
