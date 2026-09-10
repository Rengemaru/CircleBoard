class CreateUserLinks < ActiveRecord::Migration[7.2]
  # 外部リンク(spec-v2.2.md §2.8)。GitHub / Zenn / 作品のURL など。
  #
  # github_url のような固定列にしないのは、置きたい先が人によって違い、
  # 増やすたびにマイグレーションが要るため。
  #
  # position は並び順。送られた配列の順序をそのまま入れる。
  # 件数の上限(3件)と url のスキーム検証はモデル側で見る。
  # 「1人3件まで」はDB制約で素直に書けないため。
  def change
    create_table :user_links do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.string :label, null: false
      t.string :url, null: false
      t.integer :position, null: false, default: 0

      t.timestamps
    end

    add_index :user_links, [ :user_id, :position ]
  end
end
