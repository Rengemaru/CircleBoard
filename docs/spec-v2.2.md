# CircleBoard 実装仕様書 v2.2

> **このドキュメントの位置づけ**
> v2.0（要件・スコープ確定）を受けて、**そのままコードが書ける粒度**まで落とし込んだ実装仕様。
> ER図・DBスキーマ・API公開範囲・サイネージ仕様・**デプロイ設計**・WBSを含む。
>
> 作成日: 2026-08-19 / 前提: 実装未着手（0行）
> **v2.2の主変更：ローカル運用 → ConoHa VPS へのデプロイに方針変更**

### 関連ドキュメント

このファイルが**設計判断の正**です。他のドキュメントと食い違った場合は、このファイルを優先し、差分を報告してください。

| ファイル | 役割 | 置き場所 |
|---|---|---|
| **`spec-v2.2.md`（本書）** | **設計判断の正。**DBスキーマ・計算式・アクセス制御・デプロイ構成 | `docs/` |
| `api-spec.md` | APIエンドポイント一覧、リクエスト/レスポンス形式、認可の早見表 | `docs/` |
| `instructions.md` | Claude Code へのPhase別作業指示。1タスクずつ渡して使う | `docs/` |
| `CLAUDE.md` | Claude Code が毎回読むコーディング規約 | リポジトリ直下 |
| `wireframe-member.html` | メンバー画面8枚 | `wireframes/` |
| `wireframe-admin.html` | 管理者画面3枚 | `wireframes/` |
| `wireframe-signage.html` | サイネージ4パターン（0/1/2/3〜4件） | `wireframes/` |

**過去の資料（`circle-board-project-v2.md`、旧 `wireframe*.html`）は参照しないでください。** MVPスコープ外の機能や、否定済みの旧仕様が残っています。

---

## 0. 設計判断の履歴

### 0.1 v2.2 で確定した判断（デプロイ方針変更に伴うもの）

| # | 項目 | v2.1 | **v2.2（確定）** | 理由 |
|---|---|---|---|---|
| 1 | 運用形態 | 大学PCでローカル運用 | **ConoHa VPS 2GB にデプロイ** | 当初予定していた機材に備品管理アプリが載ったため |
| 2 | 学内ネットワーク申請 | 必須（最大の外部依存） | **不要** | VPS化により消滅。工程リスクが1つ減った |
| 3 | HTTPS | 優先度低 | **必須**（Caddy で自動証明書） | 公開サーバーのため |
| 4 | 本番用Dockerfile | 後回し | **必須**（マルチステージビルド） | |
| 5 | CI/CD | 削除 | **CD採用**（GitHub Actions） | デプロイ先が固定され初めて意味を持つ。**ビルドをActions側に寄せてVPSのメモリ不足事故を構造的に回避** |
| 6 | Terraform | 削除（クラウド移行しないため） | **削除を維持（理由を差し替え）** | 旧理由は失効。新理由＝**VPS1台にIaCは過剰。同じ1日はCDに使う方がリターンが大きい** |
| 7 | QRコードのURL | IP変動リスクあり・暫定対策要 | **独自ドメインで解決** | 問題自体が消滅 |
| 8 | 企画者（owner）名の公開 | 未ログインでも表示 | **未ログイン時は非表示**（シリアライザ層で除外） | 実名がインターネットに露出するため |
| 9 | `robots.txt` の noindex | 未定義 | **未決**（部長と要相談） | §9 参照 |
| 10 | Basic認証による限定公開期間 | 提案 | **不採用** | オーナー判断 |

### 0.2 v2.1 で確定した判断（v2.0からの差分・継続有効）

| # | 項目 | v2.0 | v2.1（確定） | 理由 |
|---|---|---|---|---|
| 1 | `organizers` テーブル | 🟡 DBだけ作る | **作らない。** `owner_id` カラムのみ | 独立した新規テーブルは後から `CREATE TABLE` するだけで既存データに影響ゼロ |
| 2 | co_organizer の将来設計 | ポリモーフィック | **`project_organizers` / `event_organizers` の分離テーブル** | ポリモーフィックはDBレベルで外部キー制約を張れない |
| 3 | `users.role` | 記載なし | **追加**（admin / member / demo） | 全行に値が必要なため後付けコストが高い |
| 4 | `profile_image` / `profile_text` | 🟡 残す | **作らない** | nullableで後付けコストゼロ。未使用カラムはレビューでマイナス |
| 5 | `is_active_override` / `suspended_at` | 🟡 残す | **作らない** → **`suspended_at` のみ追加**（2026-08-20 にオーナー判断で撤回。下記 0.4 参照） | 同上 |
| 6 | タグの中間テーブル | 記載なし | **`event_tags` / `project_tags` を追加** | 設計漏れ |
| 7 | 注目スコア計算式 | 3種類が併存 | **1本に確定**（§3） | 面接で説明する柱 |
| 8 | ピン留めの一意性 | アプリ層任せ | **部分ユニークインデックスでDB保証** | |
| 9 | スマホUI | 資料間で矛盾 | **レスポンシブのみ** | 柱に集中 |
| 10 | 管理者画面 | 3画面 / 4画面で矛盾 | **3画面** | 同上 |

### 0.3 「後からカラムを足すか、今足すか」の判断基準

> **後から追加したとき、既存の全行にデータを入れ直す必要があるか。**
> - Yes → 今入れる（例：`role`、`graduation_year`）
> - No（nullableで空のまま成立する）→ 必要になってから入れる（例：`suspended_at`）
>
> 「将来使うかもしれない」は理由になりません。それはYAGNI違反です。

### 0.4 v2.2 運用中に覆した判断

