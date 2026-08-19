class EventParticipation < ApplicationRecord
  # キャンセルは物理削除せず cancelled_at に時刻を入れる運用なので、
  # 「今の参加者」を数えるにはこのスコープで絞る必要がある
  scope :active, -> { where(cancelled_at: nil) }

  belongs_to :event
  belongs_to :user, optional: true
end
