// Drives the Sayola demo end to end in a headless browser, records it, and burns in
// a caption for each step with ffmpeg. Output: out/sayola-demo.mp4 (+ out/captions.srt).
//
//   BASE_URL=http://localhost:3000 node record.mjs
//   node record.mjs --compose     re-render captions and re-encode the last take without recording
//
// Run ../scripts/reset-demo.sh before each take so the forecast shows a shortfall.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = new URL("./out/", import.meta.url).pathname;
const SIZE = { width: 1280, height: 800 };
const AMOUNT = 100;
const RECIPIENT = { key: "recipient-3", ar: "أم خالد" };
const AGENT_AR = "نقطة سيولة الأمل";

const CAPTIONS = [
  "Sayola · سيولة — Umm Khaled's aid payday, live on Stellar testnet",
  "1 · The NGO funds $100 for Umm Khaled. It is held in escrow on Stellar, and she pays nothing.",
  "2 · Payday forecast: Idlib would run short. One click stocks the agent from the savings vault, within its daily cash ceiling.",
  "3 · Her $100 becomes 13,300 pounds at the licensed partner's published rate. Sayola never sets the rate.",
  "4 · On her phone, in Arabic, Umm Khaled books the Al-Amal agent. Her cash is held for her.",
  "5 · At the counter, the agent enters her payment and she reads him her SMS code. Both sign the dollars, the pounds and the rate.",
  "6 · Proof of delivery: the pounds paid and the rate, approved by both the agent and the family, recorded on Stellar.",
  "7 · Short-changed? She reports it privately, and the agent's deposit pays her back.",
  "8 · Savers like Omar fund the cash as partners and earn half of every fee. Profit and loss shared, nothing guaranteed.",
  "Aid arrives in seconds. Now so does the cash.",
];

const marks = [];
/** Spans spent waiting for Stellar to confirm; compose() trims them down to a short beat. */
const waits = [];
let t0 = 0;
const now = () => (Date.now() - t0) / 1000;
const mark = (i) => {
  marks.push({ i, t: now() });
  console.log(`[${marks.at(-1).t.toFixed(1)}s] ${CAPTIONS[i]}`);
};
const pause = (page, ms) => page.waitForTimeout(ms);

async function open(page, path) {
  await page.goto(BASE + path);
  await page.locator("main h1").first().waitFor({ timeout: 60_000 });
  await pause(page, 1200);
}

/** Waits for the transaction banner, failing the take if the contract rejected it. */
async function waitForTx(page) {
  const done = page.locator("text=/Confirmed on Stellar testnet|تم التنفيذ/");
  const failed = page.locator("div.bg-rose-50.rounded-xl.px-4");
  const start = now();
  await Promise.race([
    done.waitFor({ timeout: 90_000 }),
    failed.waitFor({ timeout: 90_000 }).then(async () => {
      throw new Error(`Transaction failed: ${await failed.innerText()}`);
    }),
  ]);
  waits.push({ start, end: now() });
  const href = await page.locator("a", { hasText: /View transaction|عرض المعاملة/ }).getAttribute("href");
  await pause(page, 1500);
  return href;
}

async function spotlight(locator, ms = 2500) {
  await locator.evaluate((el, ms) => {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const prev = el.style.boxShadow;
    el.style.transition = "box-shadow 200ms";
    el.style.boxShadow = "0 0 0 4px #f59e0b";
    setTimeout(() => (el.style.boxShadow = prev), ms);
  }, ms);
  await locator.page().waitForTimeout(ms);
}

const card = (page, title) => page.locator("section", { has: page.locator("h2", { hasText: title }) });

async function run(page) {
  // Title
  mark(0);
  await open(page, "/ngo");
  await pause(page, 2500);

  // 1 · Fund
  mark(1);
  const fund = card(page, "Fund a payment");
  await fund.scrollIntoViewIfNeeded();
  await fund.locator("select").selectOption(RECIPIENT.key);
  await fund.locator("input[type=number]").fill(String(AMOUNT));
  await pause(page, 800);
  await fund.getByRole("button", { name: /^Fund / }).click();
  await waitForTx(page);
  const payments = card(page, "Payments");
  const newest = payments.locator("tbody tr").first();
  const id = (await newest.locator("td").first().innerText()).trim();
  await spotlight(newest);

  // 2 · Pre-position
  mark(2);
  const forecast = card(page, "Payday forecast");
  await spotlight(forecast, 2000);
  const idlib = forecast.locator("tr", { hasText: "Idlib" });
  await idlib.getByRole("button", { name: /Pre-position/ }).click();
  await waitForTx(page);
  await spotlight(idlib, 2000);
  await spotlight(forecast.locator("th", { hasText: "Days to serve" }), 1500);
  await spotlight(card(page, "Agent cash-out room by day"), 2500);

  // 3 · Rate card
  mark(3);
  const rates = card(page, "Exchange rate");
  await spotlight(rates, 1500);
  await spotlight(rates.locator("div.border-emerald-600"), 3000);

  // 4 · Recipient books
  mark(4);
  await open(page, "/recipient");
  await page.getByRole("button", { name: RECIPIENT.ar, exact: true }).click();
  const mine = page.locator("section", { hasText: `مساعدة نقدية #${id}` });
  await mine.waitFor();
  await spotlight(page.locator("main section").first(), 2000);
  await mine.getByRole("button", { name: AGENT_AR }).click();
  await waitForTx(page);
  await spotlight(mine, 2500);
  const smsCode = mine.locator("span.font-mono");
  await page.waitForFunction((el) => /\d{6}/.test(el.textContent ?? ""), await smsCode.elementHandle());
  const code = (await smsCode.innerText()).trim();

  // 5 · Agent confirms
  mark(5);
  await open(page, "/agent");
  const cashOut = card(page, "صرف نقدي");
  await spotlight(page.locator("main .grid").first(), 2000);
  await cashOut.locator("input").first().fill(id);
  await spotlight(cashOut.locator("div.bg-stone-50").first(), 2500);
  await cashOut.getByPlaceholder("الرمز من 6 أرقام").pressSequentially(code, { delay: 120 });
  await pause(page, 600);
  await cashOut.getByRole("button", { name: /تأكيد تسليم/ }).click();
  const confirmTx = await waitForTx(page);

  // 6 · Proof
  mark(6);
  await open(page, "/ngo");
  const row = card(page, "Payments").locator("tbody tr", { has: page.locator("td.font-mono", { hasText: new RegExp(`^${id}$`) }) });
  await spotlight(row, 3000);
  await page.goto(confirmTx);
  await page.waitForLoadState("domcontentloaded");
  await pause(page, 6000);
  await page.mouse.wheel(0, 500);
  await pause(page, 3000);

  // 7 · Dispute
  mark(7);
  await open(page, "/recipient");
  await page.getByRole("button", { name: RECIPIENT.ar, exact: true }).click();
  const box = page.locator("section", { hasText: `مساعدة نقدية #${id}` }).locator("div.bg-rose-50");
  await box.waitFor();
  await spotlight(box, 1500);
  await box.locator("input").fill("20");
  await pause(page, 600);
  await box.getByRole("button", { name: "تقديم اعتراض" }).click();
  await waitForTx(page);

  // 8 · Savers
  mark(8);
  await open(page, "/invest");
  const stats = page.locator("main .grid").first();
  await spotlight(stats, 2000);
  await spotlight(stats.locator("div.rounded-xl", { hasText: "Vault fees earned" }), 3000);

  // Close
  mark(9);
  await pause(page, 4000);
}

