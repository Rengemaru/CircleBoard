# Claude Code 作業指示書 — CircleBoard

> **この指示書の使い方**
>
> Claude Code に**この文書全体を渡さないでください。**
> 各タスクの節（例「T1-4」）だけを1回のセッションで渡し、完了報告を受けてレビューし、承認してから次に進みます。
>
> 理由: 一括で投げると、動くけれど誰も説明できないコードベースになります。
> このプロジェクトでは「開発者が説明できないコードは価値がない」を最優先原則としています。

**前提ドキュメント（Claude Code に常に読ませる）**
- `CLAUDE.md` — 規約
- `docs/spec-v2.2.md` — 仕様書（DBスキーマ・計算式・アクセス制御の正）
- `docs/api-spec.md` — APIエンドポイント一覧
- `wireframes/*.html` — 画面構造

---

## 全体の流れ

| Phase | 内容 | 日数 | ゴール |
|---|---|---|---|
| 1 | 基盤 + 縦切り1本 | 5.0 | **イベント一覧がブラウザに表示される** |
| 2 | 認証・CRUD | 5.0 | 企画の投稿と参加が一通りできる |
| 3 | サイネージ | 4.0 | 部室ディスプレイに映せる |
| 4 | 管理者画面・仕上げ | 3.0 | 運用に必要な操作が揃う |
| 5 | デプロイ | 5.0 | 公開URLで動く |
| 6 | CD | 1.5 | push で自動デプロイ |

**Phase 1 の考え方（縦切り / Walking Skeleton）**
DB → API → 画面を、**1機能だけ端から端まで**通します。横に広く進める（全テーブル作る → 全API作る → 全画面作る）と、最後まで動くものが見えず、統合時に問題が噴出します。

---

# Phase 1 — 基盤 + 縦切り1本

## T1-1 リポジトリとDocker Compose

**依頼文（そのまま渡す）**

```
CLAUDE.md と docs/spec-v2.2.md を読んでください。

タスク T1-1 のみを実行します。他のタスクには進まないでください。

【やること】
モノレポ構成の雛形と Docker Compose を作る。

- ディレクトリ: api/ web/ docs/ wireframes/
- docker-compose.yml に3サービス
  - db:  postgres:16-alpine、ボリュームで永続化、healthcheck付き
  - api: Ruby 3.3 の開発用Dockerfile、3000番、dbにdepends_on(healthy)
  - web: Node 22 の開発用Dockerfile、5173番
- .gitignore（Rails + Node + .env + master.key + .DS_Store）
- .env.example（DATABASE_URL, VITE_API_BASE_URL, VITE_PUBLIC_BASE_URL）
- README.md にセットアップ手順（macOS前提）

【禁止】
- 本番用Dockerfileはまだ作らない（Phase 5で作る）
- RailsアプリやReactアプリの生成はまだしない（T1-2, T1-3で行う）

【完了条件】
docker compose up -d で db が healthy になること。

終わったら CLAUDE.md §7 の5項目を報告して停止してください。
```

**人間のレビュー観点**
- [ ] `.gitignore` に `master.key` と `.env` が入っているか
- [ ] `docker-compose.yml` を自分で読んで、各行の意味を説明できるか

---

## T1-2 Rails APIモード初期化

```
タスク T1-2 のみを実行します。

【やること】
api/ に Rails 7.x を APIモードで生成し、起動できる状態にする。

- rails new . --api --database=postgresql --skip-test（RSpecを使うため）
- database.yml は ENV['DATABASE_URL'] を読む形にする
- rack-cors を設定。開発時は http://localhost:5173 のみ許可（* は禁止）
- GET /healthz を追加。{ status: "ok" } を返すだけ
- RAILS_LOG_TO_STDOUT を有効化

【完了条件】
curl http://localhost:3000/healthz が 200 と JSON を返す。

終わったら報告して停止。
```

**レビュー観点**
- [ ] CORSのオリジンが `*` になっていないか
- [ ] `/healthz` がルーティングのどこに置かれたか説明できるか

---

## T1-3 React + Vite 初期化

