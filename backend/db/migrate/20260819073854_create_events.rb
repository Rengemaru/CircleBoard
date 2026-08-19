class CreateEvents < ActiveRecord::Migration[7.2]
  def change
    create_table :events do |t|
      t.string :title, null: false
      t.text :description, null: false
      t.string :location, null: false
      t.datetime :starts_at, null: false
      t.integer :capacity                      # null = 無制限
      t.string :external_url
      # 0:recruiting / 1:completed
      t.integer :status, null: false, default: 0
      # 0:active / 1:trashed（論理削除）
      t.integer :visibility, null: false, default: 0
      # owner が退会してもイベントは残す。ON DELETE SET NULL
      t.references :owner, foreign_key: { to_table: :users, on_delete: :nullify }
      t.integer :spotlight_score, null: false, default: 0
      t.boolean :pinned, null: false, default: false
      # 0:one_time / 1:recurring（DBだけ。UIとロジックは作らない）
      t.integer :recurrence_type, null: false, default: 0

      t.timestamps
    end

    add_index :events, :starts_at
    add_index :events, [ :status, :visibility ]

    # ピン留めは全体で常に1件のみ。アプリ層のif文ではなくDB制約で保証する。
    # 部分ユニークインデックスなので pinned = false の行は何件でも作れる。
    add_index :events, :pinned, unique: true, where: "pinned = true",
                                name: "index_events_single_pinned"
  end
end
