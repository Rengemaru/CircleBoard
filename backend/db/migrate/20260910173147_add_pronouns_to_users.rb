class AddPronounsToUsers < ActiveRecord::Migration[7.2]
  # 呼ばれ方(spec-v2.2.md §2.1)。Discord のプロフィールの Pronouns 欄と
  # 同じ考え方で、参加者や主催者の名前の横に出す。
  #
  # 自由入力にする。選択肢を用意すると、当てはまらない人が書けなくなる。
  # 「さん付けで」「呼び捨てOK」のような、代名詞に限らない書き方もできる。
  #
  # NULL 可。書かないまま使える(§0.3)。既存の行に入れ直すものは無い。
  # 長さの上限(20字)はモデル側で見る
  def change
    add_column :users, :pronouns, :string
  end
end
