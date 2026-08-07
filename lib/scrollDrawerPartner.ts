/** Scroll the policy drawer to a partner card (trade or diplomacy). */

/** Live drawer body — never use a stale cached ref from registerEl. */
export function drawerBodyEl(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById("drawerBody");
}

export function partnerCardEl(partnerId: string, host?: Element | null) {
  const root = host || drawerBodyEl();
  if (!root || !partnerId) return null;
  return root.querySelector('[data-partner-card="' + partnerId + '"]');
}

export function scrollDrawerPartnerCard(
  partnerId: string,
  host?: Element | null,
) {
  const root = host || drawerBodyEl();
  if (!root || !partnerId) return false;
  const el = partnerCardEl(partnerId, root);
  if (!el) return false;
  const y =
    el.getBoundingClientRect().top -
    root.getBoundingClientRect().top +
    root.scrollTop -
    56;
  const top = Math.max(0, y);
  root.scrollTo({ top, behavior: "smooth" });
  return true;
}

interface QueueScrollOpts {
  maxTries?: number;
  delay?: number;
}

/** Retry until the card exists and layout has settled (drawer animation, React paint). */
export function queueDrawerPartnerScroll(
  partnerId: string,
  opts?: QueueScrollOpts,
) {
  const maxTries = (opts && opts.maxTries) || 30;
  const delay = (opts && opts.delay) || 50;
  let tries = 0;
  const run = () => {
    tries += 1;
    if (scrollDrawerPartnerCard(partnerId)) return;
    if (tries < maxTries) window.setTimeout(run, delay);
  };
  window.setTimeout(
    () => window.requestAnimationFrame(() => window.requestAnimationFrame(run)),
    120,
  );
}