| # | 項目 | 元の判断 | 新しい判断 | 理由 |
|---|---|---|---|---|
| 1 | `users.suspended_at` | 0.2-5 で「作らない」 | **追加する**（2026-08-20） | `wireframe-admin-ver2.html` ② がアカウント停止を要求。0.3 の基準どおり「必要になったので今入れる」ケースであり、基準を破ってはいない |
| 2 | 管理者画面の枚数 | 0.2-10 で「3画面」 | **7画面**（`wireframe-admin-ver2.html`） | オーナーがワイヤーフレームを差し替え。着手順は `docs/instructions.md` Phase 7 |

**`is_active_override` は引き続き作りません。** 停止は `suspended_at` の有無だけで表せます。
真偽値と時刻の2本を持つと「フラグは立っているが時刻が無い」状態が作れてしまいます。

---

## 1. ER図

```
┌──────────────┐
│    users     │
│──────────────│
│ id           │───┐
│ name         │   │
│ email        │   │
│ password_dgst│   │
│ role         │   │
│ enrollment_yr│   │
│ graduation_yr│   │
└──────────────┘   │
                   │ owner_id (SET NULL)
        ┌──────────┼──────────┐
        │                     │
        ▼                     ▼
┌──────────────┐      ┌──────────────┐
│   events     │      │   projects   │
│──────────────│      │──────────────│
│ id           │      │ id           │
│ title        │      │ title        │
│ description  │      │ description  │
│ location     │      │ activity_sch │
│ starts_at    │      │ meeting_sch  │
│ capacity     │      │ capacity     │
│ external_url │      │ status(3)    │
│ status(2)    │      │ visibility   │
│ visibility   │      │ owner_id     │
│ owner_id     │      │ requires_appr│🟡
│ spotlight_sc │      │ allow_multipl│🟡
│ pinned       │      │ recurrence   │🟡
│ recurrence   │🟡    └──────────────┘
└──────────────┘             │
        │                    │
        ▼                    ▼
┌──────────────────┐  ┌──────────────────────┐
│event_participatns│  │project_participations│
│──────────────────│  │──────────────────────│
│ event_id CASCADE │  │ project_id  SET NULL │
│ user_id  SET NULL│  │ user_id     SET NULL │
│ cancelled_at     │  │ status      🟡       │
└──────────────────┘  │ approved_at          │
                      └──────────────────────┘
        │                    │
        ▼                    ▼
┌──────────────┐      ┌──────────────┐        ┌──────────────┐
│  event_tags  │      │ project_tags │        │signage_tokens│
│──────────────│      │──────────────│        │──────────────│
│ event_id  CAS│      │ project_id CAS│       │ id           │
│ tag_id    CAS│      │ tag_id     CAS│       │ token        │
└──────────────┘      └──────────────┘        │ name         │
        │                    │                │ revoked_at   │
        └────────┬───────────┘                └──────────────┘
                 ▼                             （他テーブルと関連なし）
          ┌──────────────┐
          │     tags     │
          └──────────────┘
```

**テーブル数：9**　🟡 = MVPではUI・ロジックを作らないが、カラムは用意するもの

---

## 2. テーブル定義

Rails の `enum` は integer カラムで持つ（PostgreSQLのENUM型は値の追加にマイグレーションが必要になるため不採用）。

### 2.1 users

| カラム | 型 | 制約 | 備考 |
|---|---|---|---|
| id | bigint | PK | |
| name | string | NOT NULL | 卒業後も保持 |
| email | string | NOT NULL, UNIQUE | 大学メアド。通知には使わない |
| password_digest | string | NOT NULL | `has_secure_password`（bcrypt） |
| role | integer | NOT NULL, default: 1 | 0:admin / 1:member / 2:demo |
| enrollment_year | integer | NOT NULL | |
| graduation_year | integer | NOT NULL | 卒業判定は `User#graduated?`（4月始まりの年度で判定） |
| suspended_at | datetime | NULL可 | **NULL = 有効。** 時刻が入っていれば停止中（0.4-1 で追加） |
| created_at / updated_at | datetime | NOT NULL | |

```ruby
# app/models/user.rb
class User < ApplicationRecord
  has_secure_password
  enum :role, { admin: 0, member: 1, demo: 2 }

  has_many :owned_events,   class_name: 'Event',   foreign_key: :owner_id
  has_many :owned_projects, class_name: 'Project', foreign_key: :owner_id
  has_many :event_participations
  has_many :project_participations

  validates :name, presence: true
  validates :email, presence: true, uniqueness: { case_sensitive: false }
  validates :password, length: { minimum: 8 }, if: -> { password.present? }
end
```

> **v2.2追加：** パスワード8文字以上を必須化。公開サーバーになったため、v2.0で「デプロイ時に引き締める」としていた項目を最初から適用する。

> **アカウント停止（0.4-1 で追加）**
>
> `suspended_at` に時刻を入れると停止。真偽値ではなく時刻にしているのは、
> `event_participations.cancelled_at` と同じ理由で「いつ止めたか」を残すためです。
>
> **停止は表示上のラベルではありません。** サーバー側で次の2つを行います。
>
> 1. `POST /api/session` を **403** で拒否する（ログインできない）
> 2. **すでに発行済みのセッションも無効化する。** `current_user` が `nil` を返すので、
>    停止した瞬間からその人は未ログイン扱いになる
>
> 2番が無いと、停止しても本人がブラウザを開いたままなら操作を続けられます。
> 「ログインさせない」だけでは停止になりません。
>
> 停止しても企画と参加記録は消しません。停止は削除ではなく、一時的に締め出す操作です。

---

### 2.2 events

