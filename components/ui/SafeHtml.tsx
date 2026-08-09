"use client";

import { createElement, useMemo, type ReactNode } from "react";

/**
 * Authored despatch/coach copy comes out of engine.js as small, hand-built
 * HTML strings (dynamic bits already run through esc()). This renders that
 * markup as real React elements instead of dangerouslySetInnerHTML: parse
 * with DOMParser (inert — no scripts, no attribute-driven execution), then
 * walk the tree through an explicit tag allowlist. Unknown tags fall back to
 * their text content rather than being dropped silently.
 */
const ALLOWED_TAGS = new Set([
  "p",
  "b",
  "em",
  "strong",
  "span",
  "div",
  "ul",
  "ol",
  "li",
  "h3",
  "h4",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "br",
  "small",
]);

/** `key` is the node's root-relative path (e.g. "0-1-2"), not a per-level
 * index — a plain per-level index would collide when an unallowed tag's
 * children splice directly into their parent's child list (see below). */
function domNodeToReact(node: ChildNode, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const children = Array.from(el.childNodes).map((child, i) =>
    domNodeToReact(child, `${key}-${i}`),
  );
  if (!ALLOWED_TAGS.has(tag)) return children;
  const props: Record<string, any> = { key };
  const cls = el.getAttribute("class");
  if (cls) props.className = cls;
  return createElement(tag, props, ...children);
}

function parse(html: string): ReactNode[] {
  if (!html || typeof window === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.body.childNodes).map((n, i) =>
    domNodeToReact(n, String(i)),
  );
}

export function SafeHtml({ html }: { html: string }) {
  const tree = useMemo(() => parse(html), [html]);
  return <>{tree}</>;
}
