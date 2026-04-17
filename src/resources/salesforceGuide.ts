export const SALESFORCE_GUIDE_CONTENT = `# Salesforce MCP Tools — Reference Guide

Read this guide before working with Salesforce data through the MCP tools. It documents which tool to use for each task, all parameters, known limitations, and patterns that work reliably.


## Bulk Processing Approval

Before executing any task that creates or updates more than 100 records in Salesforce, stop and ask the user:

> "Has Dave or Akhil approved this bulk processing using Apollo data? (yes/no)"

- If **yes** — proceed.
- If **no** — do not proceed. Inform the user that approval from Dave or Akhil is required before continuing.

This applies regardless of the data source or operation type (insert, update, upsert, delete).

## Contact Creation Rule

**Never create a Contact in Salesforce without an email address.** This applies regardless of source (Apollo, manual entry, list import, etc.). If you do not have a verified or available email for the person, skip the creation entirely.

## Job Change Processing (Apollo)

When processing a job change identified via Apollo:

1. **Mark the old contact as changed job** — set `Changed_Job__c = true` and `Apollo_Stage__c = 'Changed Job'` on the existing contact. Do not update the existing contact with any new job information.
2. **Create a new contact for the new job** — find or create the new employer's Account, then insert a new Contact record with the person's new title, email, and other details from Apollo. If Apollo does not return an email for the person at their new company, do not create the new contact.
v2

## Tool Selection Quick Reference

| Task | Tool | Key Parameters |
|------|------|----------------|
| Fetch individual records (SOQL) | \`salesforce_query_records\` | objectName, fields, whereClause, orderBy, limit, offset |
| Aggregate/GROUP BY queries | \`salesforce_aggregate_query\` | objectName, selectFields, groupByFields, havingClause |
| Get object schema | \`salesforce_describe_object\` | objectName |
| Find objects by name | \`salesforce_search_objects\` | searchPattern, limit, offset |
| Cross-object text search (SOSL) | \`salesforce_search_all\` | searchTerm, searchIn, objects |
| Insert/update/delete/upsert records | \`salesforce_dml_records\` | operation, objectName, records, externalIdField |
| Create/modify custom objects | \`salesforce_manage_object\` | operation, objectName, label, sharingModel |
| Create/modify custom fields | \`salesforce_manage_field\` | operation, objectName, fieldName, type, label |
| Manage field-level security | \`salesforce_manage_field_permissions\` | operation, objectName, fieldName, profileNames |
| Run anonymous Apex | \`salesforce_execute_anonymous\` | apexCode, logLevel |
| Read Apex class source | \`salesforce_read_apex\` | className, namePattern, includeMetadata |
| Create/update Apex classes | \`salesforce_write_apex\` | operation, className, body, apiVersion |
| Read Apex trigger source | \`salesforce_read_apex_trigger\` | triggerName, namePattern, includeMetadata |
| Create/update Apex triggers | \`salesforce_write_apex_trigger\` | operation, triggerName, objectName, body |
| Enable/disable/retrieve debug logs | \`salesforce_manage_debug_logs\` | operation, username, logLevel, limit |
| List/search reports & dashboards | \`salesforce_list_analytics\` | type, searchTerm |
| Get report/dashboard metadata | \`salesforce_describe_analytics\` | type, resourceId |
| Execute reports / get dashboard data | \`salesforce_run_analytics\` | type, resourceId, includeDetails, filters |
| Refresh a dashboard | \`salesforce_refresh_dashboard\` | operation, dashboardId |
| Direct REST API call | \`salesforce_rest_api\` | method, endpoint, body, queryParameters, rawPath |

---

## Tool Parameter Reference

### salesforce_query_records

Fetch individual records using SOQL with relationship traversal.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| objectName | string | Yes | — | API name of the object (e.g., "Account", "Custom__c") |
| fields | string[] | Yes | — | Fields to retrieve, including relationship fields and subqueries |
| whereClause | string | No | — | SOQL WHERE clause (omit the "WHERE" keyword) |
| orderBy | string | No | — | ORDER BY clause (e.g., "Name ASC", "CreatedDate DESC") |
| limit | number | No | 200 | Max records per page (Salesforce max: 2000) |
| offset | number | No | 0 | Records to skip for pagination (max: 2000) |

**Examples:**

Simple query:
\`\`\`
objectName: "Account"
fields: ["Name", "Industry", "AnnualRevenue"]
whereClause: "Industry = 'Technology'"
orderBy: "AnnualRevenue DESC"
limit: 10
\`\`\`

Parent-to-child subquery (Account with its Contacts):
\`\`\`
objectName: "Account"
fields: ["Name", "(SELECT FirstName, LastName, Email FROM Contacts)"]
whereClause: "Industry = 'Technology'"
\`\`\`

Child-to-parent traversal (Contact → Account → Owner):
\`\`\`
objectName: "Contact"
fields: ["FirstName", "LastName", "Account.Name", "Account.Owner.Name"]
whereClause: "Account.Industry = 'Technology'"
\`\`\`

Using SOQL date literals:
\`\`\`
objectName: "Opportunity"
fields: ["Name", "StageName", "Amount", "CloseDate"]
whereClause: "CloseDate = THIS_QUARTER AND Amount > 50000"
orderBy: "CloseDate ASC"
\`\`\`

Pagination (page 3 of 50-record pages):
\`\`\`
objectName: "Account"
fields: ["Name"]
orderBy: "Id ASC"
limit: 50
offset: 100
\`\`\`

**Notes:**
- Response includes \`totalSize\` and \`nextOffset\` for pagination.
- Offset max is 2,000 (Salesforce limit). For larger data sets, use \`WHERE Id > 'lastSeenId' ORDER BY Id\`.
- Results exceeding ~80KB are saved to a temp file instead of returned inline.
- **Do NOT use aggregate functions** (COUNT, SUM, etc.) with this tool — they return null. Use \`salesforce_aggregate_query\` instead.

---

### salesforce_aggregate_query

Execute GROUP BY queries with aggregate functions.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| objectName | string | Yes | — | API name of the object |
| selectFields | string[] | Yes | — | Mix of group fields and aggregates (e.g., "StageName", "COUNT(Id) Total") |
| groupByFields | string[] | Yes | — | Fields to group by — must include all non-aggregate selectFields |
| whereClause | string | No | — | Filter rows BEFORE grouping (no aggregate functions allowed here) |
| havingClause | string | No | — | Filter AFTER grouping (use for aggregate conditions like "COUNT(Id) > 5") |
| orderBy | string | No | — | Only grouped fields or aggregate functions allowed |
| limit | number | No | — | Max grouped results to return |

**Examples:**

Count by stage:
\`\`\`
objectName: "Opportunity"
selectFields: ["StageName", "COUNT(Id) OpportunityCount", "SUM(Amount) TotalAmount"]
groupByFields: ["StageName"]
orderBy: "SUM(Amount) DESC"
\`\`\`

Monthly revenue breakdown:
\`\`\`
objectName: "Opportunity"
selectFields: ["CALENDAR_YEAR(CloseDate) Year", "CALENDAR_MONTH(CloseDate) Month", "SUM(Amount) Revenue"]
groupByFields: ["CALENDAR_YEAR(CloseDate)", "CALENDAR_MONTH(CloseDate)"]
orderBy: "CALENDAR_YEAR(CloseDate) ASC, CALENDAR_MONTH(CloseDate) ASC"
\`\`\`

HAVING filter (accounts with >10 opportunities):
\`\`\`
objectName: "Opportunity"
selectFields: ["AccountId", "COUNT(Id) OppCount"]
groupByFields: ["AccountId"]
havingClause: "COUNT(Id) > 10"
\`\`\`

**Known limitations:**
- \`groupByFields\` must have at least one field — ungrouped aggregates like \`SELECT COUNT() FROM Account\` are not supported. **Workaround:** group by \`IsDeleted\` with \`whereClause: "IsDeleted = false"\` to get a single-row result.
- **Relationship fields (e.g., Account.Name, Owner.Name) return null** in grouped results. The grouping works correctly (right number of groups, right counts) but the name resolves to null. **Workaround:** group by the Id field (e.g., \`OwnerId\`) and resolve names with a follow-up \`salesforce_query_records\` call.
- OFFSET is not supported with GROUP BY in Salesforce.
- All non-aggregate fields in \`selectFields\` must appear in \`groupByFields\`.

---

### salesforce_describe_object

Get complete schema metadata for any Salesforce object.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| objectName | string | Yes | API name of the object (e.g., "Account", "Custom__c") |

**Example:**
\`\`\`
objectName: "Account"
\`\`\`

Returns: all fields with types, lengths, picklist values, relationships (lookup/master-detail), required/unique/externalId flags, and child relationships.

**Note:** Picklist values returned are the *configured* values in Setup, not necessarily values in actual records. Records may contain imported or since-removed values. If filtering by a picklist value returns 0 records, verify actual data with a GROUP BY query.

---

### salesforce_search_objects

Find standard and custom objects by name pattern.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| searchPattern | string | Yes | — | Pattern to match (e.g., "Account", "Order", "Coverage") |
| limit | number | No | 50 | Max results |
| offset | number | No | 0 | Pagination offset |

**Example:**
\`\`\`
searchPattern: "Order"
\`\`\`
Returns: Order, WorkOrder, OrderItem, ServiceOrder__c, etc.

**Best practice:** Always use this tool to find the correct API name before querying an unfamiliar object. Don't guess — custom object names end in \`__c\`.

---

### salesforce_search_all

Cross-object text search using SOSL.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| searchTerm | string | Yes | — | Text to search for (supports \`*\` and \`?\` wildcards) |
| searchIn | string | No | "ALL FIELDS" | Scope: "ALL FIELDS", "NAME FIELDS", "EMAIL FIELDS", "PHONE FIELDS", "SIDEBAR FIELDS" |
| objects | object[] | Yes | — | List of objects to search, each with: name (required), fields (required), where, orderBy, limit |
| withClauses | object[] | No | — | Additional WITH clauses (DATA CATEGORY, NETWORK, SNIPPET, etc.) |

**Example:**
\`\`\`
searchTerm: "Acme*"
searchIn: "NAME FIELDS"
objects: [
  { "name": "Account", "fields": ["Name", "Industry"], "limit": 10 },
  { "name": "Contact", "fields": ["FirstName", "LastName", "Email"], "where": "IsActive = true", "limit": 10 }
]
\`\`\`

**Notes:**
- Results come back grouped by object.
- Minimum search term length is 2 characters.
- Per-object WHERE, ORDER BY, and LIMIT are all supported.

---

### salesforce_dml_records

Insert, update, delete, or upsert records.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| operation | string | Yes | — | "insert", "update", "delete", or "upsert" |
| objectName | string | Yes | — | API name of the object |
| records | object[] | Yes | — | Array of record objects |
| externalIdField | string | No | — | Required for upsert — the external ID field name |

**Examples:**

Insert:
\`\`\`
operation: "insert"
objectName: "Account"
records: [{ "Name": "Acme Corp", "Industry": "Technology" }]
\`\`\`

Update (Id required):
\`\`\`
operation: "update"
objectName: "Account"
records: [{ "Id": "001xx000003ABCDEF", "Industry": "Healthcare" }]
\`\`\`

Upsert (externalIdField required):
\`\`\`
operation: "upsert"
objectName: "Account"
externalIdField: "External_Id__c"
records: [{ "External_Id__c": "EXT-001", "Name": "Upserted Account" }]
\`\`\`

Delete (Id required):
\`\`\`
operation: "delete"
objectName: "Account"
records: [{ "Id": "001xx000003ABCDEF" }]
\`\`\`

**Important:** These operations modify production data. Confirm with the user before executing.

---

### salesforce_manage_object

Create or modify custom Salesforce objects.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| operation | string | Yes | — | "create" or "update" |
| objectName | string | Yes | — | API name without __c suffix |
| label | string | No | — | Display label |
| pluralLabel | string | No | — | Plural display label |
| description | string | No | — | Object description |
| nameFieldLabel | string | No | — | Label for the Name field |
| nameFieldType | string | No | — | "Text" or "AutoNumber" |
| nameFieldFormat | string | No | — | Format for AutoNumber (e.g., "FB-{0000}") |
| sharingModel | string | No | — | "ReadWrite", "Read", "Private", or "ControlledByParent" |

**Example:**
\`\`\`
operation: "create"
objectName: "Customer_Feedback"
label: "Customer Feedback"
pluralLabel: "Customer Feedback"
nameFieldType: "AutoNumber"
nameFieldFormat: "FB-{0000}"
sharingModel: "ReadWrite"
\`\`\`

---

### salesforce_manage_field

Create or modify custom fields on any object.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| operation | string | Yes | — | "create" or "update" |
| objectName | string | Yes | — | API name of the parent object |
| fieldName | string | Yes | — | API name without __c suffix |
| label | string | No | — | Display label |
| type | string | No | — | Field type: Checkbox, Currency, Date, DateTime, Email, Number, Percent, Phone, Picklist, MultiselectPicklist, Text, TextArea, LongTextArea, Html, Url, Lookup, MasterDetail |
| required | boolean | No | false | Make field required |
| unique | boolean | No | false | Enforce unique values |
| externalId | boolean | No | false | Mark as external ID |
| length | number | No | — | Length for Text fields |
| precision | number | No | — | Total digits for Number fields |
| scale | number | No | — | Decimal places for Number fields |
| referenceTo | string | No | — | Target object for Lookup/MasterDetail |
| relationshipLabel | string | No | — | Relationship display label |
| relationshipName | string | No | — | Relationship API name |
| deleteConstraint | string | No | — | "Cascade", "Restrict", or "SetNull" |
| picklistValues | object[] | No | — | Array of {label, isDefault} for picklist fields |
| description | string | No | — | Field description |
| grantAccessTo | string[] | No | ["System Administrator"] | Profiles to grant FLS to automatically |

**Examples:**

Text field:
\`\`\`
operation: "create"
objectName: "Account"
fieldName: "External_Reference"
label: "External Reference"
type: "Text"
length: 100
unique: true
externalId: true
\`\`\`

Picklist:
\`\`\`
operation: "create"
objectName: "Case"
fieldName: "Severity"
label: "Severity"
type: "Picklist"
picklistValues: [
  { "label": "Critical", "isDefault": false },
  { "label": "High", "isDefault": false },
  { "label": "Medium", "isDefault": true },
  { "label": "Low", "isDefault": false }
]
grantAccessTo: ["System Administrator", "Support User"]
\`\`\`

Lookup relationship:
\`\`\`
operation: "create"
objectName: "Custom_Feedback__c"
fieldName: "Related_Account"
label: "Related Account"
type: "Lookup"
referenceTo: "Account"
relationshipLabel: "Customer Feedback"
relationshipName: "Customer_Feedback"
deleteConstraint: "SetNull"
\`\`\`

---

### salesforce_manage_field_permissions

Grant, revoke, or view field-level security for profiles.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| operation | string | Yes | — | "grant", "revoke", or "view" |
| objectName | string | Yes | — | API name of the object |
| fieldName | string | Yes | — | API name of the field |
| profileNames | string[] | No | — | Profile names (required for grant/revoke) |
| readable | boolean | No | true | Grant/revoke read access |
| editable | boolean | No | true | Grant/revoke edit access |

**Examples:**

Grant full access:
\`\`\`
operation: "grant"
objectName: "Account"
fieldName: "Custom_Field__c"
profileNames: ["System Administrator", "Sales User"]
readable: true
editable: true
\`\`\`

Read-only access:
\`\`\`
operation: "grant"
objectName: "Account"
fieldName: "Custom_Field__c"
profileNames: ["Marketing User"]
readable: true
editable: false
\`\`\`

> **Known bug:** The \`view\` operation returns a SOQL error (\`No such column 'PermissionSetId'\`). Grant and revoke work. This is an upstream bug.

---

### salesforce_execute_anonymous

Run Apex code without creating a permanent class.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| apexCode | string | Yes | — | Valid Apex code to execute |
| logLevel | string | No | "DEBUG" | Log level: NONE, ERROR, WARN, INFO, DEBUG, FINE, FINER, FINEST |

**Examples:**

Simple debug output:
\`\`\`
apexCode: "System.debug(LoggingLevel.ERROR, 'Count: ' + [SELECT COUNT() FROM Account]);"
logLevel: "ERROR"
\`\`\`

Data operation:
\`\`\`
apexCode: "List<Account> accts = [SELECT Id, Rating FROM Account WHERE Rating = null LIMIT 100]; for (Account a : accts) { a.Rating = 'Cold'; } update accts; System.debug(LoggingLevel.ERROR, 'Updated ' + accts.size() + ' accounts');"
logLevel: "ERROR"
\`\`\`

**Important:**
- \`System.debug()\` output is only visible if debug logs are enabled for the user. Enable them first with \`salesforce_manage_debug_logs\`.
- Use \`LoggingLevel.ERROR\` to cut through log noise.
- Do NOT use HTML entities in code — write \`List<User>\` not \`List&lt;User&gt;\`.
- The tool confirms compilation and execution success even without debug logs.

---

### salesforce_read_apex

Read Apex class source code or list classes.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| className | string | No | — | Exact class name to get full source code |
| namePattern | string | No | — | Wildcard pattern to search (e.g., "*Controller*") |
| includeMetadata | boolean | No | false | Include API version, length, last modified date |
| limit | number | No | 50 | Max results when listing |
| offset | number | No | 0 | Pagination offset |

**Usage patterns:**
- \`className: "AccountController"\` → returns full source code
- \`namePattern: "*Controller*"\` → returns matching class names (no body)
- Neither → lists all class names
- \`includeMetadata: true\` → adds API version, length, last modified date

---

### salesforce_write_apex

Create or update Apex classes.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| operation | string | Yes | — | "create" or "update" |
| className | string | Yes | — | Name of the Apex class |
| body | string | Yes | — | Full Apex class source code |
| apiVersion | string | No | latest | API version (e.g., "62.0") |

**Example:**
\`\`\`
operation: "create"
className: "AccountService"
body: "public class AccountService { public static List<Account> getActiveAccounts() { return [SELECT Id, Name FROM Account WHERE IsDeleted = false LIMIT 100]; } }"
apiVersion: "62.0"
\`\`\`

**Note:** The class name in \`body\` must match \`className\`.

---

### salesforce_read_apex_trigger

Read Apex trigger source code or list triggers.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| triggerName | string | No | — | Exact trigger name to get full source code |
| namePattern | string | No | — | Wildcard pattern to search |
| includeMetadata | boolean | No | false | Include API version, object, status, last modified |
| limit | number | No | 50 | Max results when listing |
| offset | number | No | 0 | Pagination offset |

---

### salesforce_write_apex_trigger

Create or update Apex triggers.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| operation | string | Yes | — | "create" or "update" |
| triggerName | string | Yes | — | Name of the trigger |
| objectName | string | No | — | Target object (required for "create") |
| body | string | Yes | — | Full trigger source code |
| apiVersion | string | No | latest | API version (e.g., "62.0") |

**Example:**
\`\`\`
operation: "create"
triggerName: "AccountTrigger"
objectName: "Account"
body: "trigger AccountTrigger on Account (before insert, before update) { for (Account a : Trigger.new) { if (a.Name == null) { a.Name.addError('Name is required'); } } }"
\`\`\`

---

### salesforce_manage_debug_logs

Enable, disable, or retrieve debug logs for a user.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| operation | string | Yes | — | "enable", "disable", or "retrieve" |
| username | string | Yes | — | Salesforce Username (e.g., "user@company.com") — NOT the display name |
| logLevel | string | No | "DEBUG" | For enable: NONE, ERROR, WARN, INFO, DEBUG, FINE, FINER, FINEST |
| expirationTime | number | No | 30 | For enable: minutes until config expires |
| limit | number | No | 10 | For retrieve: max logs to return |
| offset | number | No | 0 | For retrieve: pagination offset |
| logId | string | No | — | For retrieve: specific log ID |
| includeBody | boolean | No | false | For retrieve: include full log content |

**Workflow — always follow this pattern:**

1. Enable logs:
\`\`\`
operation: "enable"
username: "user@example.com"
logLevel: "DEBUG"
expirationTime: 30
\`\`\`

2. Execute anonymous Apex or perform operations...

3. Retrieve logs:
\`\`\`
operation: "retrieve"
username: "user@example.com"
limit: 5
includeBody: true
\`\`\`

4. Disable when done:
\`\`\`
operation: "disable"
username: "user@example.com"
\`\`\`

**Important:** The \`username\` must be the exact Salesforce Username field value (typically an email), not the display name. Query the User object first if unsure.

---

### salesforce_list_analytics

List or search for reports and dashboards.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| type | string | Yes | — | "report" or "dashboard" |
| searchTerm | string | No | — | Filter by name. Omit to get recently viewed items. |

**Examples:**
\`\`\`
type: "report"
searchTerm: "Pipeline"
\`\`\`

\`\`\`
type: "dashboard"
searchTerm: "Executive"
\`\`\`

Returns IDs, names, folders, and formats. **Use this first** to find the ID before calling \`salesforce_describe_analytics\` or \`salesforce_run_analytics\`.

---

### salesforce_describe_analytics

Get detailed metadata for a report or dashboard.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | string | Yes | "report" or "dashboard" |
| resourceId | string | Yes | 15 or 18-character Salesforce ID |

**Example:**
\`\`\`
type: "report"
resourceId: "00Oxx000000XXXXX"
\`\`\`

**Returns for reports:** columns, groupings, filters (with available operators), aggregates, date filter settings, report format, and scope.

**Returns for dashboards:** component list with headers, visualization types, associated report IDs, filters, running user, and layout info.

**Best practice:** Describe a report before running it with filter overrides to discover the correct column API names and available filter operators.

---

### salesforce_run_analytics

Execute a report or retrieve current dashboard component data.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| type | string | Yes | — | "report" or "dashboard" |
| resourceId | string | Yes | — | 15 or 18-character Salesforce ID |
| includeDetails | boolean | No | false | Reports only — include detail rows (capped at 2,000 by API) |
| filters | object[] | No | — | Reports only — runtime filter overrides: [{column, operator, value}] |
| booleanFilter | string | No | — | Reports only — logic string (e.g., "1 AND (2 OR 3)") |
| standardDateFilter | object | No | — | Reports only — {column, durationValue, startDate?, endDate?} |
| topRows | object | No | — | Reports only — {rowLimit, direction: "Asc"/"Desc"} |

**Filter operators:** equals, notEqual, lessThan, greaterThan, lessOrEqual, greaterOrEqual, contains, notContain, startsWith, includes, excludes, within

**Examples:**

Run with saved defaults:
\`\`\`
type: "report"
resourceId: "00Oxx000000XXXXX"
\`\`\`

Run with detail rows and filters:
\`\`\`
type: "report"
resourceId: "00Oxx000000XXXXX"
includeDetails: true
filters: [
  { "column": "STAGE_NAME", "operator": "equals", "value": "Closed Won" },
  { "column": "AMOUNT", "operator": "greaterThan", "value": "10000" }
]
booleanFilter: "1 AND 2"
\`\`\`

Date-filtered report:
\`\`\`
type: "report"
resourceId: "00Oxx000000XXXXX"
standardDateFilter: { "column": "CLOSE_DATE", "durationValue": "LAST_N_DAYS:90" }
\`\`\`

Row-limited report:
\`\`\`
type: "report"
resourceId: "00Oxx000000XXXXX"
includeDetails: true
topRows: { "rowLimit": 50, "direction": "Desc" }
\`\`\`

Get dashboard data (no refresh):
\`\`\`
type: "dashboard"
resourceId: "01Zxx000000XXXXX"
\`\`\`

**Known limitations:**
- Salesforce sync report API hard limit: 2,000 detail rows.
- Some report formats don't support \`topRows\` — the tool retries without it automatically.
- Salesforce enforces 500 synchronous report executions per hour.
- Grand totals and grouping summaries are always returned in full regardless of row limits.

---

### salesforce_refresh_dashboard

Trigger a dashboard refresh or check its status.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| operation | string | Yes | "refresh" or "status" |
| dashboardId | string | Yes | 15 or 18-character dashboard ID |

**Workflow:**
1. Trigger refresh:
\`\`\`
operation: "refresh"
dashboardId: "01Zxx000000XXXXX"
\`\`\`

2. Check status:
\`\`\`
operation: "status"
dashboardId: "01Zxx000000XXXXX"
\`\`\`

3. Retrieve updated data with \`salesforce_run_analytics\`:
\`\`\`
type: "dashboard"
resourceId: "01Zxx000000XXXXX"
\`\`\`

---

### salesforce_rest_api

Direct passthrough to any Salesforce REST endpoint.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| method | string | Yes | — | "GET", "POST", "PATCH", "PUT", or "DELETE" |
| endpoint | string | Yes | — | Path relative to /services/data/vXX.0/ (e.g., "/limits") |
| body | object | No | — | Request body for POST/PATCH/PUT (serialized as JSON) |
| queryParameters | object | No | — | URL query params as key-value pairs |
| apiVersion | string | No | connection default | Override API version (e.g., "62.0") |
| rawPath | boolean | No | false | Treat endpoint as a full path from instance root |

**Examples:**

Org limits:
\`\`\`
method: "GET"
endpoint: "/limits"
\`\`\`

Tooling API query:
\`\`\`
method: "GET"
endpoint: "/tooling/query"
queryParameters: { "q": "SELECT Id, Name FROM ApexClass WHERE Name LIKE '%Controller%'" }
\`\`\`

Composite batch:
\`\`\`
method: "POST"
endpoint: "/composite"
body: {
  "allOrNone": true,
  "compositeRequest": [
    { "method": "POST", "url": "/services/data/v62.0/sobjects/Account", "body": { "Name": "New Account" }, "referenceId": "newAccount" },
    { "method": "POST", "url": "/services/data/v62.0/sobjects/Contact", "body": { "LastName": "Smith", "AccountId": "@{newAccount.id}" }, "referenceId": "newContact" }
  ]
}
\`\`\`

Custom Apex REST endpoint:
\`\`\`
method: "GET"
endpoint: "/services/apexrest/MyEndpoint"
rawPath: true
\`\`\`

---

## Common Patterns and Recipes

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
This works because the WHERE clause reduces the grouping to a single row. Also works with \`IsClosed\` for Opportunities, Cases, etc.

**Option 2 — Anonymous Apex (requires debug logs):**
\`\`\`
Tool: salesforce_execute_anonymous
apexCode: "System.debug(LoggingLevel.ERROR, 'Count: ' + [SELECT COUNT() FROM Account]);"
logLevel: "ERROR"
\`\`\`

### Pipeline by rep (aggregate with name resolution)

Step 1 — Aggregate by OwnerId:
\`\`\`
Tool: salesforce_aggregate_query
objectName: "Opportunity"
selectFields: ["OwnerId", "COUNT(Id) OppCount", "SUM(Amount) TotalAmount"]
groupByFields: ["OwnerId"]
orderBy: "SUM(Amount) DESC"
\`\`\`

Step 2 — Resolve Ids to names:
\`\`\`
Tool: salesforce_query_records
objectName: "User"
fields: ["Id", "Name"]
whereClause: "Id IN ('005xx...', '005xx...')"
\`\`\`

### Reports workflow

1. **Find** the report: \`salesforce_list_analytics\` with \`searchTerm\`
2. **Inspect** its structure: \`salesforce_describe_analytics\` to see columns and filter operators
3. **Run** with overrides: \`salesforce_run_analytics\` with filters, date filters, or detail rows

### Dashboard workflow

1. **Find** the dashboard: \`salesforce_list_analytics\` with \`type: "dashboard"\`
2. **Refresh** if needed: \`salesforce_refresh_dashboard\` with \`operation: "refresh"\`
3. **Check** status: \`salesforce_refresh_dashboard\` with \`operation: "status"\`
4. **Retrieve** data: \`salesforce_run_analytics\` with \`type: "dashboard"\`

---

## Known Bugs and Gotchas

1. **Relationship fields return null in aggregate queries.** Grouping by \`Account.Name\` or \`Owner.Name\` in \`salesforce_aggregate_query\` returns null for those fields. Group by the Id field instead and resolve names separately.

2. **\`salesforce_manage_field_permissions\` view operation is broken.** Returns a SOQL error (\`No such column 'PermissionSetId'\`). Grant and revoke work. This is an upstream bug.

3. **Picklist values from \`describe_object\` may not match actual data.** The describe returns configured picklist options from Setup, but records may contain values from imports, integrations, or removed options. Always verify with a GROUP BY query if a filter returns 0 records unexpectedly.

4. **\`salesforce_aggregate_query\` cannot do ungrouped aggregates.** \`SELECT COUNT() FROM Account\` (no GROUP BY) is not supported — \`groupByFields\` must have at least one field. Workaround: group by \`IsDeleted\` with \`whereClause: "IsDeleted = false"\`.

5. **Large result sets overflow to a file.** Responses over ~80KB are saved to a temp file. This affects \`query_records\` (at ~2,000 records) and \`read_apex\` (listing all classes on a large org). Set explicit limits or use narrower patterns.

6. **\`execute_anonymous\` output requires debug logs.** The tool confirms success/failure but \`System.debug()\` output is only visible if debug logs are enabled for the running user via \`manage_debug_logs\`.

7. **Debug log \`username\` must be the Salesforce Username, not the display name.** For example, \`user@company.com\` works but \`Jane Smith\` does not. Query the User object first if you don't know the username.

---

## General Best Practices

1. **Describe before querying.** If unsure of field names, run \`salesforce_describe_object\` first. Custom fields end in \`__c\`, custom relationships end in \`__r\`.

2. **Set explicit limits.** The default query limit is 200 records. For large objects, always set a limit to avoid oversized responses.

3. **Use \`salesforce_search_objects\` to find object API names.** Don't guess — search for the object first if you're not sure of the exact name.

4. **Prefer the specific tool over anonymous Apex.** Use \`salesforce_query_records\` for queries, \`salesforce_dml_records\` for data changes, etc. Fall back to \`salesforce_execute_anonymous\` only when dedicated tools can't handle the operation.

5. **Enable debug logs before running anonymous Apex that uses System.debug().** Without them, you'll get "No logs available" and lose all output.

6. **Be cautious with DML operations.** These modify production data. Confirm the operation with the user before executing inserts, updates, or deletes.

7. **Use the reports workflow for pre-built analytics.** If a Salesforce report already exists for the data the user wants, use the \`list_analytics\` → \`describe_analytics\` → \`run_analytics\` workflow instead of building SOQL from scratch. It's faster and respects the report's existing filters and security.

8. **Describe reports before running with filters.** Filter column names and operators are specific to the report definition. Use \`salesforce_describe_analytics\` first to discover the correct column API names and available operators.

9. **Use \`salesforce_rest_api\` as a last resort.** Dedicated tools have better error handling and response formatting. Use the REST passthrough only for endpoints without a dedicated tool (e.g., Composite API, Files, Limits, Tooling API).
`;
