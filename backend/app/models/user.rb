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

  # 日本の学年は4月始まりで、卒業は3月。graduation_year は「卒業する年」なので、
  # 2026年3月に卒業する人は graduation_year = 2026。
  # 1〜3月はまだ前年度に属するため、先に年度を出してから比べる。
  #
  # 画面側で計算しない。ユーザー管理画面とダッシュボードの両方が必要とするので、
  # RubyとTypeScriptに同じ規則を2本置くことになる
  # NULL = 有効。時刻が入っていれば停止中(spec-v2.2.md §2.1)。
  # 真偽値と時刻の2本を持つと「フラグは立っているが時刻が無い」状態が作れる
  scope :suspended, -> { where.not(suspended_at: nil) }

  def suspended? = suspended_at.present?

  def suspend!
    update!(suspended_at: Time.current)
  end

  def unsuspend!
    update!(suspended_at: nil)
  end

  def graduated?(today = Date.current)
    academic_year = today.month >= 4 ? today.year : today.year - 1

    graduation_year <= academic_year
  end
end