/** Renders each caption as a transparent PNG so ffmpeg can overlay it without libass or drawtext. */
async function renderCaptions(browser) {
  const page = await browser.newPage({ viewport: SIZE });
  const files = [];
  for (const [i, text] of CAPTIONS.entries()) {
    await page.setContent(`
      <html><body style="margin:0;background:transparent">
        <div id="c" style="display:inline-block;max-width:1100px;padding:14px 22px;border-radius:14px;
          background:rgba(12,10,9,.82);color:#fff;font:600 24px/1.35 -apple-system,'Helvetica Neue','Geeza Pro',sans-serif">
          ${text}
        </div>
      </body></html>`);
    const file = join(OUT, `caption-${i}.png`);
    await page.locator("#c").screenshot({ path: file, omitBackground: true });
    files.push(file);
  }
  await page.close();
  return files;
}

function srtTime(s) {
  const ms = Math.round(s * 1000);
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}

function compose(raw, pngs) {
  const { marks, waits = [], duration } = JSON.parse(readFileSync(join(OUT, "marks.json"), "utf8"));
  // Keep the "Submitting to Stellar" banner on screen briefly, then cut the rest of the wait.
  const cuts = waits
    .map((w) => ({ from: w.start + 1.2, to: w.end - 0.3 }))
    .filter((c) => c.to - c.from > 0.5);
  const shift = (t) => t - cuts.reduce((s, c) => s + Math.max(0, Math.min(t, c.to) - c.from), 0);
  const spans = marks.map((m, k) => ({ i: m.i, t: shift(m.t), end: shift(marks[k + 1]?.t ?? duration) }));
  writeFileSync(
    join(OUT, "captions.srt"),
    spans.map((s, k) => `${k + 1}\n${srtTime(s.t)} --> ${srtTime(s.end)}\n${CAPTIONS[s.i]}\n`).join("\n"),
  );

  const inputs = ["-i", raw, ...pngs.flatMap((p) => ["-i", p]), "-i", join(OUT, "captions.srt")];
  const keep = cuts.length
    ? `,select='not(${cuts.map((c) => `between(t,${c.from.toFixed(2)},${c.to.toFixed(2)})`).join("+")})',setpts=N/30/TB`
    : "";
  let filter = `[0:v]fps=30${keep}[base];`;
  let prev = "base";
  spans.forEach((s, k) => {
    const next = k === spans.length - 1 ? "v" : `v${k}`;
    filter += `[${prev}][${s.i + 1}:v]overlay=x=(W-w)/2:y=H-h-36:enable='between(t,${s.t.toFixed(2)},${s.end.toFixed(2)})'[${next}];`;
    prev = next;
  });
  const out = join(OUT, "sayola-demo.mp4");
  execFileSync(
    "ffmpeg",
    [
      "-y", "-hide_banner", "-loglevel", "error",
      ...inputs,
      "-filter_complex", filter.slice(0, -1),
      "-map", "[v]", "-map", `${pngs.length + 1}:s`,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-r", "30",
      "-c:s", "mov_text", "-metadata:s:s:0", "language=eng",
      "-movflags", "+faststart",
      out,
    ],
    { stdio: "inherit" },
  );
  return out;
}

const raw = join(OUT, "raw.webm");
const browser = await chromium.launch();
if (!process.argv.includes("--compose")) {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: OUT, size: SIZE } });
  // Hide the Next.js dev-mode indicator.
  await context.addInitScript(() => {
    addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.head.append(style);
    });
  });
  const page = await context.newPage();
  t0 = Date.now();
  try {
    await run(page);
  } finally {
    await context.close();
  }
  writeFileSync(join(OUT, "marks.json"), JSON.stringify({ marks, waits, duration: now() }));
  renameSync(join(OUT, readdirSync(OUT).find((f) => f.endsWith(".webm"))), raw);
}
const pngs = await renderCaptions(browser);
await browser.close();
console.log(`Composed ${compose(raw, pngs)}`);
