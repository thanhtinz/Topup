// bắt buộc (eslint-disable, @ts-*) vì xoá chúng sẽ làm hỏng lint/build.
import ts from "typescript";
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const KEEP = /eslint|@ts-ignore|@ts-expect-error|@ts-nocheck|prettier-ignore|istanbul|c8 ignore|webpackChunkName|reference/i;

function scrubTs(text, fileName) {
  const kind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : fileName.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
  const ranges = new Map();
  const jsxContainers = [];
  const visit = (node) => {
    if (ts.isJsxExpression(node) && !node.expression) {
      const inner = text.slice(node.getStart(sf), node.end);
      if (!KEEP.test(inner)) jsxContainers.push([node.getStart(sf), node.end]);
    }
    for (const r of [...(ts.getLeadingCommentRangesOfNode(node, sf) ?? []), ...(ts.getTrailingCommentRanges(text, node.end) ?? [])]) {
      ranges.set(r.pos + "-" + r.end, r);
    }
    node.forEachChild(visit);
  };
  visit(sf);

  const removals = [];
  for (const [s, e] of jsxContainers) removals.push([s, e]);
  for (const r of ranges.values()) {
    if (jsxContainers.some(([s, e]) => r.pos >= s && r.end <= e)) continue;
    const body = text.slice(r.pos, r.end);
    if (KEEP.test(body)) continue;
    removals.push([r.pos, r.end]);
  }
  const stringSpans = [];
  const collectSpans = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node) || ts.isRegularExpressionLiteral(node)) {
      stringSpans.push([node.getStart(sf), node.end]);
    }
    node.forEachChild(collectSpans);
  };
  collectSpans(sf);
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.JSX, text);
  let tok;
  while ((tok = scanner.scan()) !== ts.SyntaxKind.EndOfFileToken) {
    if (tok !== ts.SyntaxKind.SingleLineCommentTrivia && tok !== ts.SyntaxKind.MultiLineCommentTrivia) continue;
    const pos = scanner.getTokenStart();
    const end = scanner.getTokenEnd();
    if (KEEP.test(text.slice(pos, end))) continue;
    if (removals.some(([s, e]) => pos >= s && end <= e)) continue;
    if (stringSpans.some(([s, e]) => pos >= s && pos < e)) continue;
    const holder = jsxContainers.find(([s, e]) => pos >= s && end <= e);
    if (holder) continue;
    removals.push([pos, end]);
  }

  removals.sort((a, b) => b[0] - a[0]);
  let out = text;
  for (const [pos, end] of removals) {
    const lineStart = out.lastIndexOf("\n", pos - 1) + 1;
    const nl = out.indexOf("\n", end);
    const lineEnd = nl === -1 ? out.length : nl;
    const before = out.slice(lineStart, pos);
    const after = out.slice(end, lineEnd);
    if (/^\s*$/.test(before) && /^\s*$/.test(after)) {
      out = out.slice(0, lineStart) + out.slice(nl === -1 ? out.length : nl + 1);
    } else if (out.slice(pos, pos + 2) === "/*") {
      out = out.slice(0, pos) + " " + out.slice(end);
    } else {
      out = out.slice(0, pos) + out.slice(end);
    }
  }
  return out;
}

function scrubCss(text) {
  let out = "";
  let i = 0;
  let quote = null;
  while (i < text.length) {
    const c = text[i];
    if (quote) {
      out += c;
      if (c === "\\") { out += text[i + 1] ?? ""; i += 2; continue; }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; out += c; i += 1; continue; }
    if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      const lineStart = out.lastIndexOf("\n") + 1;
      const nl = text.indexOf("\n", stop);
      const after = text.slice(stop, nl === -1 ? text.length : nl);
      if (/^\s*$/.test(out.slice(lineStart)) && /^\s*$/.test(after)) {
        out = out.slice(0, lineStart);
        i = nl === -1 ? text.length : nl + 1;
      } else {
        out += " ";
        i = stop;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function scrubLineHash(text, marker, keepFirstLine) {
  return text.split("\n").map((line, idx) => {
    if (keepFirstLine && idx === 0 && line.startsWith("#!")) return line;
    let quote = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quote) {
        if (c === "\\") i += 1;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (marker === "//" ? (c === "/" && line[i + 1] === "/") : (c === "#" && (i === 0 || /\s/.test(line[i - 1])))) {
        return line.slice(0, i).replace(/\s+$/, "");
      }
    }
    return line;
  }).join("\n");
}

const args = process.argv.slice(2);
const files = args.length
  ? args
  : execSync('find src scripts prisma -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.mjs" -o -name "*.css" -o -name "*.prisma" -o -name "*.sh" \\)', { encoding: "utf8" }).trim().split("\n");

let changed = 0;
for (const f of files) {
  const text = readFileSync(f, "utf8");
  let out;
  if (f.endsWith(".css")) out = scrubCss(text);
  else if (f.endsWith(".prisma")) out = scrubLineHash(text, "//", false);
  else if (f.endsWith(".sh")) out = scrubLineHash(text, "#", true);
  else out = scrubTs(text, f);
  if (out !== text) { writeFileSync(f, out); changed += 1; console.log("scrubbed:", f); }
}
console.log("DONE, files changed:", changed, "/", files.length);
