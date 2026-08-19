class CreateProjects < ActiveRecord::Migration[7.2]
  def change
    create_table :projects do |t|
      t.string :title, null: false
      t.text :description, null: false
      t.string :activity_schedule
      t.string :meeting_schedule
      t.integer :capacity                      # null = 無制限
      # 0:recruiting / 1:in_progress / 2:completed
      t.integer :status, null: false, default: 0
      # 0:active / 1:trashed
      t.integer :visibility, null: false, default: 0
      t.references :owner, foreign_key: { to_table: :users, on_delete: :nullify }
      # requires_approval / allow_multiple / recurrence_type はDBだけ。UIには出さない
      t.boolean :requires_approval, null: false, default: false
      t.boolean :allow_multiple, null: false, default: true
      t.integer :recurrence_type, null: false, default: 0

      t.timestamps
    end
  end
end
