---
name: pipeline-review-correctness
description: PR が受け入れ基準を満たしているか、テストが通るか、新規ロジックにテストがあるかを検証する。claude-review.yml の correctness ジョブから呼ばれる。
---

# 正確性レビュー

PR が**サブIssueの受け入れ基準を満たしているか**を判定する。

呼び出し時に `REPO` と `PR_NUMBER` が渡される。

**コードを変更しない。** このジョブに書き込み権限はない。直すのは修正担当の仕事で、
役割を分けているのは、指摘した本人が指摘を消して回れないようにするため。

## 手順

1. `gh pr view <PR_NUMBER> --repo <REPO>` で PR 本文を読み、`Closes #N` を拾う
2. `gh issue view N --repo <REPO>` でサブIssueの受け入れ基準を読む
3. `gh pr diff <PR_NUMBER> --repo <REPO>` で差分を読む
4. `tmp/review/` のテスト結果を読む（**自分では実行しない**）
5. 受け入れ基準を1項目ずつ判定する
6. 指摘をインラインコメントで残す
7. PR コメントに要約を書く
8. 構造化出力（後述）を返す

## テストの結果を読む

**自分でテストを実行しない。** CI が先に走らせて結果をファイルに置いている。
Read で読むこと。

| ファイル | 内容 |
|---|---|
| `tmp/review/rspec.txt` | backend のテスト |
| `tmp/review/rubocop.txt` | backend の Lint |
| `tmp/review/lint.txt` | frontend の Lint |
| `tmp/review/typecheck.txt` | frontend の型検査 |

各ファイルの末尾に `exit_code` がある。0 以外なら失敗。
変更のない側は「実行していない」と書いてある。その場合はその旨を報告し、
失敗として扱わない。

自分で実行させていたときは、1コマンドが1ターンになり、その往復のぶん
時間とプランの利用枠を使っていた。読むだけにして判定に専念する。

**結果を必ず報告する。** 「テストを実行した」ではなく、何本走って何本落ちたかを書く。
落ちた場合は落ちた spec 名と失敗内容を書く。

## 見るところ

- **受け入れ基準の各項目**。満たしているか、1項目ずつ判定する。
  「たぶん満たしている」は未充足として扱う
- **新規ロジックに対応するテストがあるか**。これは行数では縛れないので、
  ここで担保する
- 既存テストが削除・無効化されていないか（`skip`、`xit`、`pending` の追加を含む）
- サブIssueの「スコープ外」に手を出していないか
- `CLAUDE.md` の規約違反（`Time.now`、`any`、localStorage、N+1、
  フロントの条件レンダリングによる情報隠し）

### frontend の扱い

**frontend にはテストランナーが未導入**（Vitest は未インストール、テストファイル0件）。
そのため frontend の変更については「新規ロジックに対応テストなし」を **high にしない**。
`tmp/review/lint.txt` と `tmp/review/typecheck.txt` が通っていることを確認できればよい。

backend（`backend/spec/**`）については、この免除は適用しない。

## severity ルーブリック

| severity | 基準 |
|---|---|
| critical | 秘密情報の露出、認証/認可バイパス、インジェクション、データ損失、`.github/` `.claude/` `CLAUDE.md` への変更、未知のソースからの依存追加 |
| high | 機能バグ、受け入れ基準の未達、**新規ロジックに対応テストなし**（backend のみ）、既存テストの削除・無効化、既存テストの失敗 |
| medium | エラーハンドリング欠落、保守性の問題、パフォーマンス上の明らかな懸念 |
| low | 命名、スタイル、コメント |

**critical と high だけが修正ループの対象**になる。medium / low はコメントとして
残り、人間が判断する。したがって severity は正確に付けること。
判断に迷うものを high に上げると、人間が見るべきものが自動修正で潰される。

## 出力

1. 具体的な指摘は `mcp__github_inline_comment__create_inline_comment` で
   該当行にインラインコメントを付ける
2. `gh pr comment <PR_NUMBER> --repo <REPO> --body "..."` で要約を投稿する。
   受け入れ基準ごとの充足/未充足と、テストの実行結果を必ず含める
3. **最後の応答は、次の形の JSON だけを返す**（`--json-schema` で検証される）

```json
{
  "role": "correctness",
  "max_severity": "high",
  "findings": [
    {
      "severity": "high",
      "file": "backend/app/models/event.rb",
      "line": 42,
      "summary": "何が問題か（1文）",
      "suggestion": "どう直すべきか（1文）"
    }
  ]
}
```

- `max_severity` は findings の中で最も重いもの。findings が空なら `"none"`
- **findings が空でも必ず出力する。** 出力がないと、レビューが壊れているのか
  指摘がないのかを後段が区別できず、ジョブが失敗する
