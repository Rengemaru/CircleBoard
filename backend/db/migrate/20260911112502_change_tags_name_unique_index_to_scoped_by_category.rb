class ChangeTagsNameUniqueIndexToScopedByCategory < ActiveRecord::Migration[7.2]
  # 企画用とプロフィール用で語彙を分けるため、名前の一意性を category ごとにする
  # (docs/spec-tags.md §3.4 / §4)。
  #
  # 単独 UNIQUE のままだと「3D」を企画用とプロフィール用の両方に持てない。
  # 先に足してから消すのではなく、消してから足す。同じ列を先頭に持つ索引が
  # 2本並ぶ時間を作らないため
  def up
    remove_index :tags, :name
    add_index :tags, [ :name, :category ], unique: true
  end

  def down
    remove_index :tags, [ :name, :category ]
    add_index :tags, :name, unique: true
  end
end
