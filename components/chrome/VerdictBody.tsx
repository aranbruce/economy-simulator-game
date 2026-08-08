"use client";

export interface VerdictData {
  grade?: string;
  lede: string[];
  rows?: [string, string][];
}

export function VerdictBody({ data }: { data: VerdictData }) {
  const { grade, lede, rows } = data;
  return (
    <div className="text-center">
      {grade && (
        <div className="font-display text-[68px] leading-none font-normal tracking-[-.03em] text-accent-lt">
          {grade}
        </div>
      )}
      <div className="my-2 mb-3.75 text-left text-base leading-[1.45] text-ink-soft">
        {lede.map((p, i) => (
          <p key={i} className="m-0 mb-2 last:mb-0">
            {p}
          </p>
        ))}
      </div>
      {rows && rows.length > 0 && (
        <table className="w-full border-collapse text-left text-[12.5px]">
          <tbody>
            {rows.map(([label, value], i) => (
              <tr key={i}>
                <td className="border-b border-white/6 py-1.5 text-ink-soft">
                  {label}
                </td>
                <td className="border-b border-white/6 py-1.5 text-right font-[650] text-white">
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
