import { CheckCircle2 } from "lucide-react";

function isArabic(text: string) {
  return /[؀-ۿ]/.test(text);
}

/** Renders a confirmation/proposal message as readable blocks instead of one flat
 * wall of text: consecutive "•" lines become a checklist, paragraphs stay paragraphs,
 * and a language divider appears wherever the text switches between English/Arabic. */
export function FormattedMessage({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).filter((b) => b.trim());
  const dirs = blocks.map((block): "ltr" | "rtl" => (isArabic(block) ? "rtl" : "ltr"));

  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const dir = dirs[i];
        const showDivider = i > 0 && dirs[i - 1] !== dir;
        const isBulletBlock = lines.length > 0 && lines.every((l) => l.trim().startsWith("•"));

        return (
          <div key={i}>
            {showDivider && (
              <div className="mb-4 flex items-center gap-2">
                <div className="h-px flex-1" style={{ background: "var(--border)" }} />
                <span
                  className="text-[10px] font-medium uppercase tracking-wide"
                  style={{ color: "var(--text-faint)" }}
                >
                  {dir === "rtl" ? "العربية" : "English"}
                </span>
                <div className="h-px flex-1" style={{ background: "var(--border)" }} />
              </div>
            )}
            {isBulletBlock ? (
              <ul dir={dir} className="flex flex-col gap-2.5">
                {lines.map((line, j) => (
                  <li
                    key={j}
                    className="flex items-start gap-2.5 text-sm leading-relaxed"
                    style={{ color: "var(--text)" }}
                  >
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: "var(--success)" }} />
                    <span>{line.replace(/^•\s*/, "")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p dir={dir} className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                {block}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