| カラム | 型 | 制約 | 備考 |
|---|---|---|---|
| id | bigint | PK | |
| title | string | NOT NULL | |
| description | text | NOT NULL | テンプレート付き |
| location | string | NOT NULL | 「部室A」「オンライン」など |
| starts_at | datetime | NOT NULL | カウントダウンの基準 |
| capacity | integer | NULL可 | null = 無制限 |
| external_url | string | NULL可 | connpass等 |
| status | integer | NOT NULL, default: 0 | 0:recruiting / 1:completed |
| visibility | integer | NOT NULL, default: 0 | 0:active / 1:trashed（論理削除） |
| owner_id | bigint | FK users, NULL可 | ON DELETE SET NULL |
| spotlight_score | integer | NOT NULL, default: 0 | cronで日次更新 |
| pinned | boolean | NOT NULL, default: false | 管理者ピン留め |
| recurrence_type | integer | NOT NULL, default: 0 | 🟡 0:one_time / 1:recurring |
| created_at / updated_at | datetime | NOT NULL | |

**インデックス:**
```sql
CREATE INDEX index_events_on_starts_at ON events (starts_at);
CREATE INDEX index_events_on_status_and_visibility ON events (status, visibility);

-- ピン留めは全体で常に1件のみ。DBレベルで保証する
CREATE UNIQUE INDEX index_events_single_pinned ON events (pinned) WHERE pinned = true;
```

> **部分ユニークインデックス** は、条件に合う行だけに一意制約をかける仕組みです。
> `pinned = true` の行が2件以上作れなくなるため、「ピン留めは1枠だけ」という運用ルールを**アプリのバグでは破れない形**にできます。
> 面接で説明価値のある実装です。「運用ルールをアプリ層のif文ではなくDB制約で表現しました」と言えます。
>
> 実装上の注意：切り替えは「既存のtrueをfalseに」→「新しい行をtrueに」を**同一トランザクション内**で行うこと。

---

### 2.3 projects

| カラム | 型 | 制約 | 備考 |
|---|---|---|---|
| id | bigint | PK | |
| title | string | NOT NULL | |
| description | text | NOT NULL | |
| activity_schedule | string | NULL可 | 「毎週土曜」など自由記述 |
| meeting_schedule | string | NULL可 | 「毎週水曜 19:00〜」など |
| capacity | integer | NULL可 | null = 無制限 |
| status | integer | NOT NULL, default: 0 | 0:recruiting / 1:in_progress / 2:completed |
| visibility | integer | NOT NULL, default: 0 | 0:active / 1:trashed |
| owner_id | bigint | FK users, NULL可 | ON DELETE SET NULL |
| requires_approval | boolean | NOT NULL, default: false | 🟡 UIに出さない |
| allow_multiple | boolean | NOT NULL, default: true | 🟡 UIに出さない |
| recurrence_type | integer | NOT NULL, default: 0 | 🟡 |
| created_at / updated_at | datetime | NOT NULL | |

**注意：** `projects` に `spotlight_score` / `pinned` は持たせません。注目スコアはイベント専用の概念であり、サイネージのプロジェクト欄はステータス順（募集中を優先）で並べるためです。

---

### 2.4 tags / event_tags / project_tags

```
tags
- id
- name       string NOT NULL UNIQUE
- category   integer NOT NULL default: 0   # 0:project_event / 1:skill（1は未使用）
- timestamps

event_tags
- id
- event_id   FK events  ON DELETE CASCADE  NOT NULL
- tag_id     FK tags    ON DELETE CASCADE  NOT NULL
- UNIQUE (event_id, tag_id)

project_tags
- id
- project_id FK projects ON DELETE CASCADE NOT NULL
- tag_id     FK tags     ON DELETE CASCADE NOT NULL
- UNIQUE (project_id, tag_id)
```

タグは `db/seeds.rb` で初期登録（Web開発 / ゲーム制作 / 機械学習 / ハッカソン / LT / 競プロ / 交流 / 新入生 / 初心者歓迎 など）。

---

### 2.5 event_participations

| カラム | 型 | 制約 |
|---|---|---|
| id | bigint | PK |
| event_id | bigint | FK events, NOT NULL, **ON DELETE CASCADE** |
| user_id | bigint | FK users, NULL可, ON DELETE SET NULL |
| cancelled_at | datetime | NULL可（null = 参加中） |
| created_at / updated_at | datetime | NOT NULL |

```sql
-- 二重参加を防ぐ。キャンセル済みは対象外なので再参加は可能
CREATE UNIQUE INDEX index_event_participations_active
  ON event_participations (event_id, user_id) WHERE cancelled_at IS NULL;
```

キャンセルは物理削除せず `cancelled_at` に時刻を入れる（注目スコアの「直近3日の増減」を正確に出すためにも必要）。

---

### 2.6 project_participations

| カラム | 型 | 制約 |
|---|---|---|
| id | bigint | PK |
| project_id | bigint | FK projects, NULL可, **ON DELETE SET NULL** |
| user_id | bigint | FK users, NULL可, ON DELETE SET NULL |
| status | integer | NOT NULL, default: 0（0:approved / 1:pending / 2:rejected）🟡 MVPは0固定 |
| approved_at | datetime | NOT NULL（MVPでは created_at と同値） |
| created_at / updated_at | datetime | NOT NULL |

**インデックス:** UNIQUE (project_id, user_id)

**events と CASCADE の扱いを変えている理由**（面接で聞かれる箇所）:
プロジェクトは論理削除（trashed）後も参加者一覧を閲覧でき、復旧時にメンバーがそのまま戻る必要があるため、参加レコードを残す。イベントは単発で復旧の概念が薄く、参加履歴を残す価値が低いため CASCADE。

---

### 2.7 signage_tokens

