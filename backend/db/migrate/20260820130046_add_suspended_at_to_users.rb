class AddSuspendedAtToUsers < ActiveRecord::Migration[7.2]
  # アカウント停止(spec-v2.2.md §0.4-1、§2.1)。
  #
  # 真偽値ではなく時刻。event_participations.cancelled_at と同じで、
  # 「いつ止めたか」を残すため。NULL = 有効。
  #
  # インデックスは張らない。部員は数十人で、停止中を絞り込むのも
  # 管理画面の一覧を全件読んだあとの話なので、効かせる相手がいない。
  def change
    add_column :users, :suspended_at, :datetime
  end
end
