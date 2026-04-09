/**
 * SOQL/SOSL escaping and identifier validation utilities.
 *
 * Salesforce uses doubled single quotes for string escaping in SOQL ('' not \').
 * SOSL has its own reserved characters that need backslash-escaping inside FIND {}.
 */

/**
 * Escapes a string value for safe use inside a SOQL string literal.
 * SOQL escapes single quotes by doubling them: ' -> ''
 */
export function escapeSoqlValue(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Escapes a search term for safe use inside SOSL FIND { ... } clause.
 * SOSL reserved characters need backslash-escaping.
 */
export function escapeSoslSearchTerm(value: string): string {
  return value.replace(/[\\?&|!{}[\]()^~*:"'+\-]/g, '\\$&');
}

/**
 * Validates a single Salesforce identifier (object name, field name, class name, etc.).
 * Accepts: Account, My_Object__c, ns__Field__r, Custom__e
 */
export function validateIdentifier(name: string): { valid: boolean; error?: string } {
  if (name.length > 80) {
    return {
      valid: false,
      error: `Identifier "${name}" exceeds maximum length of 80 characters.`
    };
  }
  // Allow standard Salesforce identifier pattern with optional namespace prefix and suffix
  const pattern = /^[a-zA-Z][a-zA-Z0-9_]{0,38}(__[a-zA-Z0-9]+)?$/;
  if (!pattern.test(name)) {
    return {
      valid: false,
      error: `Invalid identifier "${name}". Salesforce identifiers must start with a letter, contain only letters/numbers/underscores, and be at most 40 characters.`
    };
  }
  return { valid: true };
}

/**
 * Validates a dotted field path like "Account.Name" or "Custom__r.Field__c".
 * Each segment must be a valid identifier.
 */
export function validateFieldPath(path: string): { valid: boolean; error?: string } {
  const segments = path.split('.');
  for (const segment of segments) {
    const result = validateIdentifier(segment);
    if (!result.valid) {
      return { valid: false, error: `Invalid field path "${path}": ${result.error}` };
    }
  }
  return { valid: true };
}

/**
 * Escapes regex metacharacters in a string for safe use in new RegExp().
 */
export function escapeRegExpInput(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Converts a user-facing wildcard pattern to a SOQL LIKE pattern.
 * Escapes existing LIKE metacharacters (% and _) before converting wildcards.
 *
 * @param pattern - User input with * (any chars) and ? (single char) wildcards
 * @returns SOQL LIKE-compatible pattern
 */
export function wildcardToLikePattern(pattern: string): string {
  // First escape existing LIKE metacharacters
  let escaped = pattern.replace(/%/g, '\\%').replace(/_/g, '\\_');

  if (!pattern.includes('*') && !pattern.includes('?')) {
    // No wildcards — wrap with % for substring match
    return `%${escaped}%`;
  }

  // Convert user wildcards to LIKE wildcards
  escaped = escaped.replace(/\*/g, '%').replace(/\?/g, '_');
  return escaped;
}

const MAX_SOQL_FRAGMENT_LEN = 10_000

/**
 * Rejects patterns that could break out of SOQL/SOSL field positions or inject clauses.
 */
export function validateSafeSoqlFragment(value: string): { valid: boolean; error?: string } {
  if (value.length > MAX_SOQL_FRAGMENT_LEN) {
    return {
      valid: false,
      error: `Value exceeds maximum length of ${MAX_SOQL_FRAGMENT_LEN} characters.`,
    }
  }
  if (/[\n\r]/.test(value)) {
    return { valid: false, error: 'Newlines are not allowed in this value.' }
  }
  if (/[{}]/.test(value)) {
    return { valid: false, error: 'Braces { } are not allowed in this value.' }
  }
  if (/\bRETURNING\b/i.test(value) || /\bFIND\b/i.test(value)) {
    return { valid: false, error: 'Value contains reserved SOSL keywords (FIND/RETURNING).' }
  }
  if (/;|--/.test(value)) {
    return { valid: false, error: 'Semicolons and SQL-style comments are not allowed in this value.' }
  }
  return { valid: true }
}

const MAX_SOSL_WITH_VALUE_LEN = 2_000

/**
 * Validates user-supplied WITH clause values (SOSL), after trimming.
 */
export function validateSoslWithClauseValue(
  value: string | undefined,
  required: boolean,
): { valid: boolean; error?: string } {
  if (value === undefined || value === '') {
    if (required) {
      return { valid: false, error: 'WITH clause value is required for this clause type.' }
    }
    return { valid: true }
  }
  const v = value.trim()
  if (v.length > MAX_SOSL_WITH_VALUE_LEN) {
    return {
      valid: false,
      error: `WITH clause value exceeds maximum length of ${MAX_SOSL_WITH_VALUE_LEN} characters.`,
    }
  }
  return validateSafeSoqlFragment(v)
}

/**
 * Validates a single field/expression token for salesforce_query_records SELECT list.
 */
export function validateQueryFieldToken(field: string): { valid: boolean; error?: string } {
  const f = field.trim()
  if (!f) {
    return { valid: false, error: 'Field name cannot be empty.' }
  }
  const safe = validateSafeSoqlFragment(f)
  if (!safe.valid) {
    return safe
  }
  if (/\bSELECT\b/i.test(f) && /\bFROM\b/i.test(f) && !/^\s*\(/i.test(f)) {
    return {
      valid: false,
      error: `Invalid subquery format: "${field}". Child relationship queries should be wrapped in parentheses (e.g., "(SELECT Id FROM Contacts)").`,
    }
  }
  if (/^\(\s*SELECT\b/i.test(f)) {
    if (!f.endsWith(')')) {
      return {
        valid: false,
        error: `Invalid subquery format: "${field}". Child relationship queries must be wrapped in parentheses.`,
      }
    }
    return { valid: true }
  }
  if (f.includes('(')) {
    return { valid: true }
  }
  if (f.includes('.')) {
    return validateFieldPath(f)
  }
  return validateIdentifier(f)
}

/**
 * Validates select/group tokens for salesforce_aggregate_query (identifiers, paths, or function expressions).
 */
export function validateAggregateFieldToken(field: string): { valid: boolean; error?: string } {
  const f = field.trim()
  if (!f) {
    return { valid: false, error: 'Field or expression cannot be empty.' }
  }
  const safe = validateSafeSoqlFragment(f)
  if (!safe.valid) {
    return safe
  }
  if (f.includes('(')) {
    return { valid: true }
  }
  if (f.includes('.')) {
    return validateFieldPath(f)
  }
  return validateIdentifier(f)
}

/** Salesforce record Id (15 or 18 alphanumeric). */
export function isValidSalesforceId(id: string): boolean {
  return /^[a-zA-Z0-9]{15}$|^[a-zA-Z0-9]{18}$/.test(id)
}
