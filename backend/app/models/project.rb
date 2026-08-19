class Project < ApplicationRecord
  enum :status, { recruiting: 0, in_progress: 1, completed: 2 }
  enum :visibility, { active: 0, trashed: 1 }
  # 🟡 DBだけ。UIとロジックは作らない
  enum :recurrence_type, { one_time: 0, recurring: 1 }, prefix: true

  belongs_to :owner, class_name: "User", optional: true

  has_many :project_tags, dependent: :destroy
  has_many :tags, through: :project_tags
  # プロジェクトを消しても参加レコードは残す（project_id が NULL になる）ため
  # dependent は指定しない。DB側の ON DELETE SET NULL に任せる
  has_many :project_participations
end
