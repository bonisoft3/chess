// The board as its stylesheet sees it, without a browser: the emitted markup
// parsed into a tree, each element's attributes bound from the row its region
// reads, and board.css's display rules applied by specificity and order. What
// can be pressed in a state is then a question about that state's rows — the
// same attributes the CSS keys on — and a gesture that opens a popover is
// counted, so "one gesture away" is a number the tests can hold.
//
// The pickers are driven the way the terminal drives them: each one's machine
// is read off its own data-machine, and a choice is the arrow that machine
// declares, written onto whichever row the picker's region reads.

export type Row = Record<string, string>;
export type Rows = Record<string, Row[]>;
export type Node = { tag: string; attrs: Record<string, string>; parent?: Node; children: Node[] };

const APP = new URL("../", import.meta.url);
const read = (path: string) => Deno.readTextFile(new URL(path, APP));

const VOID = new Set(["input", "br", "img", "meta", "link", "hr", "source", "area", "col", "embed", "wbr"]);
const decode = (s: string) =>
  s.replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");

/** A tag soup's tree: enough of HTML to know who contains whom. */
export function parse(html: string): Node {
  const root: Node = { tag: "#root", attrs: {}, children: [] };
  let at = root;
  const bare = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(style|script)\b[\s\S]*?<\/\1>/g, "");
  const tags = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;
  for (const [, close, name, rest, self] of bare.matchAll(tags)) {
    const tag = name.toLowerCase();
    if (close !== "") {
      let n: Node | undefined = at;
      while (n !== undefined && n !== root && n.tag !== tag) n = n.parent;
      if (n !== undefined && n !== root) at = n.parent!;
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of rest.matchAll(/([^\s=>/]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      attrs[a[1]] = decode(a[2] ?? a[3] ?? a[4] ?? "");
    }
    const node: Node = { tag, attrs, parent: at, children: [] };
    at.children.push(node);
    if (self === "" && !VOID.has(tag)) at = node;
  }
  return root;
}

const walk = function* (n: Node): Generator<Node> {
  yield n;
  for (const c of n.children) yield* walk(c);
};

/* --- binding ---------------------------------------------------------------- */

const eqsOf = (filter: string, ctx: Row) =>
  Object.fromEntries(
    filter.split("&").map((p) => /^(\w+)=eq\.(.*)$/.exec(p)).filter((m) => m !== null)
      .map((m) => [m![1], m![2].replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? "")]),
  );
const fill = (v: string, ctx: Row) => v.replace(/\{([a-z_][a-z0-9_]*)\}/g, (_, k) => ctx[k] ?? "");

/** The row a region shows: the first its filter admits, else its declared fallback. */
export function rowOf(n: Node, rows: Rows, ctx: Row): Row {
  const eqs = eqsOf(n.attrs["data-filter"] ?? "", ctx);
  const hit = (rows[n.attrs["data-live"]] ?? []).find((r) => Object.entries(eqs).every(([k, v]) => r[k] === v));
  if (hit !== undefined) return hit;
  return n.attrs["data-empty-row"] === undefined ? {} : JSON.parse(n.attrs["data-empty-row"]);
}

/** A copy of the tree with every placeholder filled from its region's row. A
 *  list region shows its first row: every one this suite looks inside is a list
 *  of one, or a list nothing here is looked for in. */
export function bind(tree: Node, rows: Rows): Node {
  const copy = (n: Node, parent: Node | undefined, ctx: Row): Node => {
    const out: Node = { tag: n.tag, attrs: {}, parent, children: [] };
    let own = ctx;
    let inner = ctx;
    if (n.attrs["data-live"] !== undefined) {
      const listed = n.children.some((c) => c.tag === "template" && c.attrs["data-item"] !== undefined);
      const row = rowOf(n, rows, ctx);
      if (!listed) own = row;
      inner = row;
    }
    for (const [k, v] of Object.entries(n.attrs)) out.attrs[k] = fill(v, own);
    out.children = n.children.map((c) => copy(c, out, inner));
    return out;
  };
  return copy(tree, undefined, {});
}

/* --- the stylesheet ------------------------------------------------------------ */

type Rule = { sel: string; display: string; spec: number; order: number };

/** Every top-level rule that sets `display`. At-rule blocks are a phone's or a
 *  motion preference's, and these windows are neither. */
export function displayRules(css: string): Rule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Rule[] = [];
  let i = 0;
  let order = 0;
  while (i < src.length) {
    const open = src.indexOf("{", i);
    if (open < 0) break;
    const head = src.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < src.length && depth > 0) {
      if (src[j] === "{") depth += 1;
      else if (src[j] === "}") depth -= 1;
      j += 1;
    }
    const body = src.slice(open + 1, j - 1);
    i = j;
    if (head.startsWith("@")) continue;
    const d = /(?:^|;)\s*display\s*:\s*([^;]+)/.exec(body);
    if (d === null) continue;
    for (const sel of splitTop(head, ",")) {
      if (sel.includes("::")) continue;
      out.push({ sel, display: d[1].trim(), spec: specificity(sel), order: order++ });
    }
  }
  return out;
}

