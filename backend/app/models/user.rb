class User < ApplicationRecord
  has_secure_password

  enum :role, { admin: 0, member: 1, demo: 2 }

  has_many :owned_events,   class_name: "Event",   foreign_key: :owner_id, dependent: :nullify
  has_many :owned_projects, class_name: "Project", foreign_key: :owner_id, dependent: :nullify
  has_many :event_participations, dependent: :nullify
  has_many :project_participations, dependent: :nullify

  # プロフィール(docs/spec-my-page.md)。参加記録が nullify なのは
  # 「参加した事実」を残すためで、本人に属する情報はまとめて消す
  has_many :user_tags, dependent: :destroy
  has_many :tags, through: :user_tags
  has_many :user_links, -> { order(:position) }, dependent: :destroy, inverse_of: :user

  # 件数の上限はここで見る。DB制約で「1人5件まで」は素直に書けない
  MAX_TAGS = 5
  MAX_LINKS = 3

  validates :name, presence: true
  validates :email, presence: true, uniqueness: { case_sensitive: false }
  # 公開サーバーで運用するため、最初から8文字以上を必須にする（仕様書 §2.1）
  validates :password, length: { minimum: 8 }, if: -> { password.present? }

  # プロフィールは全項目が任意。書かないまま使える(仕様書 §2.1)
  validates :department, length: { maximum: 50 }, allow_blank: true
  validates :bio, length: { maximum: 500 }, allow_blank: true
  validate :tags_within_limit
  validate :links_within_limit

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

  private

  # 上限を超えたことを、どちらの項目の話か分かる文言で返す。
  # 「保存できません」だけだと、どれを減らせばよいのか分からない
  def tags_within_limit
    return if user_tags.reject(&:marked_for_destruction?).size <= MAX_TAGS

    errors.add(:tags, "は#{MAX_TAGS}件までです")
  end

  def links_within_limit
    return if user_links.reject(&:marked_for_destruction?).size <= MAX_LINKS

    errors.add(:links, "は#{MAX_LINKS}件までです")
  end
end
