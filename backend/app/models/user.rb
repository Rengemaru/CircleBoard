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

  # 空文字は「未入力」として nil に寄せる。
  #
  # 画面のフォームは常に文字列を送るので、一度書いて消すと "" が残り、
  # 一度も書いていない人(nil)と区別が付かなくなる。実際、"" になった人は
  # プロフィールの「—」が出ず、項目名だけの空行になっていた。
  #
  # 画面側で毎回 (value ?? "") === "" と書くより、入り口で1つの形に
  # 揃える方が、後から足す項目でも同じ間違いが起きない
  BLANKABLE_PROFILE_FIELDS = %i[department pronouns bio].freeze

  before_validation :nullify_blank_profile_fields

  # 氏名とメールの上限(2026-09-12 の監査で追加)。企画側と同じ理由で、
  # 書かないかぎり上限は存在しなかった。255 はメールアドレスの実務上の上限
  MAX_NAME_LENGTH = 50
  MAX_EMAIL_LENGTH = 255

  validates :name, presence: true, length: { maximum: MAX_NAME_LENGTH }
  validates :email, presence: true, length: { maximum: MAX_EMAIL_LENGTH },
                    uniqueness: { case_sensitive: false }
  # 公開サーバーで運用するため、最初から8文字以上を必須にする（仕様書 §2.1）
  validates :password, length: { minimum: 8 }, if: -> { password.present? }

  # プロフィールは全項目が任意。書かないまま使える(仕様書 §2.1)。
  # allow_nil / allow_blank は付けない。maximum だけの検証では
  # nil も空文字も長さの条件を満たすので、付けても何も変わらない
  validates :department, length: { maximum: 50 }
  validates :bio, length: { maximum: 500 }
  # 名前の横に並べる欄なので短くする。長い文が入ると、参加者の一覧で
  # 名前が読み取れなくなる(spec-v2.2.md §2.1)
  validates :pronouns, length: { maximum: 20 }
  validate :tags_within_limit
  validate :links_within_limit

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
    graduation_year <= self.class.academic_year(today)
  end

  # 学年の表記(B1 / M1 / D2 …)。
  #
  # 入学年度からの通算年数で決める。1〜4年目が B、5〜6年目が M、
  # 7〜9年目が D(オーナー決定 2026-09-11)。
  #
  # **学部で留年した5年目の人も M1 と出る。** データからは在学中の課程を
  # 区別できないため。「運営でどうにでもなる」という判断で、この形にしている。
  # 正確に出すなら users に課程の列が要る。
  #
  # 卒業後は学年を出さない。B5 や M3 のような存在しない学年になるため。
  # 呼び出し側は graduated? で先に振り分ける。
  #
  # 画面側で計算しない。年度の切り替わり(4月始まり)を跨ぐ規則なので、
  # RubyとTypeScriptに同じものを2本置くことになる(graduated? と同じ理由)
  PROGRAMS = [
    { prefix: "B", years: 4 },
    { prefix: "M", years: 2 },
    { prefix: "D", years: 3 }
  ].freeze

  def grade(today = Date.current)
    return nil if graduated?(today)

    # 入学年度が未来のときは在学していない。0 や負の学年を出さない
    remaining = grade_years(today)
    return nil if remaining < 1

    PROGRAMS.each do |program|
      return "#{program[:prefix]}#{remaining}" if remaining <= program[:years]

      remaining -= program[:years]
    end

    # 10年目以降。博士の3年を超えているが卒業年度は先、という状態。
    # 当てずっぽうの表記を出すより、出さない方がよい
    nil
  end

  # 在学何年目か。1 が B1、5 が M1、9 が D3 で、grade の表記と1対1に対応する。
  #
  # **管理画面が入力するのはこの数字で、入学年度ではない**（オーナー決定 2026-09-11）。
  # 部員ぶんの入学年度と卒業年度を人手で入れるのは現実的でない、という指摘による。
  #
  # それでも列は enrollment_year のまま持つ。「3年目」をそのまま保存すると
  # 翌年度には嘘になり、毎年全員を入れ直すことになるため。入り口で年度に直せば、
  # 4月を跨いだ時点で全員が自動で1つ上がる。
  def grade_years(today = Date.current)
    self.class.academic_year(today) - enrollment_year + 1
  end

  # 入力できる範囲。0 と 10 以上は受け取らない（同上）。
  # 10年目以降は grade が表記を決められず、0 以下は在学していない
  GRADE_YEARS_RANGE = (1..PROGRAMS.sum { |program| program[:years] }).freeze

  # grade_years の裏返し。管理画面から来た「3年目」を入学年度に直す
  def self.enrollment_year_for(grade_years, today = Date.current)
    academic_year(today) - grade_years + 1
  end

  # **いま在籍している課程が終わる年度末に卒業する、とみなす。**
  # B3 なら学部の4年目、M1 なら修士の6年目が終わり。
  #
  # 進学・留年・中退でずれるが、卒業年度を人手で入れない以上、どこかで
  # 決め打つしかない。ずれたときは一覧の現役/卒業生バッジで直せる。
  # graduation_year は NOT NULL なので、発行時に値が要る（spec-v2.2.md §2.1）
  def self.graduation_year_for(grade_years, today = Date.current)
    academic_year(today) + (program_end_years(grade_years) - grade_years) + 1
  end

  # その年数が属する課程の、最後の年。B なら4、M なら6、D なら9
  def self.program_end_years(grade_years)
    total = 0
    PROGRAMS.each do |program|
      total += program[:years]
      return total if grade_years <= total
    end
    total
  end

  # 年度。4月始まりなので、1〜3月はまだ前年度に属する。
  # 2026年3月に卒業する人は graduation_year = 2026
  def self.academic_year(today = Date.current)
    today.month >= 4 ? today.year : today.year - 1
  end

  private

  def nullify_blank_profile_fields
    BLANKABLE_PROFILE_FIELDS.each do |field|
      self[field] = nil if self[field].blank?
    end
  end

  # 上限を超えたことを、どちらの項目の話か分かる文言で返す。
  # 「保存できません」だけだと、どれを減らせばよいのか分からない
  def tags_within_limit
    return if user_tags.reject(&:marked_for_destruction?).size <= MAX_TAGS

    errors.add(:base, "スキルは#{MAX_TAGS}件までです")
  end

  def links_within_limit
    return if user_links.reject(&:marked_for_destruction?).size <= MAX_LINKS

    errors.add(:base, "リンクは#{MAX_LINKS}件までです")
  end
end
