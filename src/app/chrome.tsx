import type { ReactNode } from "react";

/** Shared chrome for the gateway's own UI. Renders to plain HTML —
 *  no client JS required anywhere, every control is a real link or form. */

export function Top(props: { slim?: boolean }) {
  return (
    <>
      <div className={props.slim ? "lg-top lg-top-slim" : "lg-top"}>
        <h1 className="lg-brand">
          <a href="/">
            Legacy<b>Gateway</b>
          </a>
        </h1>
        <div className="lg-nav">
          <a href="/">Home</a>
          <a href="/history">History &amp; Bookmarks</a>
          <a href="/settings">Settings</a>
          <a href="/snap">Snapshot Mode</a>
          <a href="/about">How it works</a>
        </div>
        <div className="lg-clear" />
      </div>
      {props.slim ? null : (
        <div className="lg-app-header">
          <div className="lg-app-icon">LG</div>
          <div className="lg-app-info">
            <div className="lg-app-title">Legacy Gateway</div>
            <div className="lg-app-ver">Version 1.0 — iOS 6–10 WebKit Gateway</div>
            <div className="lg-app-desc">
              The modern web, translated for a 2015 browser. Type an address or search term below to browse through the compatibility layer.
            </div>
          </div>
          <div className="lg-clear" />
        </div>
      )}
    </>
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
            In Cydia / Safari, paste or type any website address above to load it via Legacy Gateway.
          </div>
        )}
      </div>
    </div>
  );
}

export function Wrap(props: { children: ReactNode }) {
  return <div className="lg-wrap">{props.children}</div>;
}