| カラム | 型 | 制約 |
|---|---|---|
| id | bigint | PK |
| token | string | NOT NULL, UNIQUE（`SecureRandom.hex(16)` = 32文字） |
| name | string | NOT NULL（例：「部室メインディスプレイ」） |
| revoked_at | datetime | NULL可（null = 有効） |
| created_at / updated_at | datetime | NOT NULL |

`last_accessed_at` は v2.0 で削除決定済み。60秒ごとに全トークンが書き込みを起こすため費用対効果が悪い。

> **v2.2追加：** VPS公開により、このURLは全世界から到達可能になった。32文字hexなので総当たりは非現実的だが、`rack-attack` によるレート制限を必須とする（§7.5）。

---

## 3. 注目スコア（確定版）

### 3.1 計算式

```
spotlight_score = 開催間近ボーナス × 15 + 直近3日間の参加増加数 × 10

開催間近ボーナス = max(0, 14 - 開催までの日数)
```

### 3.2 係数の根拠（面接で必ず聞かれる部分）

| 項目 | 取りうる範囲 | 係数 | 寄与範囲 |
|---|---|---|---|
| 開催間近ボーナス | 0〜14 | ×15 | **0〜210** |
| 直近3日の参加増加数 | 現実的に0〜5人 | ×10 | **0〜50** |

**設計思想：締切感が主、勢いが従。**
同程度の開催日なら「今まさに人が集まっている企画」が上位に来るが、勢いだけで開催の遠い企画が上位に来ることはない。参加者数の**絶対値**を使わないのは、すでに人気の企画がさらに有利になるだけで、参加促進というサイネージの目的に寄与しないため。

### 3.3 「直近3日」にした理由（論点33への回答）

スコア更新は cron で毎日7時に1回。集計窓を48時間にすると更新のたびに境界が不安定に動き、日次更新と噛み合わない。3日窓なら週末の動きも拾え、日次更新と整合する。

### 3.4 実装

```ruby
# app/models/event.rb
SPOTLIGHT_IMMINENCE_WEIGHT = 15
SPOTLIGHT_MOMENTUM_WEIGHT  = 10
SPOTLIGHT_IMMINENCE_WINDOW = 14  # 日
SPOTLIGHT_MOMENTUM_WINDOW  = 3   # 日

def calculate_spotlight_score
  days_until = (starts_at.to_date - Date.current).to_i
  imminence  = [0, SPOTLIGHT_IMMINENCE_WINDOW - days_until].max
  momentum   = event_participations
                 .where(cancelled_at: nil)
                 .where(created_at: SPOTLIGHT_MOMENTUM_WINDOW.days.ago..)
                 .count
  imminence * SPOTLIGHT_IMMINENCE_WEIGHT + momentum * SPOTLIGHT_MOMENTUM_WEIGHT
end
```

```ruby
# config/schedule.rb（whenever gem）
every 1.day, at: '7:00 am' do
  runner "Event.recalculate_spotlight_scores"
end
```

### 3.5 表示対象から外す条件

- `starts_at` が過去（開催当日23時以降は自動的に外す）
- `status: completed`
- `visibility: trashed`

### 3.5.1 スコアと表示条件で鮮度が違う（実装時に判明）

| | いつ決まるか | 理由 |
|---|---|---|
| `spotlight_score` | cron が毎日7時に書き戻した値 | 毎リクエスト計算すると、60秒ごとに叩かれるサイネージで全イベント分のCOUNTが走る |
| 表示対象かどうか | 呼ばれるたびに `Time.current` で判定 | 「今この瞬間」で判断しないと、深夜に「今日開催」が出続ける |

**順位が入れ替わるのは1日1回でよいが、載せる/外すは即座に効かせたい。**
そのため「スコアは朝7時の値だが、23時を過ぎた瞬間に対象から外れる」という挙動になる。

---

### 3.6 旧資料の扱い

旧 `wireframe.html` には否定済みの計算式が注記として残っている。

> `※ スコア計算式：(参加者数 × 10) + (新着ボーナス × 5) + (開催間近ボーナス × 8)`

これは「参加者数の絶対値を重視するのは参加促進の目的に合わない」として自分たちで否定したロジック。**旧ワイヤーフレーム3点（`wireframe.html` / `wireframe-mobile.html` / `wireframe-admin.html` の旧版）はリポジトリに含めず、`wireframes/` には v2.2 版の3ファイルのみを置く。**

否定した設計が成果物に残っていると、レビューで真っ先に指摘される。「消し忘れ」は「判断が曖昧なまま進んだ」と読まれる。

---

## 4. API・公開範囲設計 🆕 v2.2

VPS公開により「未ログインで見える」が実質「全世界に見える」に変わったため、この章を新設する。

> **エンドポイントの一覧・リクエスト/レスポンス形式は `api-spec.md` にある。**
> 本章は「なぜその出し分けにするか」という設計判断を扱う。実装時は両方を読むこと。

### 4.1 アクセス制御の全体像

| リソース | 未ログイン | ログイン済み | サイネージ（トークン） |
|---|---|---|---|
| イベント一覧・詳細 | ✅ 閲覧可 | ✅ | ✅ |
| **企画者（owner）名** | **❌ 非表示** | ✅ | ❌ 非表示 |
| イベント参加者一覧 | ❌ | ✅ | ❌ |
| イベント参加表明 | ❌ | ✅ | — |
| プロジェクト全般 | ❌ | ✅ | ✅ 表示のみ |
| 管理者機能 | ❌ | admin のみ | ❌ |

**サイネージは「トークン認証は通っているがユーザーではない」状態。** `current_user` は nil。ここを混同すると事故る。

### 4.2 シリアライザ層で出し分ける

gemは使わず、素のRubyクラスとする。依存が増えず、「Hashを組み立てるだけの薄いクラス」と一言で説明できる。

