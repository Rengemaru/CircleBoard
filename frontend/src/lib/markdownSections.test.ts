import { describe, it, expect } from "vitest";
import { splitSections } from "./markdownSections";

const lines = (...rows: string[]) => rows.join("\n");

describe("splitSections", () => {
  it("見出しが無いときは1つの節にまとめ、title は null にする", () => {
    expect(splitSections(lines("ただの文章です。", "2行目。"))).toEqual([
      { title: null, body: lines("ただの文章です。", "2行目。") },
    ]);
  });

  it("# ごとに節へ分ける", () => {
    const source = lines("# このイベントについて", "LT会です。", "", "# 参加対象", "誰でも。");
    expect(splitSections(source)).toEqual([
      { title: "このイベントについて", body: "LT会です。" },
      { title: "参加対象", body: "誰でも。" },
    ]);
  });

  it("最初の見出しより前に書かれた文は title を持たない節になる", () => {
    const source = lines("前書き。", "# 本題", "中身。");
    expect(splitSections(source)).toEqual([
      { title: null, body: "前書き。" },
      { title: "本題", body: "中身。" },
    ]);
  });

  it("## は節の区切りにしない", () => {
    // 見出しは1段だけという決まり。## は本文の一部として残す
    const source = lines("# 本題", "## 小見出し", "中身。");
    expect(splitSections(source)).toEqual([
      { title: "本題", body: lines("## 小見出し", "中身。") },
    ]);
  });

  it("中身の無い節も残す", () => {
    // 雛形をそのまま保存した状態。節を作った意図は消さない
    expect(splitSections(lines("# 見出しだけ", ""))).toEqual([{ title: "見出しだけ", body: "" }]);
  });

  it("コードブロックの中の # は見出しにしない", () => {
    const source = lines("# 本題", "```sh", "# コメント", "```", "続き。");
    expect(splitSections(source)).toEqual([
      { title: "本題", body: lines("```sh", "# コメント", "```", "続き。") },
    ]);
  });

  it("~~~ で開いたフェンスは ``` では閉じない", () => {
    const source = lines("# 本題", "~~~", "```", "# まだコードの中", "~~~", "# 次の節");
    expect(splitSections(source)).toEqual([
      { title: "本題", body: lines("~~~", "```", "# まだコードの中", "~~~") },
      { title: "次の節", body: "" },
    ]);
  });

  it("# のあとに空白が無いものは見出しにしない", () => {
    expect(splitSections("#あああ")).toEqual([{ title: null, body: "#あああ" }]);
  });

  it("見出しの前後の空白は落とす", () => {
    expect(splitSections("#    余白あり   ")).toEqual([{ title: "余白あり", body: "" }]);
  });

  it("空文字は空の配列を返す", () => {
    // 呼び出し側(PostDescription)がここで空のパネルを出さずに済む
    expect(splitSections("")).toEqual([]);
  });
});