```
タスク T1-3 のみを実行します。

【やること】
web/ に Vite + React + TypeScript(strict) + Tailwind CSS を構築する。

- TypeScript は strict: true。any を禁止する ESLint ルールも入れる
- ESLint + Prettier
- react-router-dom を入れ、ルート定義だけ用意（中身は空でよい）
  /  /events  /events/:id  /projects  /projects/:id  /create  /login  /legal
  /admin/users  /admin/pins  /admin/signage-tokens  /signage
- src/api/client.ts に fetch の薄いラッパー
  - VITE_API_BASE_URL を使う
  - credentials: 'include'（Cookieセッションのため）
  - 非2xxはエラーを投げる
- 各ページは「ページ名だけ表示する」プレースホルダでよい

【禁止】
- UIコンポーネントライブラリ(MUI等)を入れない
- 状態管理ライブラリ(Redux等)を入れない
- localStorage / sessionStorage を使わない

【完了条件】
npm run dev で起動し、各URLでページ名が表示される。
npm run lint と typecheck がエラー0。
```

---

## T1-4 マイグレーション9本 ★最重要

```
タスク T1-4 のみを実行します。このタスクはプロジェクトの土台なので、
仕様書の記述と1文字でも違う実装をしないでください。

【やること】
docs/spec-v2.2.md §2（テーブル定義）と §6（実行順序）に従い、
マイグレーション9本とモデル9つを作る。

順序: users → tags → events → projects → event_tags → project_tags
      → event_participations → project_participations → signage_tokens

【特に注意する点】
1. enum は integer カラム + Rails の enum。PostgreSQLのENUM型は使わない
2. 外部キーの ON DELETE 挙動を仕様書通りに設定する
   - event_participations.event_id は CASCADE
   - project_participations.project_id は SET NULL
   - user_id 系はすべて SET NULL
   （この2つを取り違えないこと。理由は仕様書 §2.6 にあります）
3. 部分ユニークインデックスを2つ作る
   - events: pinned = true の行は全体で1件のみ
   - event_participations: (event_id, user_id) は cancelled_at IS NULL のときのみ一意
   Rails のマイグレーションでは where: オプションを使う
4. 仕様書にないカラムを追加しない
   （profile_image, suspended_at, organizers テーブルは意図的に作りません）

【完了条件】
- rails db:migrate が通る
- schema.rb が仕様書 §2 と一致する
- rails console で以下が失敗することを確認できる
  - pinned: true のイベントを2件作ろうとするとエラーになる

終わったら、schema.rb の全文と、上記の確認結果を報告して停止。
```

**人間のレビュー観点（ここは念入りに）**
- [ ] `schema.rb` を仕様書 §2 と1行ずつ突き合わせたか
- [ ] 部分ユニークインデックスが2つとも効いているか、`rails console` で自分の手で試したか
- [ ] `ON DELETE` の違いを、なぜそう分けているか説明できるか

---

## T1-5 seeds

```
タスク T1-5 のみを実行します。

【やること】
db/seeds.rb を作る。何度実行しても壊れないように（find_or_create_by を使う）。

- 管理者1名（role: admin）
- 一般メンバー3名
- タグ: Web開発 / ゲーム制作 / 機械学習 / ハッカソン / LT / 競プロ / 交流 / 新入生 / 初心者歓迎
- イベント4件（開催日を 3日後 / 8日後 / 20日後 / 過去 に散らす）
  ※ 注目スコアの動作確認に使うため、日付のばらつきが重要
- プロジェクト3件（募集中2 / 進行中1）
- イベント参加を数件（一部は cancelled_at を入れる）
- サイネージトークン1件

パスワードは全員 'password123'（開発用と README に明記）。

【完了条件】rails db:seed が2回連続で成功する。
```

---

## T1-6 縦切り：イベント一覧 ★

