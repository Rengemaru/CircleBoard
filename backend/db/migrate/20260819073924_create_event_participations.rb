class CreateEventParticipations < ActiveRecord::Migration[7.2]
  def change
    create_table :event_participations do |t|
      # イベントは単発で復旧の概念が薄く、参加履歴を残す価値が低いため CASCADE。
      # project_participations とは意図的に挙動を変えている（仕様書 §2.6）
      t.references :event, null: false, foreign_key: { on_delete: :cascade }
      t.references :user, foreign_key: { on_delete: :nullify }
      t.datetime :cancelled_at                 # null = 参加中

      t.timestamps
    end

    # 二重参加を防ぐ。キャンセル済みは対象外なので、一度抜けた人の再参加は通る
    add_index :event_participations, [ :event_id, :user_id ], unique: true,
              where: "cancelled_at IS NULL", name: "index_event_participations_active"
  end
end
