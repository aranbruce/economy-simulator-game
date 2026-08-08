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

export function BriefingBody({ data }: { data: BriefingData }) {
  const { impact, lines, footer, hint } = data;
  const hasImpact = !!(
    impact &&
    (impact.quiet || impact.economic || impact.approval || impact.politics)
  );

  return (
    <div className="mb-4 grid gap-3">
      {hasImpact && impact && (
        <div className="grid grid-cols-1 gap-2.5 min-[520px]:grid-cols-2">
          {impact.quiet ? (
            <div className="col-span-full rounded-md border border-accent/22 bg-accent/9 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
              <div className="mb-2 text-[10px] font-bold tracking-widest text-accent-lt uppercase">
                Year-ahead view
              </div>
              <p className="m-0 text-[15px] leading-[1.45] tracking-[-.015em] text-white">
                {impact.quiet}
              </p>
            </div>
          ) : (
            <>
              {impact.economic && (
                <div className="rounded-md border border-accent/22 bg-accent/9 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
                  <div className="mb-2 text-[10px] font-bold tracking-widest text-accent-lt uppercase">
                    Next year
                  </div>
                  <div className="-mt-1 mb-2 text-[11px] leading-[1.35] text-ink-faint">
                    Four-quarter total, not this quarter alone
                  </div>
                  <p className="m-0 text-[15px] leading-[1.45] tracking-[-.015em] text-white">
                    {impact.economic}
                  </p>
                </div>
              )}
              {(impact.approval || impact.politics) && (
                <div className="rounded-md border border-amber/24 bg-amber/8 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
                  <div className="mb-2 text-[10px] font-bold tracking-widest text-amber uppercase">
                    Approval
                  </div>
                  <div className="-mt-1 mb-2 text-[11px] leading-[1.35] text-ink-faint">
                    Four-quarter total, not this quarter alone
                  </div>
                  {impact.approval && (
                    <p className="m-0 text-[15px] leading-[1.45] tracking-[-.015em] text-white">
                      {impact.approval}
                    </p>
                  )}
                  {impact.politics && (
                    <p className="mt-2 mb-0 text-[15px] leading-[1.45] tracking-[-.015em] text-ink-soft italic">
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
          className={`rounded-xs border-l-3 py-0.5 pl-3.5 ${hasImpact ? "border-edge" : "border-accent"}`}
        >
          {hasImpact && (
            <div className="mb-2 text-[10px] font-bold tracking-widest text-ink-faint uppercase">
              This quarter
            </div>
          )}
          {lines.map((t, i) => (
            <p
              key={i}
              className={`m-0 mb-1.75 text-[15px] leading-[1.42] tracking-[-.015em] last:mb-0 ${hasImpact ? "text-ink" : "text-ink"}`}
            >
              {t}
            </p>
          ))}
        </div>
      )}
      {footer && (
        <div className="mt-0.5 text-[10.5px] font-medium text-ink-faint">
          {footer}
        </div>
      )}
      {hint && <p className="mt-2.5 text-[13px] text-ink-faint">{hint}</p>}
    </div>
  );
}
