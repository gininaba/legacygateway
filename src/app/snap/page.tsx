import { CONFIG } from "@/lib/config";
import { Top, Wrap } from "../chrome";

export const dynamic = "force-dynamic";

export default function SnapPage() {
  const configured = !!CONFIG.browserlessToken;
  return (
    <>
      <Top slim />
      <Wrap>
        <h2 className="lg-h2">Snapshot Mode — a real modern browser, one frame at a time</h2>

        {configured ? (
          <div className="lg-panel">
            <form className="lg-form" action="/snap/view" method="get">
              <label className="lg-field">
                Address to render in remote Chrome
                <input
                  className="lg-in-s"
                  type="text"
                  name="u"
                  placeholder="https://www.example.com"
                  autoCorrect="off"
                  autoCapitalize="off"
                />
              </label>
              <button className="lg-btn" type="submit">
                Render snapshot
              </button>
            </form>
            <p className="lg-small">
              Each interaction spins up a fresh cloud Chromium, so expect ~5–10 seconds per step.
              Logins persist between steps via isolated server-side cookie storage.
            </p>
          </div>
        ) : (
          <div className="lg-note">
            The remote browser is not configured on this deployment. Set{" "}
            <span className="lg-code">BROWSERLESS_TOKEN</span> (and optionally{" "}
            <span className="lg-code">BROWSERLESS_ENDPOINT</span>) from a hosted
            Chromium/CDP provider (e.g. Browserless) and redeploy. This is the one external service
            the full vision needs — a serverless function cannot keep a browser alive between your
            clicks.
          </div>
        )}

        <div className="lg-panel">
          <h3>How it works</h3>
          <p>
            Snapshot Mode exists for sites no proxy can save: full SPA apps, WebGL dashboards,
            aggressive anti-legacy JavaScript. Instead of shipping the site to your iPad (which
            cannot run it), the site is executed in a current Chromium in the cloud. You receive
            screen-filling still photographs of the page, with invisible tap-targets over every
            link and input:
          </p>
          <ul>
            <li>Tap a link region → the cloud browser navigates and sends the next frame.</li>
            <li>Tap a form field → an old-WebKit-friendly keyboard page sends your text.</li>
            <li>Scroll buttons page through the document; Back retraces your steps.</li>
          </ul>
          <p className="lg-small">
            Think of it as the honest, Vercel-compatible version of &quot;remote browsing&quot;:
            not a live video stream (that needs a persistent server Vercel doesn&apos;t offer), but
            a click-by-click remote viewer that genuinely works for almost everything — just
            slowly.
          </p>
        </div>
      </Wrap>
    </>
  );
}
