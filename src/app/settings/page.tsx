import { cookies } from "next/headers";
import { SID_COOKIE, ensureSession, mergeSettings } from "@/lib/session";
import { Top, UrlBar, Wrap } from "../chrome";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const sid = cookieStore.get(SID_COOKIE)?.value || "";
  const row = sid ? await ensureSession(sid) : null;
  const s = mergeSettings(row?.settings);

  return (
    <>
      <Top slim />
      <UrlBar compact />
      <Wrap>
        <h2 className="lg-h2">Compatibility settings</h2>
        {sp.ok ? <p className="lg-note">Settings saved.</p> : null}
        <div className="lg-panel">
          <form className="lg-form" action="/settings/save" method="post">
            <h3>Rendering mode</h3>
            <label className="lg-field">
              <input type="radio" name="mode" value="full" defaultChecked={s.mode === "full"} />
              <b>Full mode</b> — the real site, rewritten. Layouts mostly survive; modern scripts
              usually don&apos;t. Best for Wikipedia, GitHub, blogs, docs.
            </label>
            <label className="lg-field">
              <input type="radio" name="mode" value="lite" defaultChecked={s.mode === "lite"} />
              <b>Lite mode</b> — guaranteed-readable re-typeset. Strips all site CSS/JS and serves
              clean text + images + working links &amp; forms. Best for heavy news sites.
            </label>

            <hr className="lg-hr" />
            <h3>Images</h3>
            <label className="lg-field">
              <input type="checkbox" name="images" value="1" defaultChecked={s.images} />
              Re-encode images (WebP/AVIF &rarr; JPEG/PNG, capped width). Disable to save time &amp;
              your iPad&apos;s memory.
            </label>
            <label className="lg-field">
              Max image width
              <select name="imw" defaultValue={String(s.imw)}>
                <option value="768">768 px (fastest)</option>
                <option value="1100">1100 px</option>
                <option value="1600">1600 px</option>
              </select>
            </label>

            <hr className="lg-hr" />
            <h3>JavaScript — experimental</h3>
            <label className="lg-field">
              <input type="checkbox" name="js" value="1" defaultChecked={s.js} />
              Transpile site JavaScript to ES5 (Babel → Safari 9) and inject core-js/fetch
              polyfills. Slow on first fetch per file (cached after). Rescues some moderately
              modern sites; cannot resurrect full SPAs.
            </label>

            <hr className="lg-hr" />
            <label className="lg-field">
              <input type="checkbox" name="toolbar" value="1" defaultChecked={s.toolbar} />
              Show the gateway toolbar at the bottom of proxied pages
            </label>

            <button className="lg-btn" type="submit">
              Save settings
            </button>
          </form>
        </div>
        <div className="lg-panel">
          <h3>Session</h3>
          <p className="lg-small">
            Your cookies, settings and history live server-side under an anonymous session id and
            never touch Safari&apos;s storage. Clear everything:
          </p>
          <form className="lg-form" action="/session/wipe" method="post">
            <button className="lg-linkbtn" type="submit">
              Wipe my session data (cookies, history, bookmarks)
            </button>
          </form>
        </div>
      </Wrap>
    </>
  );
}
