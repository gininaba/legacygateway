import { Top, Wrap } from "../chrome";

export const dynamic = "force-dynamic";

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <>
      <Top slim />
      <Wrap>
        <h2 className="lg-h2">Gateway access</h2>
        <div className="lg-panel">
          <p>
            This gateway is private. Enter the access key to continue. (The key exists because an
            open web proxy on the public internet is an abuse magnet — see the security notes in
            the <a href="/about">report</a>.)
          </p>
          {sp.err ? <p className="lg-note">Wrong key.</p> : null}
          <form className="lg-form" action="/gate/submit" method="post">
            <label className="lg-field">
              Access key
              <input className="lg-in-s" type="password" name="key" autoCapitalize="off" />
            </label>
            <button className="lg-btn" type="submit">
              Enter
            </button>
          </form>
        </div>
      </Wrap>
    </>
  );
}
