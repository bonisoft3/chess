// The board screen against a real browser and the launched stack: layout is a
// browser's to decide, so this is the one suite that needs both (ir
// decision-27). At a laptop's and a desktop's size, a game played to its end
// and reviewed never makes the page taller than the window, the panel's foot
// stays in view and uncut, and the chances bar stands beside the board.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { baseUrl } from "../../../plugins/omnishell/base-url.ts";

// The app answers at its routes, not at the directory its assets live in:
// /shell/ is where the document is served FROM and addresses no screen.
const BASE = Deno.env.get("CHESS_URL") ?? `${await baseUrl(".")}/`;
const SHOTS = Deno.env.get("CHESS_SHOTS") ?? "";
// Scholar's mate, played by both hands at one board.
const MATE = [["e2", "e4"], ["e7", "e5"], ["d1", "h5"], ["b8", "c6"], ["f1", "c4"], ["g8", "f6"], ["h5", "f7"]];
// Layout depends only on the window, so one game is played and read, and each
// size is checked by resizing the same page.
const SIZES = [[1280, 800], [1440, 900], [1024, 600]];

// deno-lint-ignore no-explicit-any
type Page = any;

/** A fresh browser on the board screen at the given size, closed after `fn`. */
const onBoard = async (width: number, height: number, fn: (page: Page) => Promise<void>) => {
  const { chromium } = await import("npm:playwright@1.61.1");
  const browser = await chromium.launch({ headless: true, args: ["--ignore-certificate-errors"] });
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForSelector(".board .sq", { timeout: 20000 });
    await fn(page);
  } finally {
    await browser.close();
  }
};

/** The page is no taller than the window, the step buttons are in it, and the
 *  panel's foot is inside the panel rather than clipped by it. */
const fits = async (page: Page, when: string) => {
  const { height } = page.viewportSize();
  const tall = await page.evaluate(() => document.scrollingElement!.scrollHeight);
  if (tall > height) {
    const layout = await page.evaluate(() => {
      const screen = document.querySelector<HTMLElement>('[data-screen="board"]');
      const nav = document.querySelector<HTMLElement>("body > nav");
      return {
        nav: nav?.getBoundingClientRect().height,
        screen: screen?.getBoundingClientRect().height,
        app: document.querySelector<HTMLElement>("#app")?.getBoundingClientRect().height,
        appScroll: document.querySelector<HTMLElement>("#app")?.scrollHeight,
        body: document.body.getBoundingClientRect().height,
        bodyScroll: document.body.scrollHeight,
        overflow: [...document.querySelectorAll<HTMLElement>("body *")]
          .map((el) => ({ el, box: el.getBoundingClientRect() }))
          .filter(({ box }) => box.bottom > innerHeight + 1)
          .sort((a, b) => b.box.bottom - a.box.bottom)
          .slice(0, 8)
          .map(({ el, box }) => ({ tag: el.tagName, class: el.className, id: el.id, bottom: box.bottom, position: getComputedStyle(el).position })),
        scrolling: [...document.querySelectorAll<HTMLElement>("body *")]
          .filter((el) => el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 1)
          .sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))
          .slice(0, 8)
          .map((el) => ({ tag: el.tagName, class: el.className, id: el.id, client: el.clientHeight, scroll: el.scrollHeight, overflow: getComputedStyle(el).overflowY })),
        display: screen && getComputedStyle(screen).display,
      };
    });
    assert(tall <= height, `${when}: the page is ${tall}px tall in a ${height}px window: ${JSON.stringify(layout)}`);
  }
  for (const id of ["nav-first", "nav-back", "nav-fwd", "nav-live"]) {
    const box = await page.locator(`#${id} button`).boundingBox();
    assert(box !== null && box.y >= 0 && box.y + box.height <= height, `${when}: #${id} is out of view (${JSON.stringify(box)})`);
  }
  const foot = await page.locator(".foot").boundingBox();
  const panel = await page.locator(".panel").boundingBox();
  assert(foot !== null && panel !== null && foot.y + foot.height <= panel.y + panel.height + 1,
    `${when}: the panel's foot is cut off (foot ${JSON.stringify(foot)}, panel ${JSON.stringify(panel)})`);
};

/** Waits for the move list to hold at least `n` moves. */
const played = (page: Page, n: number) =>
  page.waitForFunction((k: number) => document.querySelectorAll(".moves li:not(.empty)").length >= k, n, { timeout: 20000 });

/** The id of the game the board shows. */
const shown = (page: Page): Promise<string> =>
  page.evaluate(() => (document.querySelector("article.table") as HTMLElement | null)?.dataset.id ?? "");

