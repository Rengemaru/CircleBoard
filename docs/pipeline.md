# Issue駆動 自動実装パイプライン

Issue を書いてラベルを付けると、計画 → 実装 → レビュー → 修正 → PR まで自動で進む
仕組みです。仕様は `docs/claude-pipeline-spec.md`。

**あなたがやることは3つだけです。**

1. 親Issue を書く
2. `claude:plan` ラベルを付ける
3. 出てきた PR をレビューしてマージする

---

## 1. 全体の流れ

```
親Issue に claude:plan を付ける
  → 計画担当     サブIssue群を作成（order で順序付け）、先頭に claude:implement
  → 実装担当     ブランチを切って実装・テスト・PR作成（Closes #サブIssue）
  → 正確性レビュー ∥ セキュリティレビュー（read-only、並列）
  → critical/high があれば 修正担当 が push → レビュー再実行（最大3周）
  → 3周で解決しなければ needs-human で停止
  → あなたが PR をレビューしてマージ
  → アンロック   同じ親の次のサブIssueに claude:implement → 実装担当へ戻る
親Issue を閉じる → キルスイッチ 残りのサブIssue・PR・実行中ジョブを停止
```

同じ親Issue の中は**直列**です。兄弟のサブIssueが同時に走ると、同じファイルを
触る PR どうしが競合するためです。並列度は、あなたが出す親Issue の数で決まります。

---

## 2. ワークフロー一覧

| ファイル | 起動条件 | LLM |
|---|---|---|
| `claude-plan.yml` | 親Issue に `claude:plan` | 使う |
| `claude-implement.yml` | サブIssue に `claude:implement` | 使う |
| `claude-review.yml` | PR の作成・更新 | 使う（`mark-passed` / `reset-loop` は使わない） |
| `pipeline-line-gate.yml` | PR の作成・更新 | 使わない |
| `pipeline-unlock.yml` | PR がマージされた | 使わない |
| `pipeline-kill.yml` | 親Issue が閉じられた | 使わない |

`claude.yml`（`@claude` メンションで動く汎用ワークフロー）はこのパイプラインとは
別物です。パイプラインを通さずに単発で頼みたいときに使います。

---

## 3. ラベル一覧

| ラベル | 付く先 | 誰が付けるか | 意味 |
|---|---|---|---|
| `claude:plan` | 親Issue | **あなた** | 計画担当を起動する |
| `pipeline:parent` | 親Issue | 計画担当 | キルスイッチの対象識別 |
| `pipeline:subtask` | サブIssue | 計画担当 | 計画から生成されたタスク |
| `claude:implement` | サブIssue | 計画担当 / アンロック | 実装担当を起動する |
| `loop:1` `loop:2` `loop:3` | PR | 修正担当 | 修正ループの周回数（排他） |
| `needs-human` | PR | 修正担当 / **あなた** | 自動処理を全停止 |
| `review:passed` | PR | レビュー | critical/high なし。あなたのレビュー待ち |

ラベルは各ワークフローが `gh label create --force` で用意するので、
手で作る必要はありません。

---

## 4. 困ったときの操作

### PR に `needs-human` が付いた

自動修正が止まっています。理由は2つのどちらかです。

- **修正担当が反論した** — レビュアーの指摘が誤検知だと判断した。
  PR コメントに反論の根拠が書かれているので、それを読んで判断する
- **3周しても critical/high が消えなかった** — `loop:3` が付いている。
  レビュアーと修正担当が噛み合っていない

あなたが判断し、直すか、指摘を無視すると決めたら **`needs-human` ラベルを外します。**
外すと `loop:*` がリセットされ、次の push からまた3周ぶん自動修正が動きます。

### 自動処理をいますぐ止めたい（PR 単位）

その PR に `needs-human` を付けてください。レビューも修正も走らなくなります。

### 全部止めたい（計画単位）

**親Issue を閉じてください。** キルスイッチが動き、次を行います。

1. 同じ親の open なサブIssue をすべてクローズ
2. それらを `Closes` している open な PR をクローズ
3. 対象ブランチで動いている実行中・待機中のジョブを cancel

何度実行しても同じ結果になるので、閉じ直しても問題ありません。

**アンロックは親Issue を閉じません。** すべてのサブタスクが終わると親Issue に
コメントするだけです。閉じるのはあなたで、閉じた時点でキルスイッチが動きます。

### 行数ゲートに落ちた

PR に「非テストの変更行が NNN 行で、上限 300 行を超えています」というコメントが
付きます。実装担当は PR を出す前に自己確認するので、通常はここに来ません。
来た場合は、サブIssueの粒度が大きすぎたということです。

テストコードは無制限です。ロックファイル・生成物・バイナリは集計から除外されます。

---

## 5. セットアップ手順（初回のみ）

### 5-1. カスタム GitHub App を作る

アンロックとキルスイッチには専用の App が要ります。

**なぜ必要か:** `GITHUB_TOKEN` で付けたラベルは、GitHub の再帰防止によって
他のワークフローを起動しません。アンロックが `claude:implement` を付けても
実装担当が動かない、という状態になります。

1. https://github.com/settings/apps/new を開く
2. **App name を `CircleBoard Pipeline` にする**
   （slug が `circleboard-pipeline` になり、ワークフローの `allowed_bots` に
   書いてある値と一致します。別の名前にする場合は
   `claude-implement.yml` と `claude-review.yml` の
   `PIPELINE_ALLOWED_BOTS` を書き換えてください）
