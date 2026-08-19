class CreateTags < ActiveRecord::Migration[7.2]
  def change
    create_table :tags do |t|
      t.string :name, null: false
      # 0:project_event / 1:skill（1は未使用）
      t.integer :category, null: false, default: 0

      t.timestamps
    end

    add_index :tags, :name, unique: true
  end
end
