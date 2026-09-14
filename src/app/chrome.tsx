import type { ReactNode } from "react";

/** Shared chrome for the gateway's own UI. Renders to plain HTML —
 *  no client JS required anywhere, every control is a real link or form. */

export function Top(props: { slim?: boolean }) {
  return (
    <div className={props.slim ? "lg-top lg-top-slim" : "lg-top"}>
      <div className="lg-nav">
        <a href="/">Home</a>
        <a href="/history">History &amp; Bookmarks</a>
        <a href="/settings">Settings</a>
        <a href="/snap">Snapshot Mode</a>
        <a href="/about">How it works</a>
      </div>
      <h1 className="lg-brand">
        <a href="/">
          Legacy<b>Gateway</b>
        </a>
      </h1>
      {props.slim ? null : (
        <p className="lg-tag">
          The modern web, translated for a 2015 browser. Type an address — the gateway fetches it
          with a modern TLS stack, rewrites what old WebKit can&apos;t digest, and serves it back
          in a form your iPad mini understands.
        </p>
      )}
      <div className="lg-clear" />
    </div>
  );
}

export function UrlBar(props: { compact?: boolean }) {
  return (
    <div className="lg-wrap">
      <div className="lg-urlbar">
        <form action="/navigate" method="get" className="lg-form">
          <input
            className="lg-in"
            type="text"
            name="q"
            placeholder="Address or search — e.g. wikipedia.org"
            autoCorrect="off"
            autoCapitalize="off"
          />
          <div className="lg-row">
            <button type="submit" className="lg-btn">
              Go
            </button>
            <select className="lg-sel" name="e" defaultValue="ddg">
              <option value="ddg">Search: DuckDuckGo</option>
              <option value="google">Search: Google</option>
              <option value="bing">Search: Bing</option>
              <option value="wikipedia">Search: Wikipedia</option>
            </select>
          </div>
        </form>
        {props.compact ? null : (
          <div className="lg-hint">
            Plain-language search terms work too. Sites open through the compatibility layer —
            links, images and forms keep working as you navigate.
          </div>
        )}
      </div>
    </div>
  );
}

export function Wrap(props: { children: ReactNode }) {
  return <div className="lg-wrap">{props.children}</div>;
}
