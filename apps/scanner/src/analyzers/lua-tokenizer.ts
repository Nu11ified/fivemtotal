import type { LuaToken, LuaTokenType } from "../types";

/**
 * Lua keywords for identification.
 */
const LUA_KEYWORDS = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for",
  "function", "goto", "if", "in", "local", "nil", "not", "or",
  "repeat", "return", "then", "true", "until", "while",
]);

/**
 * Lightweight Lua tokenizer that identifies function calls,
 * string literals, assignments, and table constructors.
 *
 * This is not a full parser -- it produces a flat token stream
 * sufficient for pattern matching in static analysis.
 */
export function tokenizeLua(source: string): LuaToken[] {
  const tokens: LuaToken[] = [];
  let pos = 0;
  let line = 1;
  let col = 1;

  while (pos < source.length) {
    const ch = source[pos];

    // Whitespace
    if (/\s/.test(ch)) {
      const start = pos;
      while (pos < source.length && /\s/.test(source[pos])) {
        if (source[pos] === "\n") {
          line++;
          col = 1;
        } else {
          col++;
        }
        pos++;
      }
      // Skip whitespace tokens for performance
      continue;
    }

    // Long comments: --[[ ... ]]
    if (ch === "-" && source[pos + 1] === "-" && source[pos + 2] === "[") {
      const eqCount = countEquals(source, pos + 2);
      if (eqCount >= 0) {
        const closer = "]" + "=".repeat(eqCount) + "]";
        const endIdx = source.indexOf(closer, pos + 3 + eqCount);
        const end = endIdx >= 0 ? endIdx + closer.length : source.length;
        const value = source.slice(pos, end);
        tokens.push({ type: "comment", value, line, column: col });
        updatePosition(value);
        pos = end;
        continue;
      }
    }

    // Single-line comments: -- ...
    if (ch === "-" && source[pos + 1] === "-") {
      const endIdx = source.indexOf("\n", pos);
      const end = endIdx >= 0 ? endIdx : source.length;
      const value = source.slice(pos, end);
      tokens.push({ type: "comment", value, line, column: col });
      pos = end;
      continue;
    }

    // Long strings: [[ ... ]] or [=[ ... ]=]
    if (ch === "[") {
      const eqCount = countEquals(source, pos);
      if (eqCount >= 0) {
        const closer = "]" + "=".repeat(eqCount) + "]";
        const startContent = pos + 1 + eqCount + 1; // skip [==[
        const endIdx = source.indexOf(closer, startContent);
        const end = endIdx >= 0 ? endIdx + closer.length : source.length;
        const value = source.slice(pos, end);
        tokens.push({ type: "string", value, line, column: col });
        updatePosition(value);
        pos = end;
        continue;
      }
    }

    // Single or double quoted strings
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let end = pos + 1;
      while (end < source.length) {
        if (source[end] === "\\") {
          end += 2; // skip escape
          continue;
        }
        if (source[end] === quote) {
          end++;
          break;
        }
        if (source[end] === "\n") {
          break; // unterminated
        }
        end++;
      }
      const value = source.slice(pos, end);
      tokens.push({ type: "string", value, line, column: col });
      col += value.length;
      pos = end;
      continue;
    }

    // Numbers (including hex 0x...)
    if (/\d/.test(ch) || (ch === "." && pos + 1 < source.length && /\d/.test(source[pos + 1]))) {
      const start = pos;
      if (ch === "0" && (source[pos + 1] === "x" || source[pos + 1] === "X")) {
        pos += 2;
        while (pos < source.length && /[0-9a-fA-F]/.test(source[pos])) pos++;
      } else {
        while (pos < source.length && /[\d.]/.test(source[pos])) pos++;
        if (pos < source.length && (source[pos] === "e" || source[pos] === "E")) {
          pos++;
          if (pos < source.length && (source[pos] === "+" || source[pos] === "-")) pos++;
          while (pos < source.length && /\d/.test(source[pos])) pos++;
        }
      }
      const value = source.slice(start, pos);
      tokens.push({ type: "number", value, line, column: col });
      col += value.length;
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(ch)) {
      const start = pos;
      while (pos < source.length && /[a-zA-Z0-9_]/.test(source[pos])) pos++;
      const value = source.slice(start, pos);
      const type: LuaTokenType = LUA_KEYWORDS.has(value) ? "keyword" : "identifier";
      tokens.push({ type, value, line, column: col });
      col += value.length;
      continue;
    }

    // Multi-character operators
    const twoChar = source.slice(pos, pos + 2);
    if (["==", "~=", "<=", ">=", "..", "<<", ">>", "//"].includes(twoChar)) {
      // Check for three-char concat with assign or ...
      if (twoChar === ".." && source[pos + 2] === ".") {
        tokens.push({ type: "punctuation", value: "...", line, column: col });
        pos += 3;
        col += 3;
        continue;
      }
      tokens.push({ type: "operator", value: twoChar, line, column: col });
      pos += 2;
      col += 2;
      continue;
    }

    // Single character operators and punctuation
    if ("+-*/%^#&|~<>=".includes(ch)) {
      tokens.push({ type: "operator", value: ch, line, column: col });
      pos++;
      col++;
      continue;
    }

    if ("(){}[];:,.".includes(ch)) {
      tokens.push({ type: "punctuation", value: ch, line, column: col });
      pos++;
      col++;
      continue;
    }

    // Unknown character
    tokens.push({ type: "unknown", value: ch, line, column: col });
    pos++;
    col++;
  }

  return tokens;

  function updatePosition(text: string): void {
    for (const c of text) {
      if (c === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
    }
  }
}

