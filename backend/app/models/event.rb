class Event < ApplicationRecord
  enum :status, { recruiting: 0, completed: 1 }
  enum :visibility, { active: 0, trashed: 1 }
  # 🟡 DBだけ。UIとロジックは作らない
  enum :recurrence_type, { one_time: 0, recurring: 1 }, prefix: true

  belongs_to :owner, class_name: "User", optional: true

  has_many :event_tags, dependent: :destroy
  has_many :tags, through: :event_tags
  has_many :event_participations, dependent: :destroy
end
