class Event < ApplicationRecord
  enum :status, { recruiting: 0, completed: 1 }
  enum :visibility, { active: 0, trashed: 1 }
  # 🟡 DBだけ。UIとロジックは作らない
  enum :recurrence_type, { one_time: 0, recurring: 1 }, prefix: true

  belongs_to :owner, class_name: "User", optional: true

  # DB の NOT NULL 制約に対応する presence のみ(仕様書 §2.2)。
  # 一意性や数値範囲など、仕様書に無い検証は足さない。
  # DB制約だけだと保存時に例外が飛び、フォームにエラーを返せないため
  # アプリ層にも同じ制約を置いている。
  validates :title, presence: true
  validates :description, presence: true
  validates :location, presence: true
  validates :starts_at, presence: true

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
