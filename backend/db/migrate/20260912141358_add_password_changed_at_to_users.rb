class AddPasswordChangedAtToUsers < ActiveRecord::Migration[7.2]
  # 本人が自分でパスワードを設定した時刻(Issue #288)。
  #
  # **既存の行は埋めない。** null は「管理者が発行したパスワードのまま」を
  # 意味する。初期パスワードは全員に同じものが配られる前提の運用なので
  # (CLAUDE.md §10)、既に発行済みの人もまだ変えていない扱いで正しい。
  #
  # boolean ではなく datetime にしたのは、「いつ変えたか」を残すため。
  # あとから管理画面に「まだ変えていない人」を出すときに使える
  def change
    add_column :users, :password_changed_at, :datetime
  end
end