const splitTop = (s: string, by: string) => {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[") depth += 1;
    if (ch === ")" || ch === "]") depth -= 1;
    if (ch === by && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim() !== "") out.push(cur.trim());
  return out;
};

/** A complex selector as compounds and the combinators between them. */
const complex = (sel: string) => {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of sel) {
    if (ch === "(" || ch === "[") depth += 1;
    if (ch === ")" || ch === "]") depth -= 1;
    if (depth === 0 && (ch === " " || ch === ">")) {
      if (cur !== "") parts.push(cur);
      cur = "";
      if (ch === ">") parts.push(">");
    } else cur += ch;
  }
  if (cur !== "") parts.push(cur);
  return parts;
};

type Simple = { kind: "tag" | "id" | "class" | "attr" | "pseudo"; name: string; value?: string; arg?: string };
const simples = (compound: string): Simple[] => {
  const out: Simple[] = [];
  const re = /^(\*|[a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]|:([\w-]+)(?:\(((?:[^()]|\([^()]*\))*)\))?/g;
  for (const m of compound.matchAll(re)) {
    if (m[1] !== undefined) out.push({ kind: "tag", name: m[1].toLowerCase() });
    else if (m[2] !== undefined) out.push({ kind: "id", name: m[2] });
    else if (m[3] !== undefined) out.push({ kind: "class", name: m[3] });
    else if (m[4] !== undefined) out.push({ kind: "attr", name: m[4], value: m[5] });
    else out.push({ kind: "pseudo", name: m[6], arg: m[7] });
  }
  return out;
};

function specificity(sel: string): number {
  let a = 0, b = 0, c = 0;
  for (const part of complex(sel)) {
    if (part === ">") continue;
    for (const s of simples(part)) {
      if (s.kind === "id") a += 1;
      else if (s.kind === "tag") c += s.name === "*" ? 0 : 1;
      else if (s.kind === "pseudo" && ["not", "has", "is"].includes(s.name)) {
        const n = Math.max(...splitTop(s.arg ?? "", ",").map(specificity));
        a += Math.floor(n / 10000);
        b += Math.floor(n / 100) % 100;
        c += n % 100;
      } else b += 1;
    }
  }
  return a * 10000 + b * 100 + c;
}

const anyMatch = (n: Node, list: string) => splitTop(list, ",").some((s) => matches(n, s));

function compoundMatches(n: Node, compound: string): boolean {
  if (n.tag === "#root") return false;
  return simples(compound).every((s) => {
    if (s.kind === "tag") return s.name === "*" || s.name === n.tag;
    if (s.kind === "id") return n.attrs.id === s.name;
    if (s.kind === "class") return (n.attrs.class ?? "").split(/\s+/).includes(s.name);
    if (s.kind === "attr") return s.value === undefined ? s.name in n.attrs : n.attrs[s.name] === s.value;
    if (s.name === "not") return !anyMatch(n, s.arg ?? "");
    if (s.name === "is") return anyMatch(n, s.arg ?? "");
    if (s.name === "has") {
      for (const d of walk(n)) if (d !== n && anyMatch(d, s.arg ?? "")) return true;
      return false;
    }
    // State this tree does not have — hovered, focused, open, empty — never
    // matches, so a rule that needs one is a rule that does not apply.
    return false;
  });
}

export function matches(n: Node, sel: string): boolean {
  const parts = complex(sel);
  const from = (node: Node | undefined, k: number): boolean => {
    if (node === undefined || !compoundMatches(node, parts[k])) return false;
    if (k === 0) return true;
    if (parts[k - 1] === ">") return from(node.parent, k - 2);
    for (let up = node.parent; up !== undefined; up = up.parent) if (from(up, k - 1)) return true;
    return false;
  };
  return from(n, parts.length - 1);
}

/* --- what a state lets a hand reach -------------------------------------------- */

export type Board = { tree: Node; rules: Rule[]; html: string };

export async function loadBoard(): Promise<Board> {
  const html = await read("shell/screens/board.html");
  return { tree: parse(html), rules: displayRules(await read("shell/screens/board.css")), html };
}

/** The board in one state: the bound tree, and how many gestures away each
 *  element is — zero on screen, one behind a popover whose invoker is on
 *  screen — or undefined when nothing the reader can press reaches it. */
export function view(board: Board, rows: Rows) {
  const tree = bind(board.tree, rows);
  const byId = new Map<string, Node>();
  for (const n of walk(tree)) if (n.attrs.id !== undefined && !byId.has(n.attrs.id)) byId.set(n.attrs.id, n);
  const invoker = (id: string) =>
    [...walk(tree)].find((n) =>
      (n.attrs.commandfor === id && ["toggle-popover", "show-popover"].includes(n.attrs.command ?? "")) ||
      n.attrs.popovertarget === id
    );
  const shown = (n: Node) => {
    if ("hidden" in n.attrs) return false;
    let best: Rule | undefined;
    for (const r of board.rules) {
      if (!matches(n, r.sel)) continue;
      if (best === undefined || r.spec > best.spec || (r.spec === best.spec && r.order > best.order)) best = r;
    }
    return best === undefined || best.display !== "none";
  };
  const depthOf = (n: Node, seen = new Set<Node>()): number | undefined => {
    if (seen.has(n)) return undefined;
    seen.add(n);
    let depth = 0;
    for (let up: Node | undefined = n; up !== undefined; up = up.parent) {
      if (!shown(up)) return undefined;
      if (up !== n && "popover" in up.attrs) {
        const by = invoker(up.attrs.id ?? "");
        if (by === undefined) return undefined;
        // A copy per branch: the invoker's own ancestors may pass through a
        // popover this walk reaches again further up.
        const d = depthOf(by, new Set(seen));
        if (d === undefined) return undefined;
        depth = Math.max(depth, d + 1);
      }
    }
    return depth;
  };
  return {
    tree,
    node: (id: string) => byId.get(id),
    /** The first element wearing this class. */
    first: (cls: string) => [...walk(tree)].find((n) => (n.attrs.class ?? "").split(/\s+/).includes(cls)),
    /** Gestures to reach the element with this id, or undefined. */
    depth: (id: string) => {
      const n = byId.get(id);
      return n === undefined ? undefined : depthOf(n);
    },
  };
}

/* --- the pickers, as the terminal runs them ------------------------------------- */

export type Picker = {
  key: string;
  table: string;
  filter: string;
  emptyRow?: Row;
  // deno-lint-ignore no-explicit-any
  machine: any;
  options: string[];
};

export function pickers(board: Board): Picker[] {
  const out: Picker[] = [];
  for (const n of walk(board.tree)) {
    if (!(n.attrs.class ?? "").split(" ").includes("picker") || n.attrs["data-machine"] === undefined) continue;
    const key = n.attrs["data-picker"];
    const options = [...walk(n)].map((c) => c.attrs.id ?? "").filter((id) => id.startsWith(`${key}-trigger-`))
      .map((id) => id.slice(`${key}-trigger-`.length));
    out.push({
      key,
      table: n.attrs["data-live"],
      filter: n.attrs["data-filter"] ?? "",
      emptyRow: n.attrs["data-empty-row"] === undefined ? undefined : JSON.parse(n.attrs["data-empty-row"]),
      machine: JSON.parse(n.attrs["data-machine"]),
      options,
    });
  }
  return out;
}

const guards = new Map<string, (state: unknown, event: unknown) => unknown>();
const guardOf = async (type: string) => {
  if (!guards.has(type)) guards.set(type, (0, eval)(await read(`shell/handlers/${type}.js`)));
  return guards.get(type)!;
};

/** The write one option's button makes: the arrow its machine declares from the
 *  state the row is in, onto the row the picker reads — or nothing, when no
 *  arrow applies or its guard says no. */
export async function choose(p: Picker, rows: Rows, option: string) {
  const eqs = eqsOf(p.filter, {});
  const row = (rows[p.table] ?? []).find((r) => Object.entries(eqs).every(([k, v]) => r[k] === v)) ?? p.emptyRow ?? { ...eqs };
  if (row.id === undefined) throw new Error(`the ${p.key} picker reads no row with an id in ${p.table}`);
  const state = row[p.machine.field] ?? p.machine.initial;
  const stateArrows = p.machine.states?.[state]?.on?.[`click@${p.key}-trigger-${option}`];
  const arrow = stateArrows ?? p.machine.on?.[`click@${p.key}-trigger-${option}`];
  if (arrow === undefined) return [];
  for (const cand of Array.isArray(arrow) ? arrow : [arrow]) {
    if (cand.guard !== undefined && !(await guardOf(cand.guard.type))({ items: [row] }, {})) continue;
    return [{ op: "patch", entity: p.table, id: row.id, row: { [p.machine.field]: cand.target, ...(cand.assign ?? {}) } }];
  }
  return [];
}

/** The tables whose change wakes a handler: a mutation wake is a region's own
 *  read changing. */
export function wakers(board: Board, handler: string): Set<string> {
  const out = new Set<string>();
  for (const n of walk(board.tree)) if (n.attrs["data-on-mutation"] === handler) out.add(n.attrs["data-live"]);
  return out;
}

/** The buttons that say something to a handler, by the id they report. */
export function buttons(board: Board, handler: string): string[] {
  return [...walk(board.tree)]
    .filter((n) => n.tag === "button" && n.attrs["data-on-click"] === handler && (n.attrs.id ?? "").startsWith("btn-"))
    .map((n) => n.attrs.id);
}
