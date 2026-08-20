# ER図

`backend/db/schema.rb` から起こしたもの。定義の正は `spec-v2.2.md` §2。

```mermaid
erDiagram
    users ||--o{ events : "owner_id (SET NULL)"
    users ||--o{ projects : "owner_id (SET NULL)"
    users ||--o{ event_participations : "user_id (SET NULL)"
    users ||--o{ project_participations : "user_id (SET NULL)"

    events ||--o{ event_tags : "CASCADE"
    events ||--o{ event_participations : "CASCADE"
    tags ||--o{ event_tags : "CASCADE"

    projects ||--o{ project_tags : "CASCADE"
    projects ||--o{ project_participations : "SET NULL"
    tags ||--o{ project_tags : "CASCADE"

    users {
        bigint id PK
        string name
        string email UK
        string password_digest
        integer role "0:admin 1:member 2:demo"
        integer enrollment_year
        integer graduation_year
        datetime suspended_at "null = 有効"
    }

    events {
        bigint id PK
        string title
        text description
        string location
        datetime starts_at
        integer capacity "null = 無制限"
        string external_url
        integer status "0:recruiting 1:completed"
        integer visibility "0:active 1:trashed"
        bigint owner_id FK
        integer spotlight_score "cronで日次更新"
        boolean pinned "全体で1件のみ"
        integer recurrence_type "DBだけ"
    }

    projects {
        bigint id PK
        string title
        text description
        string activity_schedule
        string meeting_schedule
        integer capacity "null = 無制限"
        integer status "0:recruiting 1:in_progress 2:completed"
        integer visibility "0:active 1:trashed"
        bigint owner_id FK
        boolean requires_approval "DBだけ"
        boolean allow_multiple "DBだけ"
        integer recurrence_type "DBだけ"
    }

    tags {
        bigint id PK
        string name UK
        integer category "0:project_event 1:skill(未使用)"
    }

    event_tags {
        bigint id PK
        bigint event_id FK
        bigint tag_id FK
    }

    project_tags {
        bigint id PK
        bigint project_id FK
        bigint tag_id FK
    }

    event_participations {
        bigint id PK
        bigint event_id FK
        bigint user_id FK
        datetime cancelled_at "null = 参加中"
    }

    project_participations {
        bigint id PK
        bigint project_id FK
        bigint user_id FK
        integer status "0:approved 1:pending 2:rejected"
        datetime approved_at
    }

    signage_tokens {
        bigint id PK
        string token UK "SecureRandom.hex(16)"
        string name
        datetime revoked_at "null = 有効"
    }
```

`signage_tokens` はどのテーブルとも関連を持たない。端末を識別するだけで、
ユーザーとは結びつかないため（サイネージは「認証は通っているがユーザーではない」状態）。

## 説明が必要な設計判断

### ON DELETE を意図的に分けている

| 外部キー | 挙動 | 理由 |
|---|---|---|
| `event_participations.event_id` | **CASCADE** | イベントは単発で復旧の概念が薄く、参加履歴を残す価値が低い |
| `project_participations.project_id` | **SET NULL** | プロジェクトは論理削除後も参加者一覧を閲覧でき、復旧時にメンバーがそのまま戻る必要がある |
| `*.user_id`、`*.owner_id` | SET NULL | 退会しても企画と参加記録は残す |

この2つを取り違えると、プロジェクトを消したときにメンバーが失われる。

### 部分ユニークインデックスを2本使っている

```sql
-- ピン留めは全体で常に1件のみ
CREATE UNIQUE INDEX index_events_single_pinned
  ON events (pinned) WHERE pinned = true;

-- 二重参加を防ぐ。キャンセル済みは対象外なので再参加は可能
CREATE UNIQUE INDEX index_event_participations_active
  ON event_participations (event_id, user_id) WHERE cancelled_at IS NULL;
```

どちらも運用ルールをアプリの `if` 文ではなく**DB制約で表現**している。
アプリのバグでは破れない。実際、ピン留めの切り替えで順序を誤ったとき、
この制約が `PG::UniqueViolation` で弾いた。

`project_participations` は条件なしの単純な UNIQUE `(project_id, user_id)`。
プロジェクトにはキャンセルの概念が無いため、`event_participations` とは条件が違う。

### キャンセルを物理削除しない

`event_participations.cancelled_at` に時刻を入れる。
注目スコアの「直近3日の参加増加数」を正確に出すために、行が残っている必要がある。

### 意図的に作っていないもの

`profile_image` / `profile_text` / `is_active_override` /
`organizers` テーブル / `signage_tokens.last_accessed_at`。

（`suspended_at` は 2026-08-20 に追加した。`wireframe-admin-ver2.html` ② が
アカウント停止を要求したため。「必要になってから入れる」という基準どおりの
追加であり、基準を破ってはいない。`spec-v2.2.md` §0.4 参照）

判断基準は `spec-v2.2.md` §0.3 —
「後から追加したとき、既存の全行にデータを入れ直す必要があるか」。
必要なら今入れる（`role`、`graduation_year`）。nullable で空のまま成立するなら
必要になってから入れる。「将来使うかもしれない」は理由にならない。
