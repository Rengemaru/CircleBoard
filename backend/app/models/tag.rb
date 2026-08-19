class Tag < ApplicationRecord
  # 1:skill は未使用。値の追加にマイグレーションが要らないよう integer + Rails の enum で持つ
  enum :category, { project_event: 0, skill: 1 }

  has_many :event_tags, dependent: :destroy
  has_many :events, through: :event_tags
  has_many :project_tags, dependent: :destroy
  has_many :projects, through: :project_tags
end