```
タスク T1-6 のみを実行します。ここが Phase 1 の山場です。

【やること】
DB → API → 画面を1本通す。

バックエンド:
- GET /api/events を実装
- app/serializers/event_serializer.rb を作る（素のRubyクラス。gemを入れない）
  - docs/spec-v2.2.md §4.2 のコードを土台にする
  - current_user が nil のとき owner を含めない
- コントローラで includes を書き、N+1を出さない
- 対象は visibility: active のみ

フロントエンド:
- /events でイベント一覧を表示
- wireframes/wireframe-member.html の「② イベント一覧」の構造に従う
- 型は web/src/types/event.ts に定義

【完了条件】
1. ブラウザで /events を開くと seed の4件が表示される
2. Rails のログを見て、イベント件数によらずSQL発行数が一定であること
3. curl でAPIを叩き、owner キーが含まれていないこと

報告時に、2 と 3 の実際の出力を貼ってください。
```

**レビュー観点**
- [ ] ログを自分の目で見てN+1が無いことを確認したか
- [ ] `curl` で owner が返らないことを自分の手で確認したか

---

## T1-7 テスト・Lint基盤

```
タスク T1-7 のみを実行します。

【やること】
- RSpec + FactoryBot + SimpleCov を導入
- RuboCop（rubocop-rails-omakase）を導入し、既存コードの違反を0にする
- spec を2本だけ書く
  1. model spec: Event のバリデーション
  2. request spec: GET /api/events が未ログインで owner を返さないこと
- README にテスト実行コマンドを追記

【禁止】
テストを網羅的に書かない。この段階は「基盤が動くこと」の確認のみ。

【完了条件】rspec と rubocop がどちらも green。
```

---

## ✅ Phase 1 完了の判定

以下がすべて満たされたら Phase 2 へ。

- [ ] `docker compose up -d` だけで開発環境が立ち上がる
- [ ] ブラウザで `/events` に seed のイベントが並ぶ
- [ ] `rspec` と `rubocop` が green
- [ ] **`schema.rb` の全カラムについて、なぜ必要かをオーナーが説明できる**
- [ ] **`EventSerializer` の分岐の意味をオーナーが説明できる**

最後の2つが満たせない場合、Phase 2 に進まずコードを読み直してください。ここを飛ばすと後で取り返せません。

---

# Phase 2 — 認証・CRUD

各タスクの依頼文は Phase 1 と同じ形式で作ってください（「Tx-y のみ実行」「完了条件」「報告して停止」）。

| ID | タスク | 目安 | 完了条件 |
|---|---|---|---|
| T2-1 | セッション認証（`POST /api/session`、`DELETE /api/session`、`GET /api/session`） | 1日 | ログイン後にCookieが付き、`GET /api/session` が自分を返す |
| T2-2 | 認可の共通化 + シリアライザ出し分け | 0.5日 | 未ログイン時に owner が返らない（request specで検証）。**参加者一覧は T2-3 で検証する**（下記注記） |
| T2-3 | イベント CRUD（作成・編集・論理削除）＋**詳細API `GET /api/events/:id`** | 1日 | owner本人と管理者のみ編集でき、他人は403。詳細APIは**一覧と同じ `EventSerializer` を使い**、`visibility: trashed` は404 |
| T2-4 | プロジェクト CRUD | 1日 | 未ログインで一覧・詳細ともに401 |
| T2-5 | タグ付け | 0.5日 | 企画作成時に既存タグを複数選択でき、中間テーブルに入る |
| T2-8 | **イベント一覧の絞り込み（既定 `status=recruiting` / `?tag_id=`）** | 0.5日 | クエリなしで `recruiting` のみ返る。`?tag_id=` で1タグに絞られる。タグの `includes` でSQL発行数が増えない |
| T2-6 | イベント参加表明・キャンセル・定員 | 0.5日 | 満員時に参加ボタンが消え、APIも422を返す |
| T2-7 | プロジェクト参加申請・参加者一覧 | 0.5日 | 参加者一覧が未ログインで見えない |

**T2-2 の完了条件から「参加者一覧」を外した理由（T2-1 のレビューで判明）**
> 元の完了条件は「未ログイン時に owner と参加者一覧が返らない」だったが、`participants` は
> `api-spec.md` §2 では詳細API `GET /api/events/:id` のレスポンスにしか存在せず、一覧APIには含まれない。
> その詳細APIは T2-3 の担当であり、T2-2 の時点では検証対象のエンドポイントが存在しない。
> **participants の出し分けは T2-3 の request spec で検証する。**

