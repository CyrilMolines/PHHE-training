#!/usr/bin/env node
/**
 * WHO Academy Coursewares Scraper
 * Fetches all trainings from https://whoacademy.org/coursewares across paginated pages
 * and extracts metadata (title, link, description, etc.).
 *
 * Usage: npm run scrape   or   node scrape.js
 * Options: --dry-run (only fetch 1 page), --max-pages N (limit pages), --out FILE (output path), --debug (dump page info)
 */

const fs = require("fs");
const path = require("path");

const BASE_URL = "https://whoacademy.org/coursewares";
const DEFAULT_OUT = path.join(__dirname, "who-academy-coursewares.json");

async function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, maxPages: 99, out: DEFAULT_OUT, debug: false, cookiesFile: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") opts.dryRun = true;
    else if (args[i] === "--debug") opts.debug = true;
    else if (args[i] === "--cookies" && args[i + 1]) {
      opts.cookiesFile = args[i + 1];
      i++;
    }
    else if (args[i] === "--max-pages" && args[i + 1]) {
      opts.maxPages = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--out" && args[i + 1]) {
      opts.out = args[i + 1];
      i++;
    }
  }
  return opts;
}

/**
 * Extract course cards from the page DOM.
 * WHO Academy uses Open edX / frontend-app-learning; structure may vary.
 * Adapt selectors based on actual page structure.
 */
async function extractCoursesFromPage(page) {
  return page.evaluate(() => {
    const courses = [];
    const seen = new Set();

    // 1. All links to courseware pages
    // Support both /coursewares/course-v1: and /coursewares/course/
    const links = document.querySelectorAll('a[href*="/coursewares/course-v1:"], a[href*="/coursewares/course/"]');

    for (const a of links) {
      const href = a.href;
      if (seen.has(href)) continue;
      seen.add(href);

      let title = "";
      let description = "";

      const card = a.closest(
        "article, [role='article'], [class*='card'], [class*='course'], [class*='CourseCard'], [class*='SearchResult']"
      ) || a.parentElement;

      if (card) {
        const h = card.querySelector("h2, h3, h4, h5, [class*='title'], [class*='Title'], [class*='name']");
        title = h ? (h.textContent || "").trim() : "";
        const descEl = card.querySelector("[class*='description'], [class*='summary'], [class*='Description'], p");
        description = descEl ? (descEl.textContent || "").trim().slice(0, 500) : "";
      }

      if (!title) title = (a.textContent || "").trim().slice(0, 200);
      if (!title) title = href.split("/").pop()?.replace(/course-v1:/, "") || "Unknown";

      courses.push({
        title,
        link: href.split("?")[0],
        normalizedLink: href,
        description,
        platform: "WHO Academy",
        source: "whoacademy.org"
      });
    }

    return courses;
  });
}

/**
 * Get total page count from pagination (e.g. "Page 1 of 19" or last page number).
 */
async function getTotalPages(page) {
  return page.evaluate(() => {
    const pagination = document.querySelector("[class*='pagination'], [aria-label*='pagination'], nav[aria-label*='Page']");
    if (!pagination) return 1;
    const text = pagination.textContent || "";
    const match = text.match(/of\s*(\d+)/i);
    return match ? Math.min(parseInt(match[1], 10), 99) : 1;
  });
}

async function scrape(opts) {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const allCourses = [];
  const seenLinks = new Set();
  let totalPages = 19; // default; will be updated from first page

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 800 });

    if (opts.cookiesFile && fs.existsSync(opts.cookiesFile)) {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 10000 });
      const cookies = JSON.parse(fs.readFileSync(opts.cookiesFile, "utf-8"));
      const puppeteerCookies = (Array.isArray(cookies) ? cookies : cookies.cookies || cookies)
        .filter((c) => c.name && c.value)
        .map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain || ".whoacademy.org",
          path: c.path || "/"
        }));
      await page.setCookie(...puppeteerCookies);
      console.log(`Loaded ${puppeteerCookies.length} cookies from ${opts.cookiesFile}`);
    }

    for (let p = 1; p <= totalPages; p++) {
      const url = p === 1 ? BASE_URL : `${BASE_URL}?page=${p}`;
      console.log(`Fetching page ${p}... ${url}`);

      await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
      await new Promise((r) => setTimeout(r, 2000));

      if (p === 1) {
        const detected = await getTotalPages(page);
        if (detected > 1) totalPages = detected;
        console.log(`Detected ${totalPages} pages`);
      }

      if (opts.debug && p === 1) {
        const debugInfo = await page.evaluate(() => {
          const allLinks = [...document.querySelectorAll("a[href]")].map((a) => ({
            href: a.href,
            text: a.textContent?.slice(0, 80),
            dataset: Object.assign({}, a.dataset)
          }));
          const withCourseId = allLinks.filter((l) => l.href.includes("course-v1") || (l.dataset && Object.keys(l.dataset).length));
          const byHref = {};
          allLinks.forEach((l) => { byHref[l.href] = (byHref[l.href] || 0) + 1; });
          const scripts = [...document.querySelectorAll("script")].map((s) => ({
            src: s.src,
            hasContent: !!s.textContent?.length,
            contentSnippet: s.textContent?.slice(0, 300)
          }));
          const nextData = document.getElementById("__NEXT_DATA__");
          const embeddedJson = nextData ? nextData.textContent : null;
          const courseDataMatches = [...document.documentElement.innerHTML.matchAll(/"course[_\-]?[Ii]d"|"key":\s*"course-v1:[^"]+"/g)];
          return {
            url: location.href,
            sampleLinks: allLinks.slice(0, 5),
            withCourseId: withCourseId.slice(0, 5),
            hasNextData: !!nextData,
            embeddedJsonLength: embeddedJson ? embeddedJson.length : 0,
            courseDataMatches: courseDataMatches.slice(0, 10).map((m) => m[0])
          };
        });
        console.log("Debug:", JSON.stringify(debugInfo, null, 2));
      }

      const courses = await extractCoursesFromPage(page);
      let newCount = 0;
      for (const c of courses) {
        if (!seenLinks.has(c.normalizedLink)) {
          seenLinks.add(c.normalizedLink);
          allCourses.push({ ...c, page: p });
          newCount++;
        }
      }
      console.log(`  Found ${courses.length} courses, ${newCount} new`);

      if (opts.dryRun) break;
      if (p >= opts.maxPages) break;

      await new Promise((r) => setTimeout(r, 800));
    }

    await browser.close();
  } catch (err) {
    await browser.close();
    throw err;
  }

  return allCourses;
}

async function main() {
  const opts = await parseArgs();
  console.log("WHO Academy Coursewares Scraper");
  console.log("Options:", opts);
  console.log("");

  const courses = await scrape(opts);
  console.log(`\nTotal unique courses: ${courses.length}`);

  const output = {
    meta: {
      source: "https://whoacademy.org/coursewares",
      scrapedAt: new Date().toISOString(),
      totalCourses: courses.length
    },
    courses
  };

  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  fs.writeFileSync(opts.out, JSON.stringify(output, null, 2), "utf-8");
  console.log(`Written to ${opts.out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
