"use client";

interface BriefingImpact {
  quiet: string | null;
  economic: string | null;
  approval: string | null;
  politics: string | null;
}

export interface BriefingData {
  impact: BriefingImpact | null;
  lines: string[];
  footer: string | null;
  hint: string | null;
}

export function BriefingBody({
  data,
  paper = false,
}: {
  data: BriefingData;
  paper?: boolean;
}) {
  const { impact, lines, footer, hint } = data;
  const hasImpact = !!(
    impact &&
    (impact.quiet || impact.economic || impact.approval || impact.politics)
  );

  const goldBox = paper
    ? "border-paper-border/22 bg-paper-border/5 shadow-none"
    : "border-accent/22 bg-accent/9 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]";
  const amberBox = paper
    ? "border-paper-accent/32 bg-paper-accent/8 shadow-none"
    : "border-amber/24 bg-amber/8 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]";
  const eyebrowGold = paper ? "text-paper-accent" : "text-accent-lt";
  const eyebrowAmber = paper ? "text-paper-accent" : "text-amber";
  const faint = paper ? "text-paper-ink-faint" : "text-ink-faint";
  const body = paper ? "text-paper-ink" : "text-white";
  const soft = paper ? "text-paper-ink-soft" : "text-ink-soft";
  const ink = paper ? "text-paper-ink" : "text-ink";
  const edge = paper ? "border-paper-border/22" : "border-edge";
  const accentEdge = paper ? "border-paper-accent" : "border-accent";

  return (
    <div className="mb-4 grid gap-3">
      {hasImpact && impact && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {impact.quiet ? (
            <div className={`col-span-full rounded-md border px-3.5 py-3 ${goldBox}`}>
              <div
                className={`mb-2 text-xs font-bold tracking-widest uppercase ${eyebrowGold}`}
              >
                Year-ahead view
              </div>
              <p
                className={`m-0 text-base leading-[1.45] tracking-[-.015em] ${body}`}
              >
                {impact.quiet}
              </p>
            </div>
          ) : (
            <>
              {impact.economic && (
                <div className={`rounded-md border px-3.5 py-3 ${goldBox}`}>
                  <div
                    className={`mb-2 text-xs font-bold tracking-widest uppercase ${eyebrowGold}`}
                  >
                    Next year
                  </div>
                  <div className={`-mt-1 mb-2 text-xs leading-[1.35] ${faint}`}>
                    Four-quarter total, not this quarter alone
                  </div>
                  <p
                    className={`m-0 text-base leading-[1.45] tracking-[-.015em] ${body}`}
                  >
                    {impact.economic}
                  </p>
                </div>
              )}
              {(impact.approval || impact.politics) && (
                <div className={`rounded-md border px-3.5 py-3 ${amberBox}`}>
                  <div
                    className={`mb-2 text-xs font-bold tracking-widest uppercase ${eyebrowAmber}`}
                  >
                    Approval
                  </div>
                  <div className={`-mt-1 mb-2 text-xs leading-[1.35] ${faint}`}>
                    Four-quarter total, not this quarter alone
                  </div>
                  {impact.approval && (
                    <p
                      className={`m-0 text-base leading-[1.45] tracking-[-.015em] ${body}`}
                    >
                      {impact.approval}
                    </p>
                  )}
                  {impact.politics && (
                    <p
                      className={`mt-2 mb-0 text-base leading-[1.45] tracking-[-.015em] italic ${soft}`}
                    >
                      {impact.politics}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {lines.length > 0 && (
        <div
          className={`rounded-xs border-l-3 py-0.5 pl-3.5 ${hasImpact ? edge : accentEdge}`}
        >
          {hasImpact && (
            <div className={`mb-2 text-xs font-bold tracking-widest uppercase ${faint}`}>
              This quarter
            </div>
          )}
          {lines.map((t, i) => (
            <p
              key={i}
              className={`m-0 mb-1.75 text-base leading-[1.42] tracking-[-.015em] last:mb-0 ${ink}`}
            >
              {t}
            </p>
          ))}
        </div>
      )}
      {footer && (
        <div className={`mt-0.5 text-xs font-medium ${faint}`}>
          {footer}
        </div>
      )}
      {hint && <p className={`mt-2.5 text-sm ${faint}`}>{hint}</p>}
    </div>
  );
}