/**
 * Count the number of '=' signs after '[' for long string/comment detection.
 * Returns -1 if this is not a valid long bracket opening.
 */
function countEquals(source: string, pos: number): number {
  if (source[pos] !== "[") return -1;
  let i = pos + 1;
  let count = 0;
  while (i < source.length && source[i] === "=") {
    count++;
    i++;
  }
  if (i < source.length && source[i] === "[") {
    return count;
  }
  return -1;
}

/**
 * Extract function calls from a token stream.
 * Returns an array of { name, line, args } objects.
 */
export function extractFunctionCalls(
  tokens: LuaToken[],
): Array<{ name: string; line: number; argTokens: LuaToken[] }> {
  const calls: Array<{ name: string; line: number; argTokens: LuaToken[] }> = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.type !== "identifier") continue;

    // Check for dotted names: a.b.c(
    let fullName = tok.value;
    let j = i + 1;

    while (
      j < tokens.length &&
      tokens[j].type === "punctuation" &&
      tokens[j].value === "." &&
      j + 1 < tokens.length &&
      tokens[j + 1].type === "identifier"
    ) {
      fullName += "." + tokens[j + 1].value;
      j += 2;
    }

    // Check for colon syntax: a:b(
    if (
      j < tokens.length &&
      tokens[j].type === "punctuation" &&
      tokens[j].value === ":" &&
      j + 1 < tokens.length &&
      tokens[j + 1].type === "identifier"
    ) {
      fullName += ":" + tokens[j + 1].value;
      j += 2;
    }

    // Is it followed by ( or string literal or { ?
    if (j < tokens.length) {
      const next = tokens[j];
      if (
        (next.type === "punctuation" && next.value === "(") ||
        next.type === "string" ||
        (next.type === "punctuation" && next.value === "{")
      ) {
        // Collect argument tokens until matching close paren
        const argTokens: LuaToken[] = [];
        if (next.value === "(") {
          let depth = 1;
          let k = j + 1;
          while (k < tokens.length && depth > 0) {
            if (tokens[k].type === "punctuation" && tokens[k].value === "(") depth++;
            if (tokens[k].type === "punctuation" && tokens[k].value === ")") depth--;
            if (depth > 0) argTokens.push(tokens[k]);
            k++;
          }
        } else {
          argTokens.push(next);
        }

        calls.push({ name: fullName, line: tok.line, argTokens });
      }
    }
  }

  return calls;
}

/**
 * Extract string literal values from token stream.
 */
export function extractStringLiterals(tokens: LuaToken[]): Array<{ value: string; line: number }> {
  const strings: Array<{ value: string; line: number }> = [];

  for (const tok of tokens) {
    if (tok.type !== "string") continue;

    let value: string;
    if (tok.value.startsWith("[[") || tok.value.startsWith("[=")) {
      // Long string: strip delimiters
      const eqMatch = tok.value.match(/^\[=*\[/);
      const eqLen = eqMatch ? eqMatch[0].length : 2;
      value = tok.value.slice(eqLen, tok.value.length - eqLen);
    } else {
      // Quoted string: strip quotes and unescape
      value = tok.value.slice(1, -1);
      value = unescapeLuaString(value);
    }

    strings.push({ value, line: tok.line });
  }

  return strings;
}

/**
 * Basic Lua string unescape for \xNN, \NNN, \n, \t, etc.
 */
function unescapeLuaString(s: string): string {
  return s.replace(/\\(x[0-9a-fA-F]{2}|\d{1,3}|.)/g, (match, esc: string) => {
    if (esc.startsWith("x")) {
      return String.fromCharCode(parseInt(esc.slice(1), 16));
    }
    if (/^\d/.test(esc)) {
      return String.fromCharCode(parseInt(esc, 10));
    }
    switch (esc) {
      case "n": return "\n";
      case "t": return "\t";
      case "r": return "\r";
      case "a": return "\x07";
      case "b": return "\b";
      case "f": return "\f";
      case "v": return "\v";
      case "\\": return "\\";
      case "'": return "'";
      case '"': return '"';
      default: return match;
    }
  });
}
