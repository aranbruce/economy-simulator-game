import assert from "node:assert/strict";
import {
  scrollDrawerPartnerCard,
  partnerCardEl,
} from "../lib/scrollDrawerPartner.ts";

{
  const host = {
    scrollTop: 0,
    scrollHeight: 2000,
    innerHTML:
      '<div class="card" data-partner-card="france" id="partner-diplo-france">France</div>',
    getBoundingClientRect: () => ({ top: 100, height: 400 }),
    querySelector(sel) {
      return this.innerHTML.includes("data-partner-card=\"france\"")
        ? {
            getBoundingClientRect: () => ({ top: 900 }),
            classList: { add() {}, remove() {} },
          }
        : null;
    },
    scrollTo(o) {
      this.scrollTop = o.top;
    },
  };
  global.document = {
    getElementById: (id) => (id === "drawerBody" ? host : null),
  };
  global.window = {
    setTimeout: (fn) => fn(),
    localStorage: { getItem: () => null },
  };

  assert(partnerCardEl("france", host), "finds partner by data-partner-card");
  assert(
    scrollDrawerPartnerCard("france", host),
    "scrolls to diplomacy partner card"
  );
  assert(host.scrollTop > 0, "scrollTop moved");
  console.log("scrollDrawerPartner: ok");
}
