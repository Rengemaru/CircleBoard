class Event < ApplicationRecord
  enum :status, { recruiting: 0, completed: 1 }
  enum :visibility, { active: 0, trashed: 1 }
  # 🟡 DBだけ。UIとロジックは作らない
  enum :recurrence_type, { one_time: 0, recurring: 1 }, prefix: true

  belongs_to :owner, class_name: "User", optional: true

  has_many :event_tags, dependent: :destroy
  has_many :tags, through: :event_tags
  # DB側の ON DELETE CASCADE と二重になるが、Rails 経由の削除でも
  # モデルのコールバックが走るよう明示しておく。
  # Project 側は逆に DB 任せにしている(理由は project.rb のコメント)
  has_many :event_participations, dependent: :destroy

  # 参加者数を数えるための、スコープ付きの関連。
  # event_participations.active.size と書くと、includes で事前ロード済みでも
  # スコープ呼び出しでキャッシュが捨てられ、1件ごとに COUNT が飛ぶ(実測済み)。
  # 関連側にスコープを付けておけば includes がその条件のまま先読みするので、
  # イベントが何件でもSQLは1本で済む。
  has_many :active_event_participations,
           -> { active },
           class_name: "EventParticipation",
           inverse_of: :event,
           dependent: nil
end