```ruby
# app/serializers/event_serializer.rb
class EventSerializer
  def initialize(event, current_user: nil)
    @event = event
    @current_user = current_user
  end

  def as_json
    base = {
      id:                 @event.id,
      title:              @event.title,
      description:        @event.description,
      location:           @event.location,
      starts_at:          @event.starts_at.iso8601,
      capacity:           @event.capacity,
      participants_count: @event.event_participations.active.size,
      status:             @event.status,
      external_url:       @event.external_url,
      tags:               @event.tags.map { |t| { id: t.id, name: t.name } }
    }

    # 未ログインならここで返す。owner は含まれない
    return base unless signed_in?

    base.merge(
      owner: @event.owner && { id: @event.owner.id, name: @event.owner.name }
    )
  end

  private

  def signed_in? = @current_user.present?
end
```

```ruby
# app/controllers/api/events_controller.rb
def index
  events = Event.active.includes(:tags, :owner, :event_participations)
  render json: events.map { EventSerializer.new(_1, current_user: current_user).as_json }
end
```

`includes` はN+1クエリ対策（イベント10件でタグを引くのにSQLが11回飛ぶのを防ぐ）。レビューで最初に見られる箇所なので最初から入れる。

### 4.3 実装上の必須ルール

| # | ルール | 理由 |
|---|---|---|
| 1 | **フロント側のCSS/条件レンダリングで隠さない** | `curl` や DevTools でAPIを直接叩けば見える。**必ずAPIレスポンスから除く** |
| 2 | **一覧APIと詳細APIで同じシリアライザを使い回す** | 片方だけ塞いで漏れるのが典型的事故。クラス共有なら構造的に起きない |
| 3 | サイネージ用のシリアライザも同じクラスを使う | `current_user: nil` を渡すだけで owner が落ちる |

### 4.4 公開される情報の最終形

| 情報 | 未ログイン |
|---|---|
| 参加者一覧 | 非公開 ✅ |
| プロジェクト全般 | 非公開 ✅ |
| 企画者の氏名 | **非公開** ✅ |
| イベントのタイトル・概要・タグ | 公開 |
| 開催日時・開催場所 | 公開 |

---

## 5. サイネージ仕様（当初画面ベース・確定版）

旧 `wireframe.html` の ⑧番画面を土台とし、下記の修正を加えたものを採用する。
検討していた4案（A グリッド / B ヒーロー / C タイムライン / D 左右分割）と2台運用案は**破棄**。

**確定版のワイヤーフレームは `wireframes/wireframe-signage.html`。** 0件 / 1件 / 2件 / 3〜4件の4パターンを実寸比（16:9）で描画してある。実装前に必ずブラウザで開いて目視確認すること。

### 5.1 レイアウト（1920×1080 / 1台運用）

```
┌────────────────────────────────────────────────┐
│ CircleBoard                        19:42       │  ← ヘッダー
│ 情報系学生サークル             2026年9月25日(木) │     時計はJSで毎秒更新
├────────────────────────────────────────────────┤
│ 🔥 注目イベント                                 │
│ ┌──────────────┐ ┌──────────────┐             │
│ │📌ピン留め     │ │              │  ← 最大4枠  │
│ │あと3日        │ │あと8日        │     可変    │
│ │タイトル       │ │タイトル       │            │
│ │タグ・日時・場所│ │タグ・日時・場所│      [QR]  │
│ └──────────────┘ └──────────────┘             │
├────────────────────────────────────────────────┤
│ 📁 募集中・進行中のプロジェクト（募集中を優先）  │
│ ┌────────┐ ┌────────┐ ┌────────┐              │
│ │募集中   │ │進行中   │ │募集中   │  ← 最大6枠 │
│ └────────┘ └────────┘ └────────┘     可変     │
└────────────────────────────────────────────────┘
```

### 5.2 当初画面からの変更点

#### 変更1：注目イベント枠を「最大4枠・可変」にする

当初画面は2枠固定だが、決定事項は「4枠（3自動＋1ピン留め）」。2枠だとピン留めが全体の50%を占め、「恣意的占有を防ぐ」という設計思想の説明が成立しない。
一方、固定4枠だと閑散期に空枠が並び、サイネージとして最も見苦しい状態になる。

**確定：表示件数を可変にする。**

| 表示可能なイベント数 | レイアウト |
|---|---|
| 1件 | 1枠を横幅いっぱいに（ヒーロー表示） |
| 2件 | 2枠 |
| 3〜4件 | 2×2グリッド |
| 5件以上 | スコア上位4件のみ表示 |

**ピン留めは常に先頭1枠を占有し、残り枠をスコア上位で埋める。** CSS Grid の `grid-template-columns` を件数で出し分けるだけ。

#### 変更2：QRコード生成を実装項目に追加する

当初画面にQRが描かれているのに、機能リスト全55項目に存在しない未計上項目。

- **方式：** フロントエンド生成（`qrcode.react`）。サーバー側生成だと60秒ごとに無駄な生成が走る
- **中身：** 各企画の詳細ページURL
- **URL：** `VITE_PUBLIC_BASE_URL` 環境変数から組み立てる
- **🔄 v2.2：** 独自ドメイン化により、v2.1で懸念した「IP変動でQRが全部死ぬ」問題は**解消**

#### 変更3：プロジェクト枠も可変にする（最大6枠）

並び順は「募集中 → 進行中」、終了済みは非表示。

### 5.3 共通仕様

| 項目 | 内容 |
|---|---|
| 解像度 | 1920×1080（16:9） |
| 背景 | 暗色 `linear-gradient(135deg, #0f0f15, #1a1a24)` |
| 最小フォント | 24px（視認距離2〜3m想定） |
| リロード | 60秒ごとに `window.location.reload()` |
| 時計 | クライアント側 `setInterval` で毎秒更新（リロードとは独立） |
| ナビゲーション | なし |
| 認証 | `/signage?token=xxx`。無効・失効トークンは 404 |