3. Webhook は Active のチェックを外す
4. Repository permissions を次のとおりにする
   - Contents: Read and write
   - Issues: Read and write
   - Pull requests: Read and write
   - Actions: Read and write
5. 作成後、App ID を控える
6. Generate a private key で `.pem` をダウンロードする
7. Install App でこのリポジトリにインストールする

### 5-2. Secrets を登録する

**この値は Claude には渡さないでください。** あなた自身が登録します。

リポジトリの Settings → Secrets and variables → Actions

| 名前 | 値 |
|---|---|
| `PIPELINE_APP_ID` | 5-1 で控えた App ID |
| `PIPELINE_APP_PRIVATE_KEY` | ダウンロードした `.pem` の中身をそのまま |

`CLAUDE_CODE_OAUTH_TOKEN` は登録済みです。

### 5-3. ブランチ保護に行数ゲートを登録する

```bash
gh api -X PUT repos/Rengemaru/CircleBoard/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["line-gate"] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

これで `CLAUDE.md` §5「main への直接コミット禁止」が初めて仕組みで担保されます。

---

## 6. 段階的な導入

いきなり全部を有効にしません。**壊れたときにどこが壊れたか分かる順**に入れます。

### ① 行数ゲート（無害）

`pipeline-line-gate.yml` だけがある状態。PR を1本出して確認します。

- [ ] PR に行数の sticky コメントが付く
- [ ] 2回目の push でコメントが**増えずに更新される**
- [ ] 非テストとテストが別々に数えられている
- [ ] `package-lock.json` が除外一覧に入る

### ② レビュー2本（`fix` は動かない状態）

`PIPELINE_FIX_ENABLED` を**設定しないまま**にします。`fix` ジョブは起動しません。

さらに、`fix` は head ブランチが `claude/` で始まる PR にしか動かないので、
**あなた自身のブランチ（`feat/...`）から PR を出せば** この段階では
自動修正が動く余地がありません。

- [ ] `correctness` と `security` が並列で走る
- [ ] インラインコメントが付く
- [ ] PR コメントに要約が出る（受け入れ基準の判定とテスト結果を含む）
- [ ] 指摘がなければ `review:passed` が付く
- [ ] `needs-human` を付けると、次の push でレビューが走らない

**確認すべき失敗:** レビュアーが構造化出力を返さなかった場合、ジョブは
`::error::...構造化出力を返しませんでした` で**失敗します**。これは意図した挙動です
（判定不能を「指摘なし」として素通りさせないため）。

### ③ 実装担当を小さな Issue で単発試験

サブIssueを1本だけ手で作り（メタデータブロック込み）、`claude:implement` を
手で付けます。計画担当はまだ使いません。

- [ ] `claude/issue-<n>-<slug>` ブランチができる
- [ ] rspec / rubocop / lint / typecheck が CI 上で実際に走っている
- [ ] PR 本文に `Closes #<n>` と `CLAUDE.md` §7 の5項目がある
- [ ] **その PR が `claude-review.yml` を起動する**

最後の1つが**このパイプラインで一番壊れやすいところ**です。実装担当が
Claude GitHub App として PR を作れていないと、`allowed_bots` に弾かれるか、
そもそもイベントが飛びません。起動しなかった場合は、PR を作った
アカウント名（`github.actor`）を確認し、`PIPELINE_ALLOWED_BOTS` に
その名前（`[bot]` は付けない）が入っているかを見てください。

### ④ 計画担当 + アンロック

親Issue に `claude:plan` を付けます。

- [ ] サブIssueが order 付きで作られる
- [ ] 親Issue にチェックリストがコメントされる
- [ ] 先頭のサブIssueにだけ `claude:implement` が付く
- [ ] **その1本をマージすると、次のサブIssueに `claude:implement` が付く**
- [ ] 最後のサブIssueをマージすると、親Issue に完了コメントが付く（閉じられない）
- [ ] 親Issue を閉じるとキルスイッチが残りを片付ける

### ⑤ `fix` ジョブを有効化

Settings → Secrets and variables → Actions → Variables で
`PIPELINE_FIX_ENABLED` = `true` を追加します。

- [ ] critical/high があるときだけ `fix` が動く
- [ ] `loop:1` が **push より前に**付く
- [ ] push でレビューが再実行される
- [ ] 3周目で `loop:3` になり、以降 `fix` が起動しない
- [ ] 反論した場合、修正せずに `needs-human` が付く
- [ ] `needs-human` を外すと `loop:*` が消える

---

## 7. この仕組みの制約

- **fork からの PR では動きません。** public リポジトリでは fork の PR に
  Secrets が渡らないためです。仕様として受け入れています
- **`pull_request_target` は使っていません。** インジェクションの面が広がるためです
- Claude が作る PR で `.github/`、`.claude/`、`CLAUDE.md` を変更すると
  セキュリティレビューが critical を出します。パイプライン自身を変えるときは、
  人間が自分でブランチを切ってください
- `allowed_bots` に `*` は使いません。public リポジトリでは、誰が作った
  GitHub App でも Issue や PR を作ってパイプラインを起動できてしまうためです
