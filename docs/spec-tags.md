# タグの自由記述化（案）

固定リストから選ぶ方式をやめ、**使う人がその場で打って作れる**形にします。UIは `MultiCombobox` に統一します。

- 決定: オーナーとの対話（2026-09-11）
- 変更する文書: `docs/api-spec.md` §4 / `docs/spec-v2.2.md` §2.4・§2.8 / `docs/spec-admin-operations.md` §3.5
- **承認されるまでは現行が正**です

---

## 1. いまとの違い

| | いま | この案 |
|---|---|---|
| 候補 | seed の9個のみ | 誰かが作ったタグすべて |
| 無いタグ | **追加できない**（`rails console`） | その場で打てば作れる |
| UI | `FilterChip` を全部並べる | `MultiCombobox`（検索 + 追加） |
| 送信 | `tag_ids: number[]` | `tag_names: string[]` |
| 名前空間 | 企画とプロフィールで**共有** | **分ける** |
| 個数上限 | 企画は無制限 / プロフィール5個 | **どちらも5個** |
| 管理画面 | 無し（console） | `/admin/tags` で**直す**（作る場所ではない） |

現在の9個: `Web開発` `ゲーム制作` `機械学習` `ハッカソン` `LT` `競プロ` `交流` `新入生` `初心者歓迎`

---

## 2. 決まったこと

| 項目 | 決定 |
|---|---|
| 正規化 | **空白と全角のみ**。大文字小文字は区別する |
| 入力上限 | **20文字**（正規化後の文字数） |
| 表示 | **幅 `8em`** を超えたら末尾を省略 |
| 個数上限 | 企画・プロジェクト・プロフィールとも **5個** |
| 名前空間 | 企画とプロフィールで**分ける** |
| 企画タグを作れる人 | 企画・プロジェクトの作成者と管理者 |
| プロフィールタグを作れる人 | **本人** |

---

## 3. 仕様

### 3.1 正規化

`Tag` に正規化を1本置き、保存前に必ず通します。

```ruby
def self.normalize_name(raw)
  raw.to_s.unicode_normalize(:nfkc).gsub(/[[:space:]]+/, " ").strip
end
```

NFKC が担うのは「全角と半角の統一」です。**大文字小文字は変えません。**

| 入力 | 保存される値 |
|---|---|
| `　Ｒａｉｌｓ　` | `Rails` |
| `Web  開発` | `Web 開発` |
| `ﾊﾞｯｸｴﾝﾄﾞ` | `バックエンド` |
| `rails` | `rails`（`Rails` とは**別のタグ**） |

**`Rails` と `rails` は別々に立ちます。** 意図した挙動で、統合は管理画面（§3.8）で行います。

### 3.2 制限

`Tag` には現在バリデーションが1つもありません（`tag.rb`）。自由記述を受けるので追加します。

```ruby
validates :name, presence: true,
                 length: { maximum: 20 },
                 uniqueness: { scope: :category }
```

個数はアプリ側で見ます。`User::MAX_TAGS = 5` と同じ形で `Event` / `Project` にも置きます。

**20文字にした理由。** 情報系で出そうな語を数えたところ、`Photogrammetry(14)` `Infrastructure(14)` `Documentation(13)` `Substance Painter(17)` が12文字では弾かれました。表示側が幅で切るので、入力を広く取っても画面は崩れません。

### 3.3 表示の省略

**CSS に任せます。文字数を数える処理は書きません。**

```
max-w-[8em] truncate      /* truncate = overflow-hidden + text-overflow:ellipsis + whitespace-nowrap */
```

`em` は「そのタグのフォントサイズ1文字ぶんの幅」なので、`8em` がそのまま**全角8文字ぶんの幅**になります。半角文字は自動的に狭く数えられます。

| タグ | 推定幅 | 結果 |
|---|---:|---|
| 初心者歓迎 | 5.0em | 全部出る |
| JavaScript | 5.0em | 全部出る |
| Photogrammetry | 7.0em | 全部出る |
| Substance Painter | 8.5em | 省略される |
| 初心者歓迎ハッカソン | 10.0em | 省略される |

**この方式を選んだ理由。**

- 日本語か英語かを判定する必要がない。混在タグ（`Web開発`）でも迷わない
- 省略記号はブラウザが `…`（1文字）を入れる。`...`（3文字）より狭い
- **Ruby と TypeScript に同じ計算を2本置かずに済む**（`user.rb:79` が戒めている問題）