### 5.4 表示対象が0件のときの挙動

イベント・プロジェクトとも0件の場合、サークルロゴ＋「現在募集中の企画はありません」＋サイトURLのQRを表示する。
**これが無いと運用初日に確実に事故る**（データ投入前に画面を繋いだ瞬間、真っ黒な画面が部室に映る）。

---

## 6. マイグレーション実行順序

外部キーの依存関係があるため、この順序で作成すること。

```
1. users
2. tags
3. events              （users を参照）
4. projects            （users を参照）
5. event_tags          （events, tags を参照）
6. project_tags        （projects, tags を参照）
7. event_participations   （events, users を参照）
8. project_participations （projects, users を参照）
9. signage_tokens      （参照なし）
```

> **注記（実装時に追加）:** ディレクトリ名とComposeのサービス名は `api` / `web` ではなく **`backend` / `frontend`** です（オーナー判断）。以下のコマンドと設定を使うときは読み替えてください。

```bash
# Docker Compose 環境での実行例
docker compose exec backend bin/rails db:create
docker compose exec backend bin/rails db:migrate
docker compose exec backend bin/rails db:seed
```

---

## 7. デプロイ設計 🆕 v2.2

### 7.1 インフラ構成

| 項目 | 内容 |
|---|---|
| 事業者 | **ConoHa VPS** |
| プラン | **2GB**（3コア / SSD 100GB） |
| OS | Ubuntu 24.04 LTS |
| 転送量 | 無制限 |
| ドメイン | 独自ドメイン1本（年1,000〜1,500円程度） |

**1GBプランを選ばない理由：** Rails(Puma) 300〜400MB + PostgreSQL 150MB + Caddy 20MB + OS 200MB ≒ 700〜800MB。定常運用はギリギリ通るが、マイグレーションやアセットビルドで確実に落ちる。2GBとの差は月数十円〜400円程度で、品質 > コスト の原則から選択の余地がない。

**512MBプランはスケールアップ・ダウン不可のため論外。**

### 7.2 サーバー構成（1台・Docker Compose）

```
┌─────────────────────────── ConoHa VPS 2GB ───────────────────────────┐
│                                                                       │
│   ┌──────────┐      ┌──────────┐      ┌──────────────┐              │
│   │  Caddy   │─────▶│ Rails API│─────▶│ PostgreSQL   │              │
│   │  :80/443 │      │  (Puma)  │      │              │              │
│   │          │      │  :3000   │      │  volume永続化 │              │
│   │ 静的配信  │      └──────────┘      └──────────────┘              │
│   │ (Reactの │                                │                      │
│   │  build)  │                                ▼                      │
│   └──────────┘                        ┌──────────────┐              │
│                                        │ pg_dump cron │              │
│                                        │  日次バックアップ│            │
│                                        └──────────────┘              │
└───────────────────────────────────────────────────────────────────────┘
```

- Reactは**ビルド済み静的ファイル**をCaddyが直接配信（Node.jsを本番に置かない）
- `/api/*` のみRailsへリバースプロキシ
- 全コンテナに `restart: always`（VPS再起動時の自動復旧）

### 7.3 HTTPS：Caddy を採用

> **注記:** サービス名・ディレクトリ名は `api` / `web` ではなく **`backend` / `frontend`** です。読み替えてください。

| | nginx + certbot | **Caddy（採用）** |
|---|---|---|
| 証明書 | 手動設定 + 更新cron | **自動取得・自動更新** |
| 設定ファイル | 数十行 | **5行程度** |
| 実装工数 | 0.75日 | **0.25日** |

**選定理由：** 証明書の期限切れによるサイト停止は学生運用で最も起きやすい事故。自動更新はサークル運用上の安全弁として効く。

```
# Caddyfile
circleboard.example.jp {
    encode gzip

    handle /api/* {
        reverse_proxy api:3000
    }

    handle {
        root * /srv/public
        try_files {path} /index.html
        file_server
    }
}
```

`try_files {path} /index.html` は React Router（SPA）のための設定。`/events/12` に直接アクセスされてもindex.htmlを返し、ルーティングをReactに任せる。

### 7.4 本番用Dockerfile（マルチステージビルド）

> **注記:** サービス名・ディレクトリ名は `api` / `web` ではなく **`backend` / `frontend`** です。読み替えてください。

> **マルチステージビルド** = ビルドに必要なツール（コンパイラ等）を最終イメージに含めない仕組み。イメージサイズが数分の1になり、攻撃対象も減る。

```dockerfile
# --- Stage 1: React ビルド ---
FROM node:22-slim AS frontend
WORKDIR /app
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build          # → /app/dist

# --- Stage 2: Rails 本番イメージ ---
FROM ruby:3.3-slim AS api
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY api/Gemfile* ./
RUN bundle config set --local without 'development test' && bundle install
COPY api/ ./
ENV RAILS_ENV=production RAILS_LOG_TO_STDOUT=1
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
```

**重要：ビルドはVPS上で行わない。** GitHub Actions側でビルドしてイメージをレジストリに置き、VPSは `pull` するだけにする（§7.7）。VPS上で `docker build` を走らせるとメモリ不足で落ちるのが典型的事故。

### 7.5 セキュリティ設定（公開サーバーの必須項目）

v2.0の「デプロイ時に再検討する項目」が全て必須化した。

#### サーバーレベル

| # | 項目 | 内容 |
|---|---|---|
| S-1 | 非rootユーザー作成 | 作業用ユーザーで運用 |
| S-2 | SSH鍵認証のみ | パスワード認証を無効化 |
| S-3 | rootログイン禁止 | `PermitRootLogin no` |
| S-4 | `ufw` ファイアウォール | 22 / 80 / 443 のみ開放 |
| S-5 | `fail2ban` | SSH総当たり対策 |