/** The id of the cell drawn at the board's bottom-left, by where it stands. */
const bottomLeft = (page: Page): Promise<string> =>
  page.evaluate(() => {
    let best = "";
    let key = -Infinity;
    for (const c of document.querySelectorAll<HTMLElement>(".board .sq")) {
      const r = c.getBoundingClientRect();
      if (r.top - r.left > key) {
        key = r.top - r.left;
        best = c.dataset.id ?? "";
      }
    }
    return best;
  });

/** The move list's visible height, one row's height, and whether the move being
 *  looked at stands inside the list's box. The li is display:contents, so its
 *  cells are what is drawn; the ones a colour hides have no box. */
const moveList = (page: Page): Promise<{ height: number; row: number; hereInside: boolean }> =>
  page.evaluate(() => {
    const list = document.querySelector(".moves")!.getBoundingClientRect();
    const cells = [...document.querySelectorAll('.moves li[data-here="true"] > *')]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    return {
      height: Math.round(list.height),
      row: Math.round(Math.max(0, ...cells.map((r) => r.height))),
      hereInside: cells.length > 0 && cells.every((r) => r.top >= list.top - 1 && r.bottom <= list.bottom + 1),
    };
  });

/** Opens New game's card, makes each [picker, option] choice on it, and presses
 *  Start. Returns the id of the game that was on the board. */
const setUp = async (page: Page, choices: [string, string][]): Promise<string> => {
  const was = await shown(page);
  await page.click("#btn-new");
  for (const [key, option] of choices) {
    await page.click(`#picker-open-${key}`);
    await page.click(`#${key}-trigger-${option}`);
  }
  await page.click("#btn-start");
  return was;
};

/** Waits until one game stands, it is not `was`, and `ready` holds for it.
 *  The game New game replaces can match `ready` too, and for a moment both
 *  are drawn. */
const oneGame = (page: Page, ready: string, was: string) =>
  page.waitForFunction(([sel, old]: string[]) => {
    const games = document.querySelectorAll<HTMLElement>("article.table");
    return games.length === 1 && games[0].matches(sel) && games[0].dataset.id !== old;
  }, [ready, was], { timeout: 20000 });

Deno.test({
  name: "at 1280x800, 1440x900 and 1024x600 the board screen fits the window, playing and in review",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const [[width, height]] = SIZES;
    await onBoard(width, height, async (page) => {
      const was = await setUp(page, [["mode", "hotseat"]]);
      await oneGame(page, '[data-mode="hotseat"][data-ply="0"]', was);
      await fits(page, "a new game");
      for (const [i, [from, to]] of MATE.entries()) {
        await page.click(`.board .sq[data-id="${from}"]`);
        await page.click(`.board .sq[data-id="${to}"]`);
        await played(page, i + 1);
      }
      await page.waitForSelector('.table[data-status="over"]', { timeout: 10000 });
      for (const [w, h] of SIZES) {
        await page.setViewportSize({ width: w, height: h });
        await fits(page, `a finished game at ${w}x${h}`);
        if (SHOTS !== "") await page.screenshot({ path: `${SHOTS}/over-${w}.png` });
      }

      await page.click("#btn-review");
      await page.waitForSelector('.table[data-review="read"]', { timeout: 180000 });
      await page.locator(".moves .san", { hasText: "Nf6" }).click();
      await page.waitForSelector('.moves li[data-here="true"]:has-text("Nf6")');
      for (const [w, h] of SIZES) {
        await page.setViewportSize({ width: w, height: h });
        await fits(page, `a review at ${w}x${h}`);
        const bar = await page.locator(".evbar").boundingBox();
        const plate = await page.locator(".plate").boundingBox();
        assert(bar !== null && plate !== null, "no chances bar or no board");
        assert(await page.locator(".evbar").isVisible(), "the chances bar is not showing in review");
        assert(bar.x + bar.width <= plate.x && Math.abs(bar.height - plate.height) <= 2,
          `at ${w}x${h} the chances bar is not beside the board: bar ${JSON.stringify(bar)}, board ${JSON.stringify(plate)}`);
        if (SHOTS !== "") await page.screenshot({ path: `${SHOTS}/review-${w}.png` });
        // The move list keeps its room with the two live pickers standing in
        // the foot: the move looked at is inside it, and it holds six rows.
        if (w === 1280) {
          const list = await moveList(page);
          console.log(`review at ${w}x${h}: the move list is ${list.height}px, a row ${list.row}px`);
          assert(list.hereInside, `at ${w}x${h} the move looked at is cut off by the move list (${JSON.stringify(list)})`);
          assert(list.height >= 6 * list.row, `at ${w}x${h} the move list holds fewer than six rows (${JSON.stringify(list)})`);
        }
      }

      // How the game is looked at stays in reach in review: turned round, the
      // cell drawn bottom-left is h8.
      assertEquals(await bottomLeft(page), "a1");
      await page.click("#picker-open-view");
      await page.click("#view-trigger-yes");
      for (let i = 0; i < 40 && (await bottomLeft(page)) !== "h8"; i += 1) await page.waitForTimeout(250);
      assertEquals(await bottomLeft(page), "h8", "Black at the foot left a1 at the bottom-left in review");
      if (SHOTS !== "") await page.screenshot({ path: `${SHOTS}/review-turned.png` });
    });
  },
});

