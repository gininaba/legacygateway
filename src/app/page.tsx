import { cookies } from "next/headers";
import { db } from "@/db";
import { bookmarks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { SID_COOKIE, ensureSession, mergeSettings } from "@/lib/session";
import { makeProxyPath } from "@/lib/urlrew";
import { Top, UrlBar, Wrap } from "./chrome";
import { CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";

const QUICK: Array<{ name: string; url: string; note: string }> = [
  { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Main_Page", note: "Encyclopedia — works beautifully, even in Full mode" },
  { name: "DuckDuckGo", url: "https://html.duckduckgo.com/html/", note: "Search engine with a server-rendered HTML interface" },
  { name: "Hacker News", url: "https://news.ycombinator.com/", note: "Tech news & discussion — nearly native feel" },
  { name: "Project Gutenberg", url: "https://www.gutenberg.org/", note: "70,000 free ebooks, readable on-page" },
  { name: "GitHub", url: "https://github.com/trending", note: "Browse code & repos (login is unlikely to survive)" },
  { name: "Stack Overflow", url: "https://stackoverflow.com/questions", note: "Q&A knowledge — reading works great" },
  { name: "Weather", url: "https://wttr.in/", note: "Minimal forecast page" },
  { name: "BBC News", url: "https://www.bbc.com/news", note: "Real news site — best in Lite mode" },
  { name: "MDN Web Docs", url: "https://developer.mozilla.org/", note: "Web technology reference" },
];

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const sid = cookieStore.get(SID_COOKIE)?.value || "";
  let settings = mergeSettings(null);
  let savedLinks: Array<{ id: number; url: string; title: string }> = [];
  if (sid) {
    const row = await ensureSession(sid);
    if (row) settings = mergeSettings(row.settings);
    try {
      savedLinks = await db
        .select()
        .from(bookmarks)
        .where(eq(bookmarks.sessionId, sid))
        .orderBy(desc(bookmarks.createdAt))
        .limit(6);
    } catch {
      savedLinks = [];
    }
  }

  return (
    <>
      <Top />
      <UrlBar />
      <Wrap>
        {sp.bad ? (
          <p className="lg-note">That didn&apos;t look like an address or search term. Try again.</p>
        ) : null}

        {savedLinks.length ? (
          <>
            <h2 className="lg-h2">SAVED BOOKMARKS</h2>
            <div className="lg-cards">
              {savedLinks.map((b) => (
                <a key={b.id} className="lg-card" href={makeProxyPath(new URL(b.url))}>
                  <b>{b.title || b.url}</b>
                  <span>{b.url}</span>
                </a>
              ))}
            </div>
          </>
        ) : null}

        <h2 className="lg-h2">PLACES THAT WORK WELL</h2>
        <div className="lg-cards">
          {QUICK.map((q) => (
            <a key={q.url} className="lg-card" href={makeProxyPath(new URL(q.url))}>
              <b>{q.name}</b>
              <span dangerouslySetInnerHTML={{ __html: q.note }} />
            </a>
          ))}
        </div>

        <h2 className="lg-h2">SYSTEM & REQUIREMENTS</h2>
        <div className="lg-panel">
          <h3>Legacy Web Compatibility Layer</h3>
          <p>
            Your browser from 2015 can no longer speak to the modern web: its TLS is rejected, its
            JavaScript engine cannot parse today&apos;s code, and half the CSS it receives is from the future.
            This gateway sits in the middle and translates:
          </p>
          <p className="lg-code">
            iPad Safari &rarr; LegacyGateway (Compatibility Gateway) &rarr; Modern Web (TLS 1.3)
          </p>
          <p className="lg-small">
            Current Mode: <b>{settings.mode === "lite" ? "Lite (guaranteed-readable rendering)" : "Full (rewritten real site)"}</b>
            {" — "}
            Images {settings.images ? "re-encoded for old WebKit" : "off"}, JS transpilation{" "}
            {settings.js ? "on (experimental)" : "off"}. Change in <a href="/settings">Settings</a>.
          </p>
          <p className="lg-small">
            Snapshot Mode:{" "}
            {CONFIG.browserlessToken ? (
              <span className="lg-ok">Remote browser configured (Browserless).</span>
            ) : (
              <span className="lg-warn">Remote browser not configured (set BROWSERLESS_TOKEN).</span>
            )}
            {" — "}
            <a href="/about">Read full feasibility report</a>.
          </p>
        </div>

        <h2 className="lg-h2">QUICK LINKS</h2>
        <div className="lg-cards">
          <a className="lg-card" href="/history">
            <b>History &amp; Bookmarks</b>
            <span>View past sessions and saved pages</span>
          </a>
          <a className="lg-card" href="/settings">
            <b>Compatibility Settings</b>
            <span>Toggle Lite mode, image quality, and JS transpilation</span>
          </a>
          <a className="lg-card" href="/snap">
            <b>Snapshot Mode</b>
            <span>Remote Chromium rendering for complex SPAs</span>
          </a>
          <a className="lg-card" href="/about">
            <b>How It Works</b>
            <span>12-category compatibility matrix and technical analysis</span>
          </a>
        </div>
      </Wrap>
    </>
  );
}
