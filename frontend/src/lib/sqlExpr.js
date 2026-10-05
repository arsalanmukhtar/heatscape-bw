/*
  Expression engine for queries, rule-based styles and label text (Symbology).
  A safe subset of SQL, parsed to an AST and evaluated per feature in the browser:
    comparisons  = <> != < > <= >=        logic   AND OR NOT ( )
    sets/ranges  IN (…)  BETWEEN a AND b  patterns LIKE / ILIKE ('%' any run, '_' one char)
    nulls        IS [NOT] NULL            text     || (concat), '\n' for a line break
    arithmetic   + - * /                  functions upper lower round(x[, n]) abs length
                                                    concat(…) coalesce(…) substr(s, start[, len]) trim
  Fields are bare names (sealing) or double-quoted ("heatClass"); strings use single quotes.
  Errors carry the 1-based column where they were found. The same SQL can later go to
  PostGIS as a parameterised WHERE clause; nothing here builds SQL for the database.
*/
const KEYWORDS = new Set(['AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'ILIKE', 'IS', 'NULL', 'TRUE', 'FALSE']);
const FUNCTIONS = { upper: [1, 1], lower: [1, 1], round: [1, 2], abs: [1, 1], length: [1, 1], concat: [1, 20], coalesce: [1, 20], substr: [2, 3], trim: [1, 1] };
export const FUNCTION_NAMES = Object.keys(FUNCTIONS);

export class ExprError extends Error {
  constructor(message, pos) {
    super(message);
    this.pos = pos;
  }
}

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const start = i;
    if (/\d/.test(c) || (c === '.' && /\d/.test(src[i + 1]))) {
      while (i < src.length && /[\d.]/.test(src[i])) i++;
      tokens.push({ k: 'num', v: Number(src.slice(start, i)), pos: start });
    } else if (c === "'") {
      let v = '';
      i++;
      for (;;) {
        if (i >= src.length) throw new ExprError('Unclosed text (missing \')', start + 1);
        if (src[i] === "'" && src[i + 1] === "'") {
          v += "'";
          i += 2;
        } else if (src[i] === "'") {
          i++;
          break;
        } else if (src[i] === '\\' && src[i + 1] === 'n') {
          v += '\n';
          i += 2;
        } else v += src[i++];
      }
      tokens.push({ k: 'str', v, pos: start });
    } else if (c === '"') {
      const end = src.indexOf('"', i + 1);
      if (end < 0) throw new ExprError('Unclosed field name (missing ")', start + 1);
      tokens.push({ k: 'id', v: src.slice(i + 1, end), quoted: true, pos: start });
      i = end + 1;
    } else if (/[A-Za-z_]/.test(c)) {
      while (i < src.length && /\w/.test(src[i])) i++;
      const word = src.slice(start, i);
      tokens.push(KEYWORDS.has(word.toUpperCase()) ? { k: 'kw', v: word.toUpperCase(), pos: start } : { k: 'id', v: word, pos: start });
    } else {
      const two = src.slice(i, i + 2);
      if (['<>', '!=', '<=', '>=', '||'].includes(two)) {
        tokens.push({ k: 'op', v: two === '!=' ? '<>' : two, pos: start });
        i += 2;
      } else if ('=<>+-*/(),'.includes(c)) {
        tokens.push({ k: 'op', v: c, pos: start });
        i++;
      } else throw new ExprError(`Unexpected character "${c}"`, start + 1);
    }
  }
  tokens.push({ k: 'end', v: '', pos: src.length });
  return tokens;
}

