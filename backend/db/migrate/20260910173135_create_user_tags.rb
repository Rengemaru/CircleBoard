class CreateUserTags < ActiveRecord::Migration[7.2]
  # 使える技術(spec-v2.2.md §2.8)。企画に付けるタグ(§2.4)を再利用する。
  #
  # ON DELETE CASCADE は両方向。本人が消えたらその人のスキルは残す意味がなく、
  # タグが消えたら「そのタグができる」という記録も意味を失う。
  # event_participations.user_id が SET NULL なのは「参加した事実」を
  # 残すためで、残す価値のあるものとそうでないもので向きを変えている。
  #
  # 仕様書 §2.4 の中間テーブルに合わせて timestamps は付けない。
  def change
    create_table :user_tags do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.references :tag, null: false, foreign_key: { on_delete: :cascade }
    end

    add_index :user_tags, [ :user_id, :tag_id ], unique: true
  end
end
