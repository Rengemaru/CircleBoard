class AddProfileToUsers < ActiveRecord::Migration[7.2]
  # マイページ(docs/spec-my-page.md、spec-v2.2.md §2.1)。
  #
  # どちらも NULL 可。§0.3 の「後から追加したとき既存の全行にデータを
  # 入れ直す必要があるか」に照らして、学科も自己紹介も空のまま成立する。
  #
  # bio が text なのは改行を含む数百字を想定しているため。string(varchar 255)
  # では足りない。長さの上限(50字 / 500字)はモデル側で見る。
  #
  # インデックスは張らない。プロフィールで絞り込む画面が無い
  # （「機械学習ができる人を探す」は今回のスコープ外。仕様書 §9）。
  def change
    add_column :users, :department, :string
    add_column :users, :bio, :text
  end
end