/** Parses an expression. fields: known field keys (unknown names are reported). */
export function parse(src, fields) {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isKw = (v) => peek().k === 'kw' && peek().v === v;
  const isOp = (v) => peek().k === 'op' && peek().v === v;
  const fail = (msg) => {
    const t = peek();
    throw new ExprError(t.k === 'end' ? `${msg} at the end` : `${msg} near "${src.slice(t.pos, t.pos + 12)}"`, t.pos + 1);
  };
  const expectOp = (v) => (isOp(v) ? p++ : fail(`Expected "${v}"`));

  function primary() {
    const t = peek();
    if (t.k === 'num' || t.k === 'str') {
      p++;
      return { t: t.k, v: t.v };
    }
    if (t.k === 'kw' && (t.v === 'TRUE' || t.v === 'FALSE')) {
      p++;
      return { t: 'bool', v: t.v === 'TRUE' };
    }
    if (t.k === 'kw' && t.v === 'NULL') {
      p++;
      return { t: 'null' };
    }
    if (isOp('(')) {
      p++;
      const e = or();
      expectOp(')');
      return e;
    }
    if (t.k === 'id') {
      p++;
      if (!t.quoted && isOp('(')) {
        const fn = t.v.toLowerCase();
        if (!FUNCTIONS[fn]) throw new ExprError(`Unknown function "${t.v}"`, t.pos + 1);
        p++;
        const args = [];
        if (!isOp(')')) {
          args.push(or());
          while (isOp(',')) {
            p++;
            args.push(or());
          }
        }
        expectOp(')');
        const [min, max] = FUNCTIONS[fn];
        if (args.length < min || args.length > max) throw new ExprError(`${fn}() takes ${min === max ? min : `${min}–${max}`} argument${max > 1 ? 's' : ''}`, t.pos + 1);
        return { t: 'call', fn, args };
      }
      if (fields && !fields.includes(t.v)) throw new ExprError(`Unknown field "${t.v}"`, t.pos + 1);
      return { t: 'field', name: t.v };
    }
    return fail('Expected a value or field');
  }
  function unary() {
    if (isOp('-')) {
      p++;
      return { t: 'neg', a: unary() };
    }
    return primary();
  }
  function term() {
    let a = unary();
    while (isOp('*') || isOp('/')) {
      const op = toks[p++].v;
      a = { t: 'bin', op, a, b: unary() };
    }
    return a;
  }
  function additive() {
    let a = term();
    while (isOp('+') || isOp('-')) {
      const op = toks[p++].v;
      a = { t: 'bin', op, a, b: term() };
    }
    return a;
  }
  function concat() {
    let a = additive();
    while (isOp('||')) {
      p++;
      a = { t: 'bin', op: '||', a, b: additive() };
    }
    return a;
  }
  function predicate() {
    const a = concat();
    if (peek().k === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(peek().v)) {
      const op = toks[p++].v;
      return { t: 'bin', op, a, b: concat() };
    }
    if (isKw('IS')) {
      p++;
      const neg = isKw('NOT') ? (p++, true) : false;
      if (!isKw('NULL')) fail('Expected NULL');
      p++;
      return { t: 'isnull', a, neg };
    }
    const neg = isKw('NOT') ? (p++, true) : false;
    if (isKw('IN')) {
      p++;
      expectOp('(');
      const list = [concat()];
      while (isOp(',')) {
        p++;
        list.push(concat());
      }
      expectOp(')');
      return { t: 'in', a, list, neg };
    }
    if (isKw('BETWEEN')) {
      p++;
      const lo = concat();
      if (!isKw('AND')) fail('Expected AND in BETWEEN');
      p++;
      return { t: 'between', a, lo, hi: concat(), neg };
    }
    if (isKw('LIKE') || isKw('ILIKE')) {
      const ci = toks[p++].v === 'ILIKE';
      return { t: 'like', a, pat: concat(), neg, ci };
    }
    if (neg) fail('Expected IN, BETWEEN or LIKE after NOT');
    return a;
  }
  function not() {
    if (isKw('NOT')) {
      p++;
      return { t: 'not', a: not() };
    }
    return predicate();
  }
  function and() {
    let a = not();
    while (isKw('AND')) {
      p++;
      a = { t: 'and', a, b: not() };
    }
    return a;
  }
  function or() {
    let a = and();
    while (isKw('OR')) {
      p++;
      a = { t: 'or', a, b: and() };
    }
    return a;
  }

  if (peek().k === 'end') throw new ExprError('Empty expression', 1);
  const ast = or();
  if (peek().k !== 'end') fail('Unexpected');
  return ast;
}

const likeCache = new Map();
function likeRegex(pattern, ci) {
  const key = `${ci ? 'i' : 's'}${pattern}`;
  if (!likeCache.has(key)) {
    const body = String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
    likeCache.set(key, new RegExp(`^${body}$`, ci ? 'is' : 's'));
  }
  return likeCache.get(key);
}

