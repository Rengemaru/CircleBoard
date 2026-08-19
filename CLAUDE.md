# CLAUDE.md — CircleBoard

このファイルは Claude Code がこのリポジトリで作業するときに**毎回読む規約**です。
仕様の詳細は `docs/spec-v2.2.md`、作業手順は `docs/instructions.md` にあります。

---

## 0. このプロジェクトで最も重要なこと

CircleBoard は大学サークルの部室サイネージ兼企画掲示板です。**同時に、開発メンバーの就活ポートフォリオでもあります。**

そのため、次の原則が他のすべてに優先します。

> **開発者本人が説明できないコードは、動いていても価値がない。**

このリポジトリのコードは面接で1行ずつ質問される可能性があります。したがって:

- **賢いコードより、読んで分かるコードを書く。** メタプログラミング、過度な抽象化、DSLの自作は避ける
- **なぜそう書いたかをコミットメッセージかコメントに残す。** ただしコードを読めば分かることは書かない
- **仕様書にない設計判断を勝手に入れない。** 必要だと思ったら、実装せずに「提案」として提示して止まる

### 判断に迷ったときの優先順位

```
品質 > 納期 > コスト
```

さらに、**サークルでの実運用とポートフォリオ映えが衝突したら、実運用を優先します。**
理由: 実際に使われているプロダクトの方が、面接で語れる素材として強いため。

---

## 1. 技術スタック

| レイヤー | 技術 | 備考 |
|---|---|---|
| バックエンド | Rails 7.x（APIモード） | HTMLは返さない。JSONのみ |
| フロントエンド | React + Vite + TypeScript（strict） | SPA。Next.jsは不採用 |
| スタイル | Tailwind CSS | |
| DB | PostgreSQL | |
| 開発環境 | Docker Compose | |
| 本番 | ConoHa VPS 2GB / Ubuntu 24.04 / Caddy | |
| バッチ | whenever gem（cron） | |
| テスト | RSpec + FactoryBot / Vitest | |
| Lint | RuboCop（rails-omakase） / ESLint + Prettier | |

**採用しないもの（提案もしないでください）:** Next.js、GraphQL、Redis、Terraform、Active Storage、状態管理ライブラリ（Redux等）、UIコンポーネントライブラリ（MUI等）。
いずれも意図的に外しています。理由は `docs/spec-v2.2.md` §0 にあります。

---

## 2. ディレクトリ構成

```
circleboard/
├── backend/                # Rails APIモード
│   ├── app/
│   │   ├── controllers/api/
│   │   ├── models/
│   │   └── serializers/    # 素のRubyクラス。gemは使わない
│   ├── config/
│   ├── db/migrate/
│   └── spec/
├── frontend/               # React + Vite
│   └── src/
│       ├── api/            # fetchラッパー
│       ├── components/
│       ├── pages/
│       └── types/
├── docs/
│   ├── spec-v2.2.md        # 仕様書（正）
│   ├── api-spec.md         # APIエンドポイント一覧
│   └── instructions.md     # Phase別の作業指示
├── wireframes/
├── docker-compose.yml
└── CLAUDE.md
```

---

## 3. 絶対に守るルール

### 3-1. 仕様書が正

`docs/spec-v2.2.md` のDBスキーマ・計算式・アクセス制御表は**確定済み**です。
実装中に矛盾や不足を見つけた場合:

1. **勝手に直さない**
2. 何がどう矛盾しているかを説明する
3. 選択肢を2つ以上出す
4. **人間の判断を待つ**

#### どこで止まり、どこで止まらないか（オーナー決定）

上記の「止まる」を全ての矛盾に適用すると作業が進まないため、対象を線引きします。

**必ず止まる（実装せず、提案として提示して人間の判断を待つ）**

- `docs/spec-v2.2.md` **§2（テーブル定義）/ §3（注目スコアの計算式）/ §4.1（アクセス制御表）**
  — 仕様書が「確定済み」と明記した部分
