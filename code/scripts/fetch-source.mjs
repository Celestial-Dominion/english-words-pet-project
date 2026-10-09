// Lấy văn bản nguồn để kể lại (docs/ENGLISH_CONTENT_PLAYBOOK.md §14, §16) — in ra văn bản thuần, gọn, kèm số chữ.
// Không cài gì thêm: dùng fetch của Node + git (clone nông) vào scripts/.content-src/ (gitignore).
//
//   node scripts/fetch-source.mjs wiki <simple|en|vi|voy> "<Tên bài>" [--max N]   Wikipedia / Simple English / Wikivoyage
//   node scripts/fetch-source.mjs url <https://…> [--max N]                       trang web bất kỳ (lấy <p>, <h2-3>, <li>)
//   node scripts/fetch-source.mjs se <repo>                                        Standard Ebooks: liệt kê chương + số chữ
//   node scripts/fetch-source.mjs se <repo> <file.xhtml> [--max N]                 … in một chương
//   node scripts/fetch-source.mjs gt <repo> [--grep <regex>] [--max N]             GITenberg: in sách (hoặc đoạn khớp regex)
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT } from "./lib/content-model.mjs";

const SRC = join(ROOT, "scripts", ".content-src");
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const pos = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const MAX = Number(opt("--max", 6000));
const UA = { "User-Agent": "english-words-content/1.0 (personal study app)" };

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', mdash: "—", ndash: "–", hellip: "..." };
const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, e) => ENT[e.toLowerCase()] ?? m);
const strip = (html) => decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

function htmlText(html) {
  const body = html
    .replace(/<(script|style|nav|header|footer|aside|form|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const out = [];
  for (const m of body.matchAll(/<(h[1-3]|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = strip(m[2]);
    if (t.split(" ").length >= (m[1].startsWith("h") ? 1 : 4)) out.push(m[1].startsWith("h") ? `## ${t}` : t);
  }
  return out.join("\n");
}

function print(text, label) {
  const words = text.split(/\s+/).filter(Boolean);
  console.log(`# ${label} — ${words.length} chữ${words.length > MAX ? ` (cắt còn ${MAX})` : ""}`);
  if (words.length <= MAX) console.log(text);
  else {
    let n = 0;
    const lines = [];
    for (const l of text.split("\n")) {
      if (n >= MAX) break;
      lines.push(l);
      n += l.split(/\s+/).length;
    }
    console.log(lines.join("\n"));
  }
}

function clone(org, repo) {
  const dir = join(SRC, org, repo);
  if (!existsSync(dir)) {
    mkdirSync(join(SRC, org), { recursive: true });
    execFileSync("git", ["clone", "-q", "--depth", "1", `https://github.com/${org}/${repo}`, dir], { stdio: "inherit" });
  }
  return dir;
}

const [cmd, a, b] = pos;
if (cmd === "wiki") {
  const host = { simple: "simple.wikipedia.org", en: "en.wikipedia.org", vi: "vi.wikipedia.org", voy: "en.wikivoyage.org" }[a];
  const u = `https://${host}/w/api.php?action=query&prop=extracts|info&inprop=url&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(b)}`;
  const d = await (await fetch(u, { headers: UA })).json();
  const page = Object.values(d.query.pages)[0];
  if (!page.extract) throw new Error(`không thấy bài "${b}" trên ${host}`);
  const text = page.extract.replace(/\n{2,}/g, "\n").replace(/^=+\s*(.*?)\s*=+$/gm, "## $1");
  print(text, `${page.fullurl} (CC BY-SA 4.0)`);
} else if (cmd === "url") {
  const html = await (await fetch(a, { headers: UA })).text();
  print(htmlText(html), a);
} else if (cmd === "se") {
  const dir = join(clone("standardebooks", a), "src", "epub", "text");
  const skip = /^(titlepage|imprint|colophon|uncopyright|halftitlepage|toc|dedication|epigraph|endnotes|loi|acknowledgments)/;
  if (!b) {
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".xhtml") && !skip.test(f)).sort((x, y) => x.localeCompare(y, "en", { numeric: true }))) {
      const html = readFileSync(join(dir, f), "utf8");
      const title = strip(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(html)?.[1] ?? "");
      console.log(`${f}\t${strip(html).split(" ").length}\t${title.slice(0, 70)}`);
    }
  } else print(htmlText(readFileSync(join(dir, b), "utf8")), `standardebooks/${a}/${b}`);
} else if (cmd === "gt") {
  const dir = clone("GITenberg", a);
  const f = readdirSync(dir).find((f) => /\.txt$/.test(f) && !/readme|license/i.test(f));
  let text = readFileSync(join(dir, f), "utf8").replace(/\r/g, "");
  const re = opt("--grep");
  if (re) {
    const k = text.search(new RegExp(re, "i"));
    text = k < 0 ? "(không khớp)" : text.slice(k);
  }
  print(text.replace(/\n{3,}/g, "\n\n"), `GITenberg/${a}/${f}`);
} else {
  console.log("dùng: fetch-source.mjs wiki|url|se|gt …");
  process.exit(1);
}