const cmp = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true }));
const isNull = (v) => v === null || v === undefined || v === '';

/** Value of an expression for one feature's properties (SQL-like: comparisons with NULL are false). */
export function evaluate(n, row) {
  switch (n.t) {
    case 'num':
    case 'str':
    case 'bool':
      return n.v;
    case 'null':
      return null;
    case 'field': {
      const v = row[n.name];
      return v === undefined ? null : v;
    }
    case 'neg':
      return -Number(evaluate(n.a, row));
    case 'not':
      return !evaluate(n.a, row);
    case 'and':
      return !!evaluate(n.a, row) && !!evaluate(n.b, row);
    case 'or':
      return !!evaluate(n.a, row) || !!evaluate(n.b, row);
    case 'isnull':
      return isNull(evaluate(n.a, row)) !== n.neg;
    case 'in': {
      const v = evaluate(n.a, row);
      if (isNull(v)) return false;
      return n.list.some((x) => cmp(v, evaluate(x, row)) === 0) !== n.neg;
    }
    case 'between': {
      const v = evaluate(n.a, row);
      if (isNull(v)) return false;
      return (cmp(v, evaluate(n.lo, row)) >= 0 && cmp(v, evaluate(n.hi, row)) <= 0) !== n.neg;
    }
    case 'like': {
      const v = evaluate(n.a, row);
      if (isNull(v)) return false;
      return likeRegex(evaluate(n.pat, row), n.ci).test(String(v)) !== n.neg;
    }
    case 'bin': {
      const a = evaluate(n.a, row);
      const b = evaluate(n.b, row);
      if (n.op === '||') return `${a ?? ''}${b ?? ''}`;
      if (['+', '-', '*', '/'].includes(n.op)) {
        if (isNull(a) || isNull(b)) return null;
        const x = Number(a);
        const y = Number(b);
        return n.op === '+' ? x + y : n.op === '-' ? x - y : n.op === '*' ? x * y : y === 0 ? null : x / y;
      }
      if (isNull(a) || isNull(b)) return false;
      const c = cmp(a, b);
      return n.op === '=' ? c === 0 : n.op === '<>' ? c !== 0 : n.op === '<' ? c < 0 : n.op === '>' ? c > 0 : n.op === '<=' ? c <= 0 : c >= 0;
    }
    case 'call': {
      const args = n.args.map((x) => evaluate(x, row));
      const [a, b, c] = args;
      switch (n.fn) {
        case 'upper':
          return isNull(a) ? null : String(a).toUpperCase();
        case 'lower':
          return isNull(a) ? null : String(a).toLowerCase();
        case 'round': {
          if (isNull(a)) return null;
          const k = 10 ** (b ?? 0);
          return Math.round(Number(a) * k) / k;
        }
        case 'abs':
          return isNull(a) ? null : Math.abs(Number(a));
        case 'length':
          return isNull(a) ? 0 : String(a).length;
        case 'concat':
          return args.map((x) => x ?? '').join('');
        case 'coalesce':
          return args.find((x) => !isNull(x)) ?? null;
        case 'substr':
          return isNull(a) ? null : String(a).substr(Math.max(0, Number(b) - 1), c ?? undefined);
        case 'trim':
          return isNull(a) ? null : String(a).trim();
        default:
          return null;
      }
    }
    default:
      return null;
  }
}

/** { ast } or { error, pos } without throwing; an empty string is valid and means "no expression". */
export function check(src, fields) {
  if (!src?.trim()) return { ast: null };
  try {
    return { ast: parse(src, fields) };
  } catch (e) {
    return { error: e.message, pos: e.pos ?? 1 };
  }
}

const astCache = new Map();
/** Cached parse for render paths (null when empty or invalid). */
export function compiled(src, fields) {
  const key = `${fields?.join(',') ?? '*'}|${src}`;
  if (!astCache.has(key)) {
    if (astCache.size > 500) astCache.clear();
    astCache.set(key, check(src, fields).ast ?? null);
  }
  return astCache.get(key);
}

