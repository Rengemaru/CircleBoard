import { describe, it, expect } from "vitest";
import { escapeSubHeadings, toPlainText } from "./markdown";

// 複数行の入力を読みやすく組み立てる。テンプレートリテラルを使わないのは、
// 中にコードフェンス(```)が入るため
const lines = (...rows: string[]) => rows.join("\n");

describe("escapeSubHeadings", () => {
  it("## 以降の見出しを文字に変える", () => {
    expect(escapeSubHeadings("## 見出し2")).toBe("\\## 見出し2");
    expect(escapeSubHeadings("###### 見出し6")).toBe("\\###### 見出し6");
  });

  it("# は見出しのまま残す", () => {
    expect(escapeSubHeadings("# 見出し1")).toBe("# 見出し1");
  });

  it("# のあとに空白が無いものは見出しではないので触らない", () => {
    // ##あああ は CommonMark では元々ただの文字。ここでエスケープすると
    // 画面に \##あああ と表示されてしまう
    expect(escapeSubHeadings("##あああ")).toBe("##あああ");
  });

  it("## だけの行も対象にする", () => {
    expect(escapeSubHeadings("##")).toBe("\\##");
  });

  it("行頭3スペースまでは見出し、4スペースからはコードなので触らない", () => {
    expect(escapeSubHeadings("   ## 三つ")).toBe("   \\## 三つ");
    expect(escapeSubHeadings("    ## 四つ")).toBe("    ## 四つ");
  });

  it("コードブロックの中は書き換えない", () => {
    const source = lines("本文", "```", "## コメント", "```", "## 見出し2");
    expect(escapeSubHeadings(source)).toBe(
      lines("本文", "```", "## コメント", "```", "\\## 見出し2"),
    );
  });

  it("~~~ で開いたフェンスは ``` では閉じない", () => {
    // 違う記号で閉じたことにすると、その後ろの ## を書き換えてしまう
    const source = lines("~~~", "```", "## まだコードの中", "~~~", "## ここは見出し");
    expect(escapeSubHeadings(source)).toBe(
      lines("~~~", "```", "## まだコードの中", "~~~", "\\## ここは見出し"),
    );
  });

  it("フェンスは3個以上なら何個でもよい", () => {
    const source = lines("````", "## コメント", "````");
    expect(escapeSubHeadings(source)).toBe(source);
  });

  it("空文字はそのまま返す", () => {
    expect(escapeSubHeadings("")).toBe("");
  });
});

describe("toPlainText", () => {
  it("見出しの # を落とす", () => {
    expect(toPlainText("# 見出し")).toBe("見出し");
    expect(toPlainText("### 見出し3")).toBe("見出し3");
  });

  it("箇条書き・番号付き・引用の記号を落とす", () => {
    expect(toPlainText(lines("- ひとつ", "* ふたつ", "+ みっつ"))).toBe("ひとつ ふたつ みっつ");
    expect(toPlainText("1. いち")).toBe("いち");
    expect(toPlainText("> 引用")).toBe("引用");
  });

  it("リンクは文字だけ、画像は alt だけにする", () => {
    expect(toPlainText("[SmartHR](https://smarthr.design/)")).toBe("SmartHR");
    expect(toPlainText("![図の説明](https://example.com/a.png)")).toBe("図の説明");
  });

  it("強調と打ち消しとインラインコードの記号を落とす", () => {
    expect(toPlainText("**太字**と*斜体*と~~打ち消し~~と`code`")).toBe(
      "太字と斜体と打ち消しとcode",
    );
  });

  it("表の行はまるごと落とす", () => {
    const source = lines("説明", "| 列A | 列B |", "|---|---|", "| 1 | 2 |", "続き");
    expect(toPlainText(source)).toBe("説明 続き");
  });

  it("コードフェンスの行は落とす（中身は残る）", () => {
    // 一覧の2行表示に使うものなので、中身まで消す必要はない。
    // 記号が見えなければよい
    expect(toPlainText(lines("```ruby", "puts 1", "```"))).toBe("puts 1");
  });

  it("改行と連続する空白を1つの空白に畳む", () => {
    expect(toPlainText(lines("一行目", "", "", "二行目"))).toBe("一行目 二行目");
    expect(toPlainText("  前後に空白  ")).toBe("前後に空白");
  });

  it("空文字はそのまま返す", () => {
    expect(toPlainText("")).toBe("");
  });
});
