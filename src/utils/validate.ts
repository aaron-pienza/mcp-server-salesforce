/**
 * Runtime type assertion helpers for MCP tool argument validation.
 * Replaces unsafe TypeScript `as` casts with actual runtime checks.
 */

export function assertString(value: unknown, name: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${name} must be a string, got ${typeof value}`);
  }
  return value;
}

export function assertOptionalString(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return assertString(value, name);
}

export function assertNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error(`${name} must be a number, got ${typeof value}`);
  }
  return value;
}

export function assertOptionalNumber(value: unknown, name: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  return assertNumber(value, name);
}

export function assertBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${name} must be a boolean, got ${typeof value}`);
  }
  return value;
}

export function assertOptionalBoolean(value: unknown, name: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  return assertBoolean(value, name);
}

export function assertStringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array, got ${typeof value}`);
  }
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== 'string') {
      throw new Error(`${name}[${i}] must be a string, got ${typeof value[i]}`);
    }
  }
  return value as string[];
}

export function assertEnum<T extends string>(
  value: unknown,
  name: string,
  allowed: readonly T[]
): T {
  const str = assertString(value, name);
  if (!allowed.includes(str as T)) {
    throw new Error(`${name} must be one of: ${allowed.join(', ')}. Got "${str}"`);
  }
  return str as T;
}

export function assertOptionalEnum<T extends string>(
  value: unknown,
  name: string,
  allowed: readonly T[]
): T | undefined {
  if (value === undefined || value === null) return undefined;
  return assertEnum(value, name, allowed);
}

export function assertPlainObject(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function assertOptionalPlainObject(
  value: unknown,
  name: string,
): Record<string, unknown> | undefined {
  if (value === undefined || value === null) return undefined;
  return assertPlainObject(value, name);
}

export function assertOptionalQueryStringRecord(
  value: unknown,
  name: string,
): Record<string, string> | undefined {
  if (value === undefined || value === null) return undefined;
  const o = assertPlainObject(value, name);
  const out: Record<string, string> = {};
  for (const key of Object.keys(o)) {
    out[key] = assertString(o[key], `${name}.${key}`);
  }
  return out;
}

export function assertRecordArray(value: unknown, name: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }
  return value.map((item, i) => assertPlainObject(item, `${name}[${i}]`));
}

const SEARCH_IN_VALUES = [
  'ALL FIELDS',
  'NAME FIELDS',
  'EMAIL FIELDS',
  'PHONE FIELDS',
  'SIDEBAR FIELDS',
] as const;

const SOSL_WITH_TYPES = [
  'DATA CATEGORY',
  'DIVISION',
  'METADATA',
  'NETWORK',
  'PRICEBOOKID',
  'SNIPPET',
  'SECURITY_ENFORCED',
] as const;

export type ParsedWithClause = {
  type: (typeof SOSL_WITH_TYPES)[number];
  value?: string;
  fields?: string[];
};

export function assertOptionalSearchIn(
  value: unknown,
  name: string,
): (typeof SEARCH_IN_VALUES)[number] | undefined {
  return assertOptionalEnum(value, name, SEARCH_IN_VALUES);
}

export function assertOptionalWithClauses(value: unknown, name: string): ParsedWithClause[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }
  return value.map((item, i) => {
    const o = assertPlainObject(item, `${name}[${i}]`);
    const type = assertEnum(o.type, `${name}[${i}].type`, SOSL_WITH_TYPES);
    const out: ParsedWithClause = { type };
    if (o.value !== undefined && o.value !== null) {
      out.value = assertString(o.value, `${name}[${i}].value`);
    }
    if (o.fields !== undefined && o.fields !== null) {
      out.fields = assertStringArray(o.fields, `${name}[${i}].fields`);
    }
    return out;
  });
}

export function assertSearchAllObjectSpecs(
  value: unknown,
  name: string,
): Array<{
  name: string;
  fields: string[];
  where?: string;
  orderBy?: string;
  limit?: number;
}> {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }
  return value.map((item, i) => {
    const o = assertPlainObject(item, `${name}[${i}]`);
    return {
      name: assertString(o.name, `${name}[${i}].name`),
      fields: assertStringArray(o.fields, `${name}[${i}].fields`),
      where: assertOptionalString(o.where, `${name}[${i}].where`),
      orderBy: assertOptionalString(o.orderBy, `${name}[${i}].orderBy`),
      limit: assertOptionalNumber(o.limit, `${name}[${i}].limit`),
    };
  });
}

const LOG_LEVELS = [
  'NONE',
  'ERROR',
  'WARN',
  'INFO',
  'DEBUG',
  'FINE',
  'FINER',
  'FINEST',
] as const;

export type SalesforceLogLevel = (typeof LOG_LEVELS)[number];

export function assertOptionalLogLevel(value: unknown, name: string): SalesforceLogLevel | undefined {
  return assertOptionalEnum(value, name, LOG_LEVELS);
}

export function assertLogLevel(value: unknown, name: string): SalesforceLogLevel {
  return assertEnum(value, name, LOG_LEVELS);
}

export function assertOptionalStringArray(value: unknown, name: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  return assertStringArray(value, name);
}

const REPORT_FILTER_OPERATORS = [
  'equals',
  'notEqual',
  'lessThan',
  'greaterThan',
  'lessOrEqual',
  'greaterOrEqual',
  'contains',
  'notContain',
  'startsWith',
  'includes',
  'excludes',
  'within',
] as const;

export type ParsedReportFilter = {
  column: string;
  operator: (typeof REPORT_FILTER_OPERATORS)[number];
  value: string;
};

export function assertOptionalReportFilters(
  value: unknown,
  name: string,
): ParsedReportFilter[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }
  return value.map((item, i) => {
    const o = assertPlainObject(item, `${name}[${i}]`);
    return {
      column: assertString(o.column, `${name}[${i}].column`),
      operator: assertEnum(o.operator, `${name}[${i}].operator`, REPORT_FILTER_OPERATORS),
      value: assertString(o.value, `${name}[${i}].value`),
    };
  });
}

export type ParsedStandardDateFilter = {
  column: string;
  durationValue: string;
  startDate?: string;
  endDate?: string;
};

export function assertOptionalStandardDateFilter(
  value: unknown,
  name: string,
): ParsedStandardDateFilter | undefined {
  if (value === undefined || value === null) return undefined;
  const o = assertPlainObject(value, name);
  return {
    column: assertString(o.column, `${name}.column`),
    durationValue: assertString(o.durationValue, `${name}.durationValue`),
    startDate: assertOptionalString(o.startDate, `${name}.startDate`),
    endDate: assertOptionalString(o.endDate, `${name}.endDate`),
  };
}

export type ParsedTopRows = {
  rowLimit: number;
  direction: 'Asc' | 'Desc';
};

export function assertOptionalTopRows(value: unknown, name: string): ParsedTopRows | undefined {
  if (value === undefined || value === null) return undefined;
  const o = assertPlainObject(value, name);
  return {
    rowLimit: assertNumber(o.rowLimit, `${name}.rowLimit`),
    direction: assertEnum(o.direction, `${name}.direction`, ['Asc', 'Desc'] as const),
  };
}

export function assertOptionalPicklistValues(
  value: unknown,
  name: string,
): Array<{ label: string; isDefault?: boolean }> | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }
  return value.map((item, i) => {
    const o = assertPlainObject(item, `${name}[${i}]`);
    return {
      label: assertString(o.label, `${name}[${i}].label`),
      isDefault: assertOptionalBoolean(o.isDefault, `${name}[${i}].isDefault`),
    };
  });
}