#### アプリケーションレベル

| # | 項目 | 実装 |
|---|---|---|
| A-1 | HTTPS強制 | `config.force_ssl = true` |
| A-2 | Cookie secure フラグ | `secure: true, httponly: true, same_site: :lax` |
| A-3 | ログイン試行回数制限 | `rack-attack`（例：同一IPから5回/分でブロック） |
| A-4 | **サイネージトークンのレート制限** | `rack-attack`（`/signage` へ 同一IP 30回/分） |
| A-5 | CSRF対策 | Rails標準を有効化 |
| A-6 | パスワード強度 | 8文字以上（§2.1のバリデーション） |
| A-7 | シークレット管理 | `config/credentials.yml.enc` + `RAILS_MASTER_KEY` を環境変数で注入 |
| A-8 | CORS | 本番オリジンのみ許可（`*` 禁止） |

### 7.6 バックアップ

```bash
#!/bin/bash
# /opt/circleboard/backup.sh
set -euo pipefail
STAMP=$(date +%Y%m%d)
docker compose exec -T db pg_dump -U circleboard circleboard_production \
  | gzip > /opt/circleboard/backups/db_${STAMP}.sql.gz
# 14世代より古いものを削除
find /opt/circleboard/backups -name 'db_*.sql.gz' -mtime +14 -delete
```

```
# crontab
0 4 * * * /opt/circleboard/backup.sh
```

**VPS内だけに置かないこと。** VPSが飛んだらバックアップも消える。週1回でいいので手元やクラウドストレージに退避する運用を決めておく。

ConoHaの自動バックアップは有料オプション（月額363円〜）だが、上記で十分かつ実装内容を面接で説明できる。

### 7.7 CD（GitHub Actions）

> **注記:** サービス名・ディレクトリ名は `api` / `web` ではなく **`backend` / `frontend`** です。読み替えてください。

```yaml
# .github/workflows/deploy.yml（概略）
name: Deploy
on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # 1. イメージをActions側でビルド（VPSのメモリを使わない）
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}

      # 2. VPSへSSHして pull & up
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/circleboard
            docker compose pull
            docker compose up -d
            docker compose exec -T api rails db:migrate
```

**CDを入れる理由は「映えるから」ではない。** ビルドをActions側に寄せることで、VPSのメモリ不足によるデプロイ失敗を**構造的に**なくすため。この説明ができることが重要。

### 7.8 Terraform を採用しない理由（更新）

- **旧理由（v2.0）：** クラウド移行しない方針だから無価値 → **VPS化により失効**
- **新理由（v2.2）：** VPS1台構成にIaCは過剰。`terraform apply` で1台立てても「それで何が良くなったか」を説明しづらい。**同じ1日をCD構築に使う方がリターンが大きい**

※ ConoHa VPS は Ver 3.0 世代で Terraform に対応しているため、将来やりたくなれば技術的には可能。

### 7.9 段階公開について

v2.1で提案したBasic認証による限定公開期間は**不採用**（オーナー判断）。
ただし企画者名の非表示（§4）により、未ログインで露出する個人情報は無くなっている。

---

## 8. WBS

### 前提：第一マイルストーンは「縦切り1本」

> **縦切り（Walking Skeleton）** = DB → API → 画面まで**1機能だけを端から端まで**通すこと。
> 横に広く進めると最後まで「動くもの」が見えず、統合時に問題が噴出する。
> 縦に1本通せば以降は同じ型の繰り返しになり、見積もり精度も上がる。

### Phase 1：基盤 + 縦切り1本（5日）

| # | タスク | 目安 | 完了条件 |
|---|---|---|---|
| 1-1 | Docker Compose 構成（api / web / db） | 0.5日 | `docker compose up` で3つ起動 |
| 1-2 | Rails APIモード初期化、CORS、`/healthz` | 0.5日 | `/healthz` が 200 |
| 1-3 | React + Vite + TypeScript + Tailwind 初期化 | 0.5日 | 空ページが表示される |
| 1-4 | **マイグレーション9本**（§6の順序） | 1日 | `db:migrate` が通り `schema.rb` が§2と一致 |
| 1-5 | seeds.rb（管理者1名 + タグ十数件 + サンプルイベント3件） | 0.5日 | `db:seed` でデータが入る |
| 1-6 | **縦切り：** `GET /api/events` → React で一覧表示 | 1日 | ブラウザにイベント3件が並ぶ |
| 1-7 | RSpec / RuboCop / ESLint / Prettier 導入 + テスト1本 | 1日 | `rspec` と `rubocop` が green |

### Phase 2：認証・CRUD（5日）

| # | タスク | 目安 |
|---|---|---|
| 2-1 | セッション認証（ログイン / ログアウト / 現在ユーザー） | 1日 |
| 2-2 | 認可 + **シリアライザ層の出し分け**（§4） | 0.5日 |
| 2-3 | イベント CRUD | 1日 |
| 2-4 | プロジェクト CRUD | 1日 |
| 2-5 | タグ付け（event_tags / project_tags） | 0.5日 |
| 2-6 | イベント参加表明・キャンセル、定員チェック | 0.5日 |
| 2-7 | プロジェクト参加申請、参加者一覧 | 0.5日 |

### Phase 3：サイネージ（4日・**柱**）

