class User < ApplicationRecord
  has_secure_password

  enum :role, { admin: 0, member: 1, demo: 2 }

  has_many :owned_events,   class_name: "Event",   foreign_key: :owner_id, dependent: :nullify
  has_many :owned_projects, class_name: "Project", foreign_key: :owner_id, dependent: :nullify
  has_many :event_participations, dependent: :nullify
  has_many :project_participations, dependent: :nullify

  validates :name, presence: true
  validates :email, presence: true, uniqueness: { case_sensitive: false }
  # 公開サーバーで運用するため、最初から8文字以上を必須にする（仕様書 §2.1）
  validates :password, length: { minimum: 8 }, if: -> { password.present? }
end
