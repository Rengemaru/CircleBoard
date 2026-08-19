class CreateProjectTags < ActiveRecord::Migration[7.2]
  def change
    # 仕様書 §2.4 に timestamps の記載が無いため付けない
    create_table :project_tags do |t|
      t.references :project, null: false, foreign_key: { on_delete: :cascade }
      t.references :tag, null: false, foreign_key: { on_delete: :cascade }
    end

    add_index :project_tags, [ :project_id, :tag_id ], unique: true
  end
end
