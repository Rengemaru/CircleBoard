// 概要を「見出し1ごとの節」に分ける（Issue #303）。
//
// 参考にした SmartHR の採用ページのように「見出しは枠の外、中身は枠の中」で
// 出すために使う。**囲む形を作るのは呼び出し側**で、ここは切るだけ。

// コードフェンスの開始/終了。``` と ~~~ の両方、3個以上、行頭0〜3スペース。
// markdown.ts の FENCE と同じ判定だが、あちらは export していないので持つ。
// **片方だけ直すとズレる**ので、変えるときは両方見ること
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

// 見出し1の行。**# がちょうど1個のときだけ。** ## 以降は見出しとして
// 扱わない決まり（オーナー決定 2026-09-13）なので、節の区切りにもしない
const TOP_HEADING = /^ {0,3}#\s+(.*)$/;

export type MarkdownSection = {
  // 最初の見出しより前に書かれた文は title を持たない
  title: string | null;
  body: string;
};

/**
 * `# 見出し` ごとに節へ分ける。
 *
 * コードブロックの中の `#` は見出しにしない。コードとして書かれたものを
 * 壊さないため（escapeSubHeadings と同じ理由）。
 */
export function splitSections(source: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  let title: string | null = null;
  let lines: string[] = [];
  let inFence = false;
  let fenceMarker = "";

  const flush = () => {
    const body = lines.join("\n").trim();
    // 見出しだけで中身が無い節も残す。節を作った意図は残す
    if (title !== null || body !== "") sections.push({ title, body });
    lines = [];
  };

  for (const line of source.split("\n")) {
    const fence = line.match(FENCE);
    if (fence) {
      const marker = fence[1][0];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
      }
      lines.push(line);
      continue;
    }

    const heading = inFence ? null : line.match(TOP_HEADING);
    if (heading) {
      flush();
      title = heading[1].trim();
      continue;
    }
    lines.push(line);
  }
  flush();

  return sections;
}
