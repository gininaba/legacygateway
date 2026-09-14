import { Top, Wrap } from "../../chrome";

export const dynamic = "force-dynamic";

/** Old-WebKit-friendly keyboard page for one remote form field. */
export default async function SnapTypePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const u = sp.u || "";
  const sel = sp.sel || "";
  const act = sp.act === "click" ? "click" : "type";
  const label = sp.label || "field";

  return (
    <>
      <Top slim />
      <Wrap>
        <h2 className="lg-h2">
          {act === "click" ? "Press this button in the remote page" : "Type into the remote page"}
        </h2>
        <div className="lg-panel">
          <p>
            Target: <b>{label}</b> on <span className="lg-code">{u}</span>
          </p>
          <form className="lg-form" action="/snap/view" method="get">
            <input type="hidden" name="u" value={u} />
            <input type="hidden" name="tsel" value={sel} />
            {act === "click" ? (
              <input type="hidden" name="act" value="click" />
            ) : (
              <>
                <label className="lg-field">
                  Text
                  <input className="lg-in-s" type="text" name="tval" autoCorrect="off" autoCapitalize="off" />
                </label>
                <label className="lg-field">
                  <input type="checkbox" name="tenter" value="1" defaultChecked /> Press Enter
                  afterwards
                </label>
              </>
            )}
            <button className="lg-btn" type="submit">
              {act === "click" ? "Press it" : "Send text"}
            </button>{" "}
            <a href={`/snap/view?u=${encodeURIComponent(u)}`} className="lg-small">
              cancel
            </a>
          </form>
          <p className="lg-small">
            Snapshot Mode is remote-by-design: your keystrokes never run in your iPad&apos;s old
            browser, they are typed into a current Chromium in the cloud.
          </p>
        </div>
      </Wrap>
    </>
  );
}
