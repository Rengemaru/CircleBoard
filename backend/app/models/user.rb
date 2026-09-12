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
  # 自己紹介。Markdown で書けるようにしたぶん増やす
  # (Issue #303。spec-v2.2.md §2 の500字を変更。オーナー決定 2026-09-13)。
  # 直値ではなく定数にしたのは、spec が数字を焼き込まないようにするため
  MAX_BIO_LENGTH = 1000
  MAX_EMAIL_LENGTH = 255

  # メールの形式(2026-09-12 の監査で追加)。存在と一意性しか見ておらず、
  # API を直接叩けば "not-an-email" が保存できた。
  # ログインできないアカウントを発行できてしまうのが実害。
  #
  # **RFC 準拠の正規表現は書かない。** 読めないものを置いても誰も直せない
  # (CLAUDE.md §0)。打ち間違いを弾くのが目的なので、「@ と空白を含まない文字列
  # @ @と空白を含まない文字列 . @と空白を含まない文字列」で足りる
  EMAIL_FORMAT = /\A[^@\s]+@[^@\s]+\.[^@\s]+\z/

  validates :name, presence: true, length: { maximum: MAX_NAME_LENGTH }
  validates :email, presence: true, length: { maximum: MAX_EMAIL_LENGTH },
                    format: { with: EMAIL_FORMAT, message: "の形式が正しくありません" },
                    uniqueness: { case_sensitive: false }
  # 公開サーバーで運用するため、最初から8文字以上を必須にする（仕様書 §2.1）
  validates :password, length: { minimum: 8 }, if: -> { password.present? }

  # プロフィールは全項目が任意。書かないまま使える(仕様書 §2.1)。
  # allow_nil / allow_blank は付けない。maximum だけの検証では
  # nil も空文字も長さの条件を満たすので、付けても何も変わらない
  validates :department, length: { maximum: 50 }
  validates :bio, length: { maximum: MAX_BIO_LENGTH }
  # 名前の横に並べる欄なので短くする。長い文が入ると、参加者の一覧で
  # 名前が読み取れなくなる(spec-v2.2.md §2.1)
  validates :pronouns, length: { maximum: 20 }
  validate :tags_within_limit
  validate :links_within_limit

  # 年度の範囲(2026-09-12 の監査で追加。オーナー承認済み)。
  #
  # NOT NULL なだけで、0 でも 99999 でも通っていた。学年表記(B1〜D3)も卒業判定も
  # 年度から計算するので、そこが壊れると両方おかしくなる。int4 を超える値では
  # 保存時に ActiveModel::RangeError が飛んで 500 になっていた。
  #
  # **値を変えたときだけ見る。** 10年以上前に入学した卒業生の記録は範囲の外に
  # いることがあり、毎回見ると停止・権限変更といった無関係な更新まで通らなくなる。
  ENROLLMENT_YEARS_BACK = 10
  # 翌年度の入学者を先に登録できるようにする
  ENROLLMENT_YEARS_AHEAD = 1
  MAX_YEARS_TO_GRADUATION = 10

  validate :enrollment_year_within_range, if: :enrollment_year_changed?
  validate :graduation_year_within_range,
           if: -> { enrollment_year_changed? || graduation_year_changed? }
  validate :graduation_year_after_enrollment,
           if: -> { enrollment_year_changed? || graduation_year_changed? }

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

  # 管理者が発行したパスワードのままか(Issue #288)。
  #
  # 初期パスワードは全員に同じものが配られる前提の運用なので(CLAUDE.md §10)、
  # 変えていない人が残っていると、その文字列を知っている人が全員のアカウントに
  # 入れる。本人が設定するまで使わせない判断に使う。
  #
  # **パスワードの中身では判定できない。** password_digest しか持っていないので、
  # 「初期値と同じか」を突き合わせる方法が無い。設定し直した事実を記録する
  # 値の更新は password と同じ update で行う(before_save のコールバックにしない)。
  # 本人が変えたときは時刻、管理者が再発行したときは nil と、
  # 同じ「password_digest が変わった」でも入れる値が逆になるため、
  # モデル側からは誰が変えたのかを判定できない
  def password_unchanged? = password_changed_at.nil?

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

  # 在学は最長でも9年目まで(GRADE_YEARS_RANGE)。それより古い入学年度は
  # 打ち間違いとみなす
  def enrollment_year_within_range
    return if enrollment_year.nil? || enrollment_year_in_range?

    this_year = self.class.academic_year
    errors.add(:enrollment_year,
               "は#{this_year - ENROLLMENT_YEARS_BACK}〜#{this_year + ENROLLMENT_YEARS_AHEAD}で入力してください")
  end

  # 卒業年度そのものの妥当性。0 や 99999、int4 を超える値を弾く。
  #
  # **入学年度を基準にしない。** 基準にすると、10年以上前に入学した卒業生を
  # 「現役に戻す」ときに落ちる。あの操作は卒業年度を今の年度の次に置き直すので、
  # 古い入学年度から見れば必ず範囲の外になる(graduations_controller#destroy)。
  # 入学年度との前後関係は graduation_year_after_enrollment が別に見る
  def graduation_year_within_range
    return if graduation_year.nil?

    this_year = self.class.academic_year
    range = (this_year - MAX_YEARS_TO_GRADUATION)..(this_year + MAX_YEARS_TO_GRADUATION)
    return if range.cover?(graduation_year)

    errors.add(:graduation_year, "は#{range.first}〜#{range.last}で入力してください")
  end

  # 入学より前には卒業できない。同じ年は通す。一覧の「卒業生にする」が卒業年度を
  # 今の年度まで引き寄せるので、入学した年度に辞めた人は両方が同じ年になる。
  #
  # **入学年度が自分の範囲の外にあるときは見ない。** 古い卒業生の記録は入学年度も
  # 範囲の外にいることがあり、基準として信用できない。ここで止めると、その人を
  # 現役に戻すことも学年を入れ直すこともできなくなる
  def graduation_year_after_enrollment
    return if enrollment_year.nil? || graduation_year.nil?
    return unless enrollment_year_in_range?
    return if graduation_year >= enrollment_year

    errors.add(:graduation_year, "は入学年度以降にしてください")
  end

  def enrollment_year_in_range?
    this_year = self.class.academic_year
    ((this_year - ENROLLMENT_YEARS_BACK)..(this_year + ENROLLMENT_YEARS_AHEAD)).cover?(enrollment_year)
  end

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