全文が読めなくなるので、次の2つを添えます。

- タグ要素に `title` 属性を付ける（マウスを乗せると全文）
- **候補リスト（ドロップダウン）では省略しない**。選ぶときに読めないと選べないため

`MultiCombobox` の `selectedItemEllipsis` は、入力欄の中の選択済みタグに同じ考え方で使います。

### 3.4 名前空間を分ける

`tags.category` を実際に使い分けます。未使用だった `1:skill` を **`1:profile`** に置き換えます。

| category | 使う場所 |
|---|---|
| `0: project_event` | イベント・プロジェクト |
| `1: profile` | プロフィール（使える技術） |

**同じ名前が両方に立てられます。** `3D` は企画タグとしてもプロフィールタグとしても存在でき、互いに影響しません。

> **⚠️ `docs/spec-v2.2.md` §2.8 の決定を覆します。** §2.8 はこう書いています。
>
> > **スキルは §2.4 の `tags` を再利用します。**（…）別のテーブルで持つと、「機械学習ができる人」と
> > 「機械学習の企画」が別の語彙になり、探すときに繋がりません。
>
> **失うもの:** 「機械学習の企画」から「機械学習ができる人」へ、タグIDで辿れなくなります。同名で突き合わせる必要があります。
>
> **それでも分ける理由（オーナー判断）:** プロフィールのタグは「その人が何者か」のラベルとして残り続けます。
> 企画の語彙と混ぜると人を型にはめてしまい、**3Dをやっている人がWebを始めようとするときに自分のタグが足を引っ張ります。**
> 名前空間を分ければ、企画側で `Web開発` を付けることと、自分のプロフィールが `3D` のままであることが無関係になります。

### 3.5 誰が作れるか

**タグ単体を作るAPIは作りません。タグは必ず、何かに付ける過程で生まれます。**

| 作れる場所 | 作れる人 | 作られるカテゴリ |
|---|---|---|
| 企画・プロジェクトの作成／編集フォーム | 作成者（メンバー）と管理者 | `project_event` |
| `/me/edit` | 本人 | `profile` |

この形にすると、**どこにも付いていないタグが生まれにくくなります。** 管理画面に作成機能を置かないのも同じ理由です。

### 3.6 UI

`CreatePage` と `MyProfileEditPage` の `FilterChip` の羅列を `MultiCombobox` に置き換えます。

```tsx
<MultiCombobox
  items={candidates}          // カテゴリで絞った候補
  selectedItems={selected}
  creatable                   // 一覧に無い値を追加できる
  onAdd={(label) => ...}      // 打った値を選択済みに足す
  onDelete={...}
  selectedItemEllipsis
/>
```

- 選択が5個に達したら `creatable` を外し、`dropdownHelpMessage` で「5個までです」と出す
- `placeholder` はヒントに使わない。ヒントは `FormControl` の `helpMessage` に置く（デザインシステムの指針）

一覧の絞り込み（`/events`・`/projects`）も `MultiCombobox` にしますが、**`creatable` は付けません**（絞り込みで新規作成する意味がないため）。

### 3.7 APIの契約変更

**まだ存在しないタグはIDを持てません。** 作成・更新は名前で受け取ります。

| API | いま | この案 |
|---|---|---|
| `POST/PUT /api/events/:id` | `tag_ids: number[]` | **`tag_names: string[]`**（5件まで） |
| `POST/PUT /api/projects/:id` | `tag_ids: number[]` | **`tag_names: string[]`**（5件まで） |
| `PATCH /api/users/me` | `tag_ids: number[]` | **`tag_names: string[]`**（5件まで） |
| `GET /api/tags` | 全件（`project_event` のみ） | **`?category=` で絞る** |
| `GET /api/events?tag_ids=` | 据え置き | 据え置き（絞り込みは作成を伴わない） |

サーバー側は正規化 → `find_or_create_by`(name, category) の順で処理します。**`tag_ids` は受け付けなくなります。**

### 3.8 管理画面の役割

`/admin/tags` は「作る場所」ではなく**「直す場所」**です。

- 一覧（**使用件数つき**。カテゴリで分けて表示）
- 改名（`Rails ` の誤字直しなど）
- 削除（**使用0件のものだけ**。使われているタグを消すと企画から黙って外れるため）

