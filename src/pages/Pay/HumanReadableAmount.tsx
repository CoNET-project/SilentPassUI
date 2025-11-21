import { useRef } from "react";

// --- 断行规则 ---
function splitReadable(readable: string, lang: "en" | "cn" | "ja") {
  if (lang === "en") {
    const m = readable.match(/\s+(and\s+\d{1,2}\/100\s+dollars)\s*$/i);
    if (m && m.index !== undefined && m.index > 0) {
      const firstLine = readable.slice(0, m.index).trim();
      const secondLine = m[1].trim();
      if (firstLine && firstLine.length > 10) {
        return [firstLine, secondLine];
      }
    }
  }
  if (lang === "cn") {
    const m = readable.match(/\s+(元(?:整|[零壹贰貳參叁肆伍陆陸柒捌玖〇一二三四五六七八九十百千万亿兆]*[角分]*)?)$/);
    if (m && m.index !== undefined && m.index > 0) {
      return [readable.slice(0, m.index).trim(), m[1]];
    }
  }
  if (lang === "ja") {
    const m = readable.match(/\s+(ドル(?:\s*\d+\s*セント)?|\s*ドルちょうど|\s*ドル\s*セント.*)\s*$/);
    if (m && m.index !== undefined && m.index > 0) {
      return [readable.slice(0, m.index).trim(), m[1].trim()];
    }
  }
  return [readable, ""];
}

export default function HumanReadableAmount({
  readable,
  lang,
}: {
  readable: string;
  lang: "en" | "cn" | "ja";
}) {
  const elRef = useRef<HTMLDivElement>(null);

  const cleanReadable = readable
    .replace(/\s+/g, " ")
    .trim();

  const [a, b] = splitReadable(cleanReadable, lang);
  const lines = { l1: a, l2: b || undefined };

  return (
    <div
      ref={elRef}
      className="
        mt-2 text-right 
        text-sm md:text-base lg:text-lg 
        font-semibold 
        text-current/50 
        whitespace-normal break-words leading-snug
      "
      title={readable}
    >
      {lines.l1}

      {lines.l2 ? (
        <>
          <br />
          {lines.l2}
        </>
      ) : null}
    </div>
  );
}
