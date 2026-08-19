class CreateProjectParticipations < ActiveRecord::Migration[7.2]
  def change
    create_table :project_participations do |t|
      # プロジェクトは論理削除後も参加者一覧を閲覧でき、復旧時にメンバーがそのまま
      # 戻る必要があるため、参加レコードを残す SET NULL。
      # event_participations の CASCADE と取り違えないこと（仕様書 §2.6）
      t.references :project, foreign_key: { on_delete: :nullify }
      t.references :user, foreign_key: { on_delete: :nullify }
      # 0:approved / 1:pending / 2:rejected。MVPは0固定
      t.integer :status, null: false, default: 0
      t.datetime :approved_at, null: false      # MVPでは created_at と同値

      t.timestamps
    end

    # event_participations と違い、こちらは条件なしの単純なユニーク
    add_index :project_participations, [ :project_id, :user_id ], unique: true
  end
end