**孤児タグ（どこにも付いていないタグ）は自動削除しません。** 一時的に外しただけのものが消えると、付け直すときに候補から見つからなくなります。

---

## 4. 仕様書と食い違う点

**`CLAUDE.md` §3-1 の「必ず止まる」に3つ当たります。** 実装前に承認が要ります。

| # | 対象 | 内容 |
|---|---|---|
| 1 | `api-spec.md` §4 | 「**タグの作成APIは作らない**（`seeds.rb` と `rails console` で管理）」を覆す |
| 2 | `spec-v2.2.md` §2.8 | 「**スキルは §2.4 の tags を再利用します**」を覆す（§3.4 に理由を併記） |
| 3 | `spec-v2.2.md` §2.4 | **テーブル定義に触る**（下記） |
| 4 | APIの観測可能な契約 | `tag_ids` → `tag_names`（§3.7） |

### §2.4 への変更

```diff
 tags
 - id
-- name       string NOT NULL UNIQUE
-- category   integer NOT NULL default: 0   # 0:project_event / 1:skill（1は未使用）
+- name       string NOT NULL
+- category   integer NOT NULL default: 0   # 0:project_event / 1:profile
+- UNIQUE (name, category)                  # 同じ名前を両方の用途で持てるようにする
 - timestamps
```

**`name` の単独UNIQUEを外さないと名前空間を分けられません。** 現在は `index_tags_on_name` が全体で一意なので、`3D` は企画用かプロフィール用のどちらか一方にしか作れません。

---

## 5. 移行

1. `tags` の一意制約を `(name)` → `(name, category)` に貼り替える
2. `category` の enum を `skill` → `profile` に変える（**値1は未使用なのでデータ移行は不要**）
3. 既存の `user_tags` が指すタグを、同名の `profile` タグへ貼り替える
4. `seeds.rb` の9個は `project_event` のまま据え置き

**3 は本番にデータがある場合のみ必要です。** `seeds.rb` は `user_tags` を作っていないため、開発環境では空です。

---

## 6. スコープ外

- **タグの統合（merge）** — `Rails` と `rails` を1つにまとめる操作。表記ゆれ対策の本命だが、付け替え先の重複処理が要るので別に切る
- **タグの候補サジェスト（人気順・共起）** — 候補は名前順で十分
- **`GET /api/events?tag_ids=` の名前化** — URLの互換を壊す割に得が薄い
- **タグの色分け・アイコン**
- **プロフィールタグから人を探す画面** — §3.4 で失うものの埋め合わせ。必要になってから

---

## 7. Issue 分割案

`CLAUDE.md` §11-1 の300行に収まる単位です。**上から順に、先にマージできる順です。**

| 順 | 内容 | 非テスト行数の見込み | 仕様判断 |
|---|---|---:|---|
| 1 | `Tag` の正規化・バリデーション・`(name, category)` 一意制約 | 80〜150 | **要**（§2.4・§2.8） |
| 2 | `tag_names` 受け入れ（events / projects / users#update） | 150〜250 | **要**（API契約） |
| 3 | `CreatePage` と `MyProfileEditPage` を `MultiCombobox` に置換 | 200〜300 | 不要（1・2の後） |
| 4 | 一覧の絞り込みを `MultiCombobox` に置換（`creatable` なし） | 100〜200 | 不要 |
| 5 | タグ表示に `max-w-[8em] truncate` と `title` を入れる | 50〜100 | 不要 |
| 6 | `/admin/tags`（一覧・改名・削除） | 200〜300 | **要**（§4.1） |

---

## 8. 受け入れ条件

1. 一覧に無いタグを打って、その場で企画・プロフィールに付けられる
2. `　Ｒａｉｌｓ　` と入力すると `Rails` として保存される。`rails` は別タグとして立つ
3. 6個目を選ぼうとすると止まる（企画・プロジェクト・プロフィールとも）
4. 21文字は保存できない
5. `Substance Painter` が幅 `8em` で省略され、`title` に全文が入っている
6. **企画タグとプロフィールタグが互いの候補に出てこない**
7. **認可はサーバー側で判定している**（`CLAUDE.md` §3-2）。他人のプロフィールにタグを付けられない
8. `bundle exec rspec` / `bundle exec rubocop` / `npm run lint` / `npm run typecheck` が通る