**T2-8 を追加した理由（T1-6 のレビューで判明）**
> `api-spec.md` §2 と `wireframes/wireframe-member.html` の画面②は「既定は `status=recruiting` のみ表示」「絞り込みは `?tag_id=`」と定めているが、Phase 1〜4 のどのタスクにもこれを担う記述が無かった。
> T1-6 では実装していない。理由は、T1-6 の完了条件が「seed の4件が表示される」であり、seed の4件中1件が `completed` のため、既定フィルタを入れると3件になって完了条件と矛盾するため。
> **T2-8 を実装した時点で、既定表示は3件（recruiting のみ）に変わる。** T1-6 の完了条件は Phase 1 時点のものとして扱う。

**T2-6 の注意点として指示に含めること**
> 定員チェックはフロントのボタン非表示だけでなく、**API側でも必ず検証**してください。ボタンを隠すのは表示の話であり、認可でも制限でもありません。

---

# Phase 3 — サイネージ（柱）

| ID | タスク | 目安 |
|---|---|---|
| T3-1 | `Event#calculate_spotlight_score` + **RSpec（境界値）** | 1日 |
| T3-2 | whenever gem + cron | 0.5日 |
| T3-3 | ピン留め機能 | 0.5日 |
| T3-4 | signage_tokens 認証 | 0.5日 |
| T3-5 | サイネージ画面（可変レイアウト + QR + 0件時） | 1日 |
| T3-6 | 60秒リロード + 時計 | 0.5日 |

**T3-1 の依頼文に必ず含めること**

```
このタスクはプロジェクトの中核であり、面接で最も詳しく質問される部分です。
テストを先に書いてから実装してください（TDD）。

【必ずテストするケース】
- 開催まで15日 → 開催間近ボーナスが0になる
- 開催まで14日 → 境界。0になる
- 開催まで13日 → 1 × 15 = 15
- 開催当日 → 14 × 15 = 210
- 参加者0人 → 勢い成分が0
- 4日前の参加 → 集計に含まれない（窓は3日）
- キャンセル済みの参加 → 集計に含まれない
- 開催日が過去 → 対象から除外される
```

**T3-3 の依頼文に必ず含めること**

```
ピン留めの切り替えは、
「既存の pinned:true を false にする」→「新しい行を true にする」
を必ず同一トランザクション内で行ってください。
分けて実行すると部分ユニークインデックスに衝突して失敗します。
```

**T3-4 の依頼文に必ず含めること**

```
サイネージは「トークン認証は通っているが current_user は nil」という状態です。
既存のシリアライザをそのまま使い、current_user: nil を渡してください。
サイネージ専用のシリアライザを新設しないこと（出し分けが二重管理になります）。
```

---

# Phase 4 — 管理者画面・仕上げ

| ID | タスク | 目安 |
|---|---|---|
| T4-1 | 管理者3画面（アカウント発行 / ピン留め設定 / トークン管理） | 1.5日 |
| T4-2 | トップページ | 0.5日 |
| **T4-5** | **メンバー画面の実装（ログイン / イベント詳細 / プロジェクト一覧・詳細 / 企画作成 / 利用規約）** | **1.5日** |
| T4-3 | レスポンシブ調整・エラーハンドリング | 0.5日 |
| T4-4 | README / ER図 / API仕様書の整備 | 0.5日 |

**T4-5 を追加した理由（T4-2 の実装中に判明）**
> `/login` `/events/:id` `/projects` `/projects/:id` `/create` `/legal` の6画面が、
> Phase 1〜6 のどのタスクにも実装として割り当てられていなかった。
> T1-3 でルートだけ定義し、以降のタスクはすべてAPI側だったため、プレースホルダのまま残っていた。
>
> **とくに `/login` が無いと、UIからログインする手段が一つも無い。**
> T4-1 で作った管理者画面もログインできないため実質使えず、Phase 4 の完了条件
> 「運用に必要な操作が揃う」を満たせない。
>
> 画面の構造は `wireframes/wireframe-member.html` の ②〜⑧ にある。