/* ----------------------------------------------------------------------------------
   Query builder ↔ SQL. A builder is { combinator: 'AND' | 'OR', conditions: [{ field,
   op, value, value2 }] }. ops: eq ne lt le gt ge contains starts in between null notnull.
   Only flat AND/OR lists of these round-trip; anything richer stays SQL-only.
   ---------------------------------------------------------------------------------- */
export const BUILDER_OPS = ['eq', 'ne', 'lt', 'le', 'gt', 'ge', 'contains', 'starts', 'in', 'between', 'null', 'notnull'];
const SYMBOL = { eq: '=', ne: '<>', lt: '<', le: '<=', gt: '>', ge: '>=' };
const quoteId = (f) => (/^[A-Za-z_]\w*$/.test(f) && !KEYWORDS.has(f.toUpperCase()) ? f : `"${f}"`);
const quoteVal = (v, numeric) => (numeric && v !== '' && Number.isFinite(Number(v)) ? String(Number(v)) : `'${String(v).replace(/'/g, "''")}'`);

export function builderToSql({ combinator, conditions }, numericFields = []) {
  const parts = conditions
    .filter((c) => c.field && (c.op === 'null' || c.op === 'notnull' || String(c.value ?? '').trim() !== ''))
    .map((c) => {
      const f = quoteId(c.field);
      const num = numericFields.includes(c.field);
      switch (c.op) {
        case 'contains':
          return `${f} ILIKE ${quoteVal(`%${c.value}%`, false)}`;
        case 'starts':
          return `${f} ILIKE ${quoteVal(`${c.value}%`, false)}`;
        case 'in':
          return `${f} IN (${String(c.value)
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
            .map((x) => quoteVal(x, num))
            .join(', ')})`;
        case 'between':
          return `${f} BETWEEN ${quoteVal(c.value, num)} AND ${quoteVal(c.value2 ?? c.value, num)}`;
        case 'null':
          return `${f} IS NULL`;
        case 'notnull':
          return `${f} IS NOT NULL`;
        default:
          return `${f} ${SYMBOL[c.op] ?? '='} ${quoteVal(c.value, num)}`;
      }
    });
  return parts.join(` ${combinator} `);
}

const lit = (n) => (n.t === 'num' || n.t === 'str' ? String(n.v) : null);

function conditionFrom(n) {
  if (n.t === 'bin' && SYMBOL && n.a.t === 'field' && lit(n.b) != null) {
    const op = Object.keys(SYMBOL).find((k) => SYMBOL[k] === n.op);
    return op ? { field: n.a.name, op, value: lit(n.b) } : null;
  }
  if (n.t === 'like' && !n.neg && n.a.t === 'field' && n.pat.t === 'str') {
    const v = n.pat.v;
    if (/^%[^%_]*%$/.test(v)) return { field: n.a.name, op: 'contains', value: v.slice(1, -1) };
    if (/^[^%_]*%$/.test(v)) return { field: n.a.name, op: 'starts', value: v.slice(0, -1) };
    return null;
  }
  if (n.t === 'in' && !n.neg && n.a.t === 'field' && n.list.every((x) => lit(x) != null)) return { field: n.a.name, op: 'in', value: n.list.map(lit).join(', ') };
  if (n.t === 'between' && !n.neg && n.a.t === 'field' && lit(n.lo) != null && lit(n.hi) != null) return { field: n.a.name, op: 'between', value: lit(n.lo), value2: lit(n.hi) };
  if (n.t === 'isnull' && n.a.t === 'field') return { field: n.a.name, op: n.neg ? 'notnull' : 'null', value: '' };
  return null;
}

/** Builder for a SQL string when it is a flat AND or OR list of simple conditions, else null. */
export function sqlToBuilder(src, fields) {
  const { ast, error } = check(src, fields);
  if (error) return null;
  if (!ast) return { combinator: 'AND', conditions: [] };
  const kind = ast.t === 'or' ? 'or' : 'and';
  const flat = [];
  const walk = (n) => (n.t === kind ? (walk(n.a), walk(n.b)) : flat.push(n));
  walk(ast);
  const conditions = flat.map(conditionFrom);
  return conditions.every(Boolean) ? { combinator: kind === 'or' ? 'OR' : 'AND', conditions } : null;
}
