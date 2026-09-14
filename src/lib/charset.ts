import iconv from "iconv-lite";

/**
 * Upstream pages come in every encoding from the last 30 years (Shift_JIS,
 * GB2312, windows-1251, KOI8-R...). Old WebKit is surprisingly okay at
 * decoding them, but WE need to parse and rewrite the bytes — so we decode
 * everything to unicode once and serve uniform UTF-8 downstream.
 */
export function sniffCharset(contentType: string | null, head: Buffer): string {
  const fromHeader = /charset=([\w.-]+)/i.exec(contentType || "");
  if (fromHeader && iconv.encodingExists(fromHeader[1])) return fromHeader[1];
  const sample = head.subarray(0, 4096).toString("latin1");
  const m = /<meta[^>]+charset=["']?\s*([\w.-]+)/i.exec(sample);
  if (m && iconv.encodingExists(m[1])) return m[1];
  return "utf-8";
}

export function decodeBody(buf: Buffer, contentType: string | null): string {
  const charset = sniffCharset(contentType, buf);
  try {
    return iconv.decode(buf, charset);
  } catch {
    return buf.toString("utf8");
  }
}
