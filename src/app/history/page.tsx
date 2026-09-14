import { cookies } from "next/headers";
import { db } from "@/db";
import { history, bookmarks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { SID_COOKIE } from "@/lib/session";
import { makeProxyPath } from "@/lib/urlrew";
import { Top, UrlBar, Wrap } from "../chrome";

export const dynamic = "force-dynamic";

interface HistRow {
  id: number;
  url: string;
  title: string;
  mode: string;
  createdAt: Date;
}

export default async function HistoryPage() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SID_COOKIE)?.value || "";

  let rows: HistRow[] = [];
  let marks: Array<{ id: number; url: string; title: string; createdAt: Date }> = [];
  if (sid) {
    try {
      rows = await db
        .select()
        .from(history)
        .where(eq(history.sessionId, sid))
        .orderBy(desc(history.createdAt))
        .limit(400);
      marks = await db
        .select()
        .from(bookmarks)
        .where(eq(bookmarks.sessionId, sid))
        .orderBy(desc(bookmarks.createdAt))
        .limit(100);
    } catch {
      /* empty state */
    }
  }

  // De-duplicate consecutive re-visits for readability.
  const seen = new Set<string>();
  const deduped: HistRow[] = [];
  for (const r of rows) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    deduped.push(r);
    if (deduped.length >= 60) break;
  }

  return (
    <>
      <Top slim />
      <UrlBar compact />
      <Wrap>
        <h2 className="lg-h2">Bookmarks</h2>
        <div className="lg-panel">
          {marks.length === 0 ? (
            <p className="lg-small">
              Nothing saved yet. Use the <i>&#9734; Save</i> button next to any history entry.
            </p>
          ) : (
            <ul className="lg-list">
              {marks.map((b) => (
                <li key={b.id}>
                  <a href={makeProxyPath(new URL(b.url))}>{b.title || b.url}</a>
                  <span className="lg-muted">{b.url}</span>
                  <form method="post" action="/bookmark/del" style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={String(b.id)} />
                    <button className="lg-linkbtn" type="submit">
                      remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>

        <h2 className="lg-h2">History</h2>
        <div className="lg-panel">
          {deduped.length === 0 ? (
            <p className="lg-small">Pages you open through the gateway will appear here.</p>
          ) : (
            <ul className="lg-list">
              {deduped.map((r) => (
                <li key={r.id}>
                  <a href={makeProxyPath(new URL(r.url))}>{r.title || r.url}</a>
                  <span className="lg-muted">
                    {r.url} — {r.mode} mode — {r.createdAt.toISOString().replace("T", " ").slice(0, 16)}
                  </span>
                  <form method="post" action="/bookmark/add" style={{ display: "inline" }}>
                    <input type="hidden" name="u" value={r.url} />
                    <input type="hidden" name="t" value={r.title} />
                    <button className="lg-linkbtn lg-linkbtn-save" type="submit">
                      &#9734; Save
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {rows.length ? (
            <form method="post" action="/history/clear" style={{ marginTop: 14 }}>
              <button className="lg-linkbtn" type="submit">
                Clear history
              </button>
            </form>
          ) : null}
        </div>
      </Wrap>
    </>
  );
}
