import type { LibraryDocSummary } from "./library";

export type QueryOp = "eq" | "gt" | "lt" | "gte" | "lte";

export type QueryTerm = {
  field: string | null; // null = bare term, matched against name/tags
  op: QueryOp;
  value: string;
  negated: boolean;
};

/** Groups are OR'd; terms within a group are AND'd. A leading `-` negates a term, and
 * quoted phrases are kept as a single term. */
export type ParsedQuery = QueryTerm[][];

const FIELD_TERM_RE = /^(-)?([A-Za-z]+)(:|>=|<=|>|<)(.+)$/;

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) {
    tokens.push(m[1] !== undefined ? `"${m[1]}"` : m[2]);
  }
  return tokens;
}

function stripQuotes(s: string): string {
  return s.length >= 2 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
}

function parseTerm(token: string): QueryTerm {
  const fieldMatch = FIELD_TERM_RE.exec(token);
  if (fieldMatch) {
    const [, neg, field, opRaw, rawValue] = fieldMatch;
    const op: QueryOp = opRaw === ">" ? "gt" : opRaw === "<" ? "lt" : opRaw === ">=" ? "gte" : opRaw === "<=" ? "lte" : "eq";
    return { field: field.toLowerCase(), op, value: stripQuotes(rawValue), negated: Boolean(neg) };
  }
  const negated = token.startsWith("-") && token.length > 1;
  const bare = negated ? token.slice(1) : token;
  return { field: null, op: "eq", value: stripQuotes(bare), negated };
}

/** Parses a query string like `tag:invoice pages>10 OR name:"annual report" -tag:draft` into
 * OR-of-AND term groups. "AND" is accepted as a no-op keyword for readability (terms are
 * AND'd by default); "OR" starts a new group. Both are case-insensitive. */
export function parseQuery(input: string): ParsedQuery {
  const tokens = tokenize(input.trim());
  const groups: QueryTerm[][] = [[]];
  for (const tok of tokens) {
    const upper = tok.toUpperCase();
    if (upper === "OR") {
      groups.push([]);
      continue;
    }
    if (upper === "AND") continue;
    groups[groups.length - 1].push(parseTerm(tok));
  }
  return groups.filter((g) => g.length > 0);
}

export function isAdvancedQuery(input: string): boolean {
  return /[:<>]|\bOR\b/i.test(input) || input.trim().startsWith("-");
}

const SIZE_UNITS: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };

function parseSizeValue(value: string): number | null {
  const m = /^([\d.]+)\s*(b|kb|mb|gb)?$/i.exec(value.trim());
  if (!m) return null;
  const num = parseFloat(m[1]);
  const unit = (m[2] ?? "b").toLowerCase();
  return num * (SIZE_UNITS[unit] ?? 1);
}

function parseDateValue(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function compare(op: QueryOp, actual: number, target: number): boolean {
  switch (op) {
    case "gt":
      return actual > target;
    case "lt":
      return actual < target;
    case "gte":
      return actual >= target;
    case "lte":
      return actual <= target;
    case "eq":
      return actual === target;
  }
}

function evaluateTerm(doc: LibraryDocSummary, term: QueryTerm, contentMatchDocIds: Map<string, Set<string>>): boolean {
  let result: boolean;
  const value = term.value.toLowerCase();

  switch (term.field) {
    case null:
      result =
        doc.name.toLowerCase().includes(value) || doc.tags.some((t) => t.toLowerCase().includes(value));
      break;
    case "name":
    case "title":
      result = doc.name.toLowerCase().includes(value);
      break;
    case "tag":
      result = doc.tags.some((t) => t.toLowerCase().includes(value));
      break;
    case "favorite":
    case "starred":
      result = doc.favorite === (value !== "false" && value !== "0");
      break;
    case "pages":
    case "pagecount": {
      const target = Number(term.value);
      result = !Number.isNaN(target) && compare(term.op, doc.pageCount, target);
      break;
    }
    case "size": {
      const target = parseSizeValue(term.value);
      result = target !== null && compare(term.op, doc.sizeBytes, target);
      break;
    }
    case "date":
    case "created": {
      const target = parseDateValue(term.value);
      result = target !== null && compare(term.op, doc.createdAt, target);
      break;
    }
    case "opened":
    case "modified": {
      const target = parseDateValue(term.value);
      result = target !== null && compare(term.op, doc.lastOpenedAt, target);
      break;
    }
    case "content": {
      const ids = contentMatchDocIds.get(term.value);
      result = ids ? ids.has(doc.id) : false;
      break;
    }
    default:
      result = doc.name.toLowerCase().includes(value) || doc.tags.some((t) => t.toLowerCase().includes(value));
  }

  return term.negated ? !result : result;
}

/** Every distinct `content:` value used anywhere in the query. */
export function collectContentTerms(query: ParsedQuery): string[] {
  const values = new Set<string>();
  for (const group of query) {
    for (const term of group) {
      if (term.field === "content") values.add(term.value);
    }
  }
  return Array.from(values);
}

export function evaluateQuery(
  doc: LibraryDocSummary,
  query: ParsedQuery,
  contentMatchDocIds: Map<string, Set<string>> = new Map()
): boolean {
  if (query.length === 0) return true;
  return query.some((group) => group.every((term) => evaluateTerm(doc, term, contentMatchDocIds)));
}
