# プロジェクトの脱退を申請制にする(spec-v2.2.md §2.6。オーナー決定 2026-09-12)。
#
# 時刻を2本持つ。真偽値と時刻の2本にすると「フラグは立っているが時刻が無い」
# 状態が作れる(suspended_at や events.cancelled_at と同じ考え方)。
#
#   参加中       … 両方 null
#   脱退を申請中 … withdrawal_requested_at だけ時刻
#   脱退済み     … 両方に時刻
class AddWithdrawalToProjectParticipations < ActiveRecord::Migration[7.2]
  def change
    add_column :project_participations, :withdrawal_requested_at, :datetime
    add_column :project_participations, :cancelled_at, :datetime

    # 抜けた人を一意制約の対象から外す。素のユニークのままだと、一度抜けた人が
    # 同じプロジェクトに戻れない。イベント側と同じ形にする
    # (index_event_participations_active)
    remove_index :project_participations, %i[project_id user_id], unique: true
    add_index :project_participations, %i[project_id user_id],
              unique: true,
              where: "cancelled_at IS NULL",
              name: "index_project_participations_active"
  end
end