- APIの**観測可能な契約**が変わるもの（JSONのキー名・キーの有無・値の意味・HTTPステータス）
- 仕様書間で記述が食い違っていて、どちらを採るかで**成果物が変わる**もの

**止まらず進めてよい（ただし完了報告の §7-3 に必ず書く）**

- 仕様書のサンプルコードの**実装詳細**。ただし出力されるJSONの形と値が変わらないこと
- 性能上の対処（N+1の回避など）で、振る舞いが変わらないもの
- 開発環境の設定（Docker / Vite / lint など、本番の挙動に影響しないもの）

判断に迷ったら止まる側に倒します。

### 3-2. 認可はAPIレスポンスで行う

フロントエンドの条件レンダリングやCSSで情報を隠すのは**禁止**です。`curl` で叩けば見えてしまいます。

```ruby
# ✅ 正しい: シリアライザでキーごと落とす
return base unless signed_in?
base.merge(owner: { id: @event.owner.id, name: @event.owner.name })
```

```tsx
// ❌ 禁止: APIは owner を返している
{isLoggedIn && <span>{event.owner.name}</span>}
```

**一覧APIと詳細APIでは必ず同じシリアライザクラスを使い回してください。** 片方だけ塞いで漏れるのが典型的な事故です。

### 3-3. N+1クエリを作らない

関連を引くコントローラでは必ず `includes` を書きます。

```ruby
Event.active.includes(:tags, :owner, :event_participations)
```

### 3-4. DBは必ずマイグレーション経由

`psql` で直接テーブルを変更しないこと。`schema.rb` は手で編集しないこと。

### 3-5. 設定はすべて環境変数

コードにホスト名・URL・シークレットを直書きしない。`ENV` 経由か Rails credentials を使う。

### 3-6. 秘密情報をコミットしない

`.env`、`config/master.key`、SSH鍵、トークンの実値。`.gitignore` を最初に整備すること。

---

## 4. コーディング規約

### Ruby / Rails

- RuboCop（rails-omakase）に従う
- コントローラは薄く。分岐が増えたらモデルかサービスクラスへ
- シリアライザは `app/serializers/` に素のRubyクラスとして置く（gemを入れない）
- enum は integer カラム + Rails の `enum`。PostgreSQLのENUM型は使わない（値の追加にマイグレーションが要るため）
- 時刻は必ずタイムゾーン付きで扱う（`Time.current`、`Date.current`。`Time.now` 禁止）

### TypeScript / React

- `strict: true`。`any` 禁止。どうしても必要なら `unknown` + 絞り込み
- 関数コンポーネント + Hooks のみ
- APIレスポンスの型は `web/src/types/` に定義し、`api/` 層で受ける
- **localStorage / sessionStorage は使わない**（認証はサーバー側セッション + Cookie）
- Tailwind のユーティリティクラスを直接書く。独自CSSファイルは原則作らない

### 命名

- Ruby: `snake_case`、クラスは `CamelCase`
- TS: 変数・関数は `camelCase`、コンポーネントとその型は `PascalCase`
- APIのJSONキーは `snake_case`（Rails側に合わせる。フロントで変換しない）

---

## 5. Git

- **`main` への直接コミット禁止。** 必ずPull Request
- レビュアーを1人つける
- ブランチ名: `feat/event-crud`、`fix/signage-token-404`
- Conventional Commits:

```
feat: イベント一覧APIを追加
fix: ピン留め切り替え時に旧ピンが残る問題を修正
test: 注目スコアの境界値テストを追加
docs: API仕様書にサイネージエンドポイントを追記
refactor: EventSerializerの分岐を整理
chore: RuboCopの設定を追加
```

---

## 6. テスト方針

全部を厚く書く必要はありません。**優先順位があります。**