| # | タスク | 目安 |
|---|---|---|
| 3-1 | `calculate_spotlight_score` + **RSpecテスト**（境界値含む） | 1日 |
| 3-2 | whenever gem 設定、cron 動作確認 | 0.5日 |
| 3-3 | ピン留め（部分ユニークインデックス + トランザクション） | 0.5日 |
| 3-4 | signage_tokens 認証 | 0.5日 |
| 3-5 | サイネージ画面（可変レイアウト + QR + 0件時表示） | 1日 |
| 3-6 | 60秒リロード + 時計 | 0.5日 |

> **3-1 のテストは必ず書く。** 純粋なロジックでテストが書きやすく、面接で一番説明したい部分。

### Phase 4：管理者画面・仕上げ（3日）

| # | タスク | 目安 |
|---|---|---|
| 4-1 | 管理者画面3種（アカウント発行 / ピン留め / トークン管理） | 1.5日 |
| 4-2 | トップページ（注目イベント + 一覧プレビュー） | 0.5日 |
| 4-3 | レスポンシブ調整、エラーハンドリング | 0.5日 |
| 4-4 | README / ER図 / API仕様 の整備 | 0.5日 |

### Phase 5：デプロイ・本番化（5日）🆕 v2.2

| # | タスク | 目安 |
|---|---|---|
| D-1 | VPS初期設定（非rootユーザー / SSH鍵 / ufw / fail2ban） | 0.5日 |
| D-2 | ドメイン取得 + DNS設定 | 0.25日 |
| D-3 | 本番用Dockerfile（マルチステージ） | 1日 |
| D-4 | Caddy + HTTPS | 0.5日 |
| D-5 | Rails production設定（credentials / force_ssl / secure cookie / CORS） | 0.5日 |
| D-6 | `rack-attack`（ログイン試行制限・トークンレート制限） | 0.5日 |
| D-7 | バックアップ（pg_dump cron + 世代管理 + 外部退避） | 0.5日 |
| D-8 | 初回デプロイ + 手順書 | 0.5日 |
| D-9 | 公開範囲の最終確認（robots.txt 判断含む） | 0.25日 |
| D-10 | 本番でのエラー画面・0件時挙動の確認 | 0.25日 |

### Phase 6：CD（1.5日）🆕 v2.2

| # | タスク | 目安 |
|---|---|---|
| C-1 | GitHub Actions ワークフロー（build → push → SSH deploy） | 1日 |
| C-2 | Secrets 設定、デプロイ検証、ロールバック手順 | 0.5日 |

### 合計

| Phase | 日数 |
|---|---|
| 1 基盤 + 縦切り | 5.0 |
| 2 認証・CRUD | 5.0 |
| 3 サイネージ | 4.0 |
| 4 管理者・仕上げ | 3.0 |
| 5 デプロイ | 5.0 |
| 6 CD | 1.5 |
| **合計** | **23.5日** |

**8/19起算 → 9月下旬完成。** 後期開始のタイミングと一致し、サイネージが最も意味を持つ時期にリリースできる。

**D-1・D-2 は Phase 1 と並行して着手可能**（ConoHaは2週間の無料トライアルあり）。前倒しすればPhase 5を短縮できる。

---

## 9. 残っている未決定事項

| # | 項目 | 判断者 | 期限 | 備考 |
|---|---|---|---|---|
| 1 | **VPS料金の支払い者と、卒業後の引き継ぎ** | オーナー + 部長 | **即** | **技術ではなくこれが一番プロダクトを殺す。** 年11,000〜17,000円 |
| 2 | `robots.txt` で noindex にするか | 部長と相談 | Phase 5 まで | 企画者名が非公開になり緊急度は下がったが、開催日時・場所は公開される。**検索インデックスは唯一不可逆** |
| 3 | rswag（テストからAPI仕様書を自動生成）を入れるか | オーナー | Phase 2 開始まで | |
| 4 | デモアカウントのUI実装 | オーナー | MVP後で可 | `users.role` にカラムは確保済み |
| 5 | 独自ドメイン名の決定 | オーナー | Phase 5 まで | QRコードのURLになる |

---

## 改訂履歴

| バージョン | 日付 | 主な変更 |
|---|---|---|
| v1.0 | — | 論点1〜28確定、ワイヤーフレーム作成 |
| v2.0 | 2026-05-12 | MVP機能を64→32に半減、Terraform/CI削除 |
| v2.1 | 2026-08-19 | ER図・DBスキーマ確定、organizers不採用、中間テーブル追加、注目スコア式を1本化、サイネージ仕様確定、WBS詳細化 |
| **v2.2** | **2026-08-19** | **ConoHa VPS 2GB へのデプロイに方針変更。デプロイ設計章（§7）とAPI公開範囲設計章（§4）を新設。CD採用、企画者名の未ログイン非表示、Caddy採用。総工数 18日 → 23.5日** |
| v2.2 付随 | 2026-08-19 | `api-spec.md` / `instructions.md` / `CLAUDE.md` / ワイヤーフレーム3点（member / admin / signage）を新規作成。旧ワイヤーフレームは破棄 |

---

## 次のアクション

| # | やること | 担当 | 期限 |
|---|---|---|---|
| 1 | このドキュメント一式をリポジトリに配置（`docs/` と `wireframes/`） | オーナー | 着手前 |
| 2 | `instructions.md` の **T1-1** から Claude Code に依頼開始 | オーナー | 即 |
| 3 | ConoHa VPS 2GB を契約（2週間の無料トライアルあり） | オーナー | Phase 1 と並行 |
| 4 | ドメインを取得 | オーナー | Phase 1 と並行 |
| 5 | **VPS料金の支払い者と卒業後の引き継ぎを部長と決める** | オーナー + 部長 | 即 |
| 6 | `robots.txt` の noindex 可否を部長と相談 | オーナー + 部長 | Phase 5 まで |

**5 が最優先です。** 技術課題ではありませんが、放置した場合に最も確実にプロダクトを終わらせます。