**T4-1 に含めること:** 管理者画面のAPIは、**すべてのエンドポイントで role: admin を検証**すること。フロントでメニューを隠すだけにしない。

---

# Phase 5 — デプロイ

仕様書 `docs/spec-v2.2.md` §7 に構成・Caddyfile・Dockerfile・セキュリティ項目の実物があります。

| ID | タスク | 目安 |
|---|---|---|
| D-1 | VPS初期設定（非rootユーザー / SSH鍵 / ufw / fail2ban） | 0.5日 |
| D-2 | ドメイン取得 + DNS | 0.25日 |
| D-3 | 本番用Dockerfile（マルチステージ） | 1日 |
| D-4 | Caddy + HTTPS | 0.5日 |
| D-5 | production設定（credentials / force_ssl / secure cookie / CORS） | 0.5日 |
| D-6 | rack-attack | 0.5日 |
| D-7 | バックアップ | 0.5日 |
| D-8 | 初回デプロイ + 手順書 | 0.5日 |
| D-9 | 公開範囲の最終確認 | 0.25日 |
| D-10 | 本番でのエラー画面・0件時挙動の確認 | 0.25日 |

> **D-1 と D-2 は Phase 1 と並行して着手できます。** ConoHaに2週間の無料トライアルがあるので、早めに触っておくとPhase 5が短縮できます。

**D-3 に必ず含めること**

```
イメージのビルドはVPS上で行いません。GitHub Actions側でビルドします。
Dockerfileはその前提で書いてください（VPS上で docker build を走らせるとメモリ不足で落ちます）。
```

---

# Phase 6 — CD

| ID | タスク | 目安 |
|---|---|---|
| C-1 | GitHub Actions（build → ghcr.io へ push → SSH deploy） | 1日 |
| C-2 | Secrets設定・デプロイ検証・ロールバック手順 | 0.5日 |

**C-2 に含めること:** ロールバック手順を README に書くこと。「前のイメージタグを指定して `docker compose up -d` する」で足ります。**手順が無いと、壊れた本番を前に何もできなくなります。**

---

## 付録: 検証の手順（Phase 1〜2 の実運用から）

タスクごとに、静的レビュー（仕様適合・規約）と動作チェックを分けて行い、最後に判定係が可否を宣告する。
実運用で分かったことを手順として残す。

| 決めごと | 理由 |
|---|---|
| **動作チェック係には実行権限のあるエージェントを割り当てる** | 読み取り専用のエージェントに割り当てると `curl` も `rspec` も実行できず、検証が空振りする（実際に2回起きた） |
| **判定係は対象コミットを `git worktree` で隔離してから計測する** | 作業ツリーで実行すると、並行して進む次タスクの差分が混入し、カバレッジやファイル数がずれる（実際に 80.79% と 63.91% のズレが出た） |
| **書き込みを伴う手動確認は rspec か、トランザクションで巻き戻す `rails runner` で行う** | 開発用DBを直接汚すと後片付けが漏れる。`where` 条件での削除は、直前の更新で条件から外れて消し損ねる（実際に起きた） |
| **検証の前後で各テーブルの件数を記録し、差分があれば `db:seed` で戻す** | 差分削除より丸ごと戻す方が事故らない |
| **「壊して確認」（実装をわざと壊して spec が落ちるか見る）を検証項目に入れる** | 通っているだけで何も検証していない spec を炙り出せる。実際にエラー形の検証漏れが見つかった |

---

## 付録: Claude Code に言わせない・させないこと

| 状況 | 対応 |
|---|---|
| 「ついでに◯◯も改善しました」 | 差分が読めなくなる。**指示したタスク以外に触らせない** |
| 「仕様書と違いますが、こちらの方が良いので変更しました」 | **勝手に変えさせない**。提案として出させ、人間が判断する |
| gemやnpmパッケージを追加したい | **必ず理由を聞く**。CLAUDE.md §1 の「採用しないもの」に該当しないか確認 |
| テストが落ちるのでテストを直しました | **実装が正しいのかテストが正しいのかを人間が判断する** |
| 大量のファイルを一度に生成 | タスク粒度を守らせる。長すぎたらセッションを分ける |