| 対象 | 方針 |
|---|---|
| **`Event#calculate_spotlight_score`** | **最優先。境界値を含めて厚く書く**（開催当日 / 15日後 / 参加者0 / キャンセル済みを除外できているか） |
| 認可（ログイン状態による出し分け） | request spec で「未ログインで owner が返らない」ことを検証 |
| ピン留めの一意性 | 2件目をpinnedにしたとき、1件目が外れることを検証 |
| モデルのバリデーション | 主要なもののみ |
| Reactコンポーネント | 主要な数点のみ。網羅しない |

**注目スコアのテストは必須です。** ここは面接で一番説明したい部分であり、テストの有無で印象が変わります。

---

## 7. 作業の進め方（重要）

### 一度に大量のコードを書かないでください

このリポジトリは `docs/instructions.md` で **Phase 1〜6** に分割されています。

- **1回の作業単位は、instructions.md のタスク1つ（半日〜1日相当）まで**
- タスクが終わったら**必ず止まって**、変更点の要約と設計判断を報告する
- 人間がレビューして承認するまで次のタスクに進まない
- 「ついでにこれも直しておきました」を**しない**。差分が読めなくなる

### 各タスクの終了時に必ず報告する内容

```
1. 作成・変更したファイル一覧
2. この実装で行った設計判断とその理由（仕様書に書かれていなかった部分）
3. 仕様書と食い違った点、または仕様書に書かれていなかった点
4. 動作確認の手順（人間が自分の手で確認できる形で）
5. 気になっているが手を付けていない点
```

**4番は特に重要です。** 人間が自分で動かして確認できないコードは、レビューしたことになりません。

---

## 8. よく使うコマンド

開発機は Windows / Docker Desktop でも macOS でも同じコマンドで動きます。

```bash
# 起動
docker compose up -d

# Rails
docker compose exec backend bin/rails db:migrate
docker compose exec backend bin/rails db:seed
docker compose exec backend bin/rails console
docker compose exec backend bundle exec rspec
docker compose exec backend bundle exec rubocop -a

# React
docker compose exec frontend npm run dev
docker compose exec frontend npm run lint
docker compose exec frontend npm run typecheck

# ログ
docker compose logs -f backend
```

---

## 9. 用語

このプロジェクト固有の言葉です。混同すると設計を誤ります。

| 用語 | 意味 |
|---|---|
| **イベント** | 単発。楽しむ・学ぶ。**未ログインでも閲覧可能**。例: LT会、新歓 |
| **プロジェクト** | 継続的にコミットして成果物を作る。**ログイン必須**。例: Webアプリ開発 |
| **企画** | イベントとプロジェクトの総称 |
| **owner** | 企画の作成者。1企画1人（co_organizerはMVP対象外） |
| **注目スコア** | イベントのみが持つ。「開催の近さ × 直近の勢い」で算出。参加者数の絶対値は**使わない** |
| **ピン留め** | 管理者が注目枠の先頭1つを手動固定する機能。**全体で常に1件のみ**（DB制約で保証） |
| **サイネージ** | 部室ディスプレイ用の全画面ビュー。`?token=` で認証。**`current_user` は存在しない** |
| **🟡 DBだけ** | カラム・テーブルは作るが、UIとロジックは作らない状態 |

---

## 10. 実装しないもの（提案も不要）

以下はMVPスコープ外として**意図的に外しています**。「あった方がいい」と思っても実装しないでください。

- プロフィール機能一式（表示・編集・画像アップロード・公開設定）
- co_organizer の UI と API（`owner_id` のみで運用）
- プロジェクト脱退申請
- 企画ごとのFAQ
- 利用規約の同意フロー（静的ページの表示のみ）
- パスワード再発行UI（`rails console` で対応）
- ユーザー一覧・編集・停止・削除UI（同上）
- 統計ダッシュボード
- 通知機能（メール / LINE / Discord）
- スマホ専用ナビ（ボトムナビ・FAB・スティッキーバー）※レスポンシブ対応はする
- 「過去の企画」セクション
- trashed → archived の自動移行バッチ