// What browser zoom leaves in CSS pixels: 1280×800 at 150%, 1440×900 at 200%,
// and a laptop at about 135%. A seat is only as wide as the board it edges,
// and these windows shrink the board.
const ZOOMED = [[853, 533], [720, 450], [740, 410]];

/** Every piece of text in each seat sits inside its bar and clear of the rest. */
const seatsHold = async (page: Page, when: string) => {
  const trouble: string[] = await page.evaluate(() => {
    const out: string[] = [];
    for (const seat of document.querySelectorAll(".seat")) {
      const bar = seat.getBoundingClientRect();
      const leaves = [...seat.querySelectorAll("*")]
        .filter((e) => e.children.length === 0 && (e.textContent ?? "").trim() !== "" && (e as HTMLElement).offsetParent !== null)
        .map((e) => ({ t: (e.textContent ?? "").trim().slice(0, 14), r: e.getBoundingClientRect() }));
      for (const { t, r } of leaves) if (r.top < bar.top - 1 || r.bottom > bar.bottom + 1) out.push(`"${t}" leaves its bar`);
      for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
        const a = leaves[i].r, b = leaves[j].r;
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push(`"${leaves[i].t}" overlaps "${leaves[j].t}"`);
      }
    }
    return out;
  });
  assert(trouble.length === 0, `${when}: ${trouble.join("; ")}`);
};

Deno.test({
  name: "under browser zoom each seat keeps its text inside its bar",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await onBoard(1280, 800, async (page) => {
      // A first game is against the house, whose seat carries a name, its
      // rating and its line.
      await page.waitForSelector('.table[data-mode="house"] .seat.top .elo:not(:empty)', { timeout: 20000 });
      for (const [w, h] of ZOOMED) {
        await page.setViewportSize({ width: w, height: h });
        await seatsHold(page, `against the house at ${w}x${h}`);
        if (SHOTS !== "") await page.screenshot({ path: `${SHOTS}/zoom-house-${w}x${h}.png` });
      }
    });
  },
});

// Against the house the opponent's seat carries its rating and a longer line.
// Otto is chosen on the card outright rather than trusted to be the default.
Deno.test({
  name: "at 1280x800 against the computer the seat shows the rating and the screen still fits",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await onBoard(1280, 800, async (page) => {
      const was = await setUp(page, [["mode", "house"], ["bot", "otto"], ["side", "white"]]);
      await oneGame(page, '[data-mode="house"][data-ply="0"]', was);
      await page.waitForFunction(() => document.querySelector(".seat.top .elo")?.textContent === "1050", undefined, { timeout: 20000 });
      assertEquals(await page.locator(".seat.top .nm span").first().textContent(), "Otto");
      await fits(page, "against the computer");
      if (SHOTS !== "") await page.screenshot({ path: `${SHOTS}/house-1280.png` });
    });
  },
});

// A guest who takes Black meets a house that moves at once, so the choice of
// the next opponent must not wait for anything: New game opens at ply 1.
Deno.test({
  name: "as Black against the house, New game changes the opponent after the house has moved",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await onBoard(1280, 800, async (page) => {
      const first = await setUp(page, [["mode", "house"], ["bot", "otto"], ["side", "black"]]);
      await oneGame(page, '[data-mode="house"][data-side="black"][data-ply="1"]', first);
      const was = await setUp(page, [["bot", "vera"]]);
      await oneGame(page, '[data-mode="house"][data-side="black"]', was);
      await page.waitForFunction(() => document.querySelector(".seat.top .elo")?.textContent === "1350", undefined, { timeout: 20000 });
      assertEquals(await page.locator(".seat.top .nm span").first().textContent(), "Vera");
      if (SHOTS !== "") await page.screenshot({ path: `${SHOTS}/black-vera-1280.png` });
    });
  },
});
