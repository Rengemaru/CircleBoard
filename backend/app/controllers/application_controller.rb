class ApplicationController < ActionController::API
  # APIモードの ActionController::API は Cookies を含まないので明示的に入れる
  include ActionController::Cookies

  # 初期パスワードのままの人に、他の操作をさせない(Issue #288)。
  #
  # **全体に掛けて、通してよい所だけ skip する。** 逆にすると、
  # 新しいコントローラを足した人が付け忘れた瞬間に穴が開く。
  # 塞ぎ忘れより、通し忘れの方が気づける(画面が動かないのですぐ分かる)
  before_action :require_password_change_done

  private

  # 認証状態の判定はここ1箇所だけ。各コントローラで再定義しないこと。
  # サイネージは「トークン認証は通っているが current_user は nil」という
  # 状態になる(docs/api-spec.md §0)。混同すると事故る。
  def current_user
    return @current_user if defined?(@current_user)

    user = User.find_by(id: session[:user_id])

    # 停止中は、すでに発行済みのセッションでも未ログイン扱いにする
    # (spec-v2.2.md §2.1)。ログイン時だけ弾くと、停止した瞬間にブラウザを
    # 開いたままの人は操作を続けられてしまう。「ログインさせない」だけでは
    # 停止にならない
    @current_user = user&.suspended? ? nil : user
  end

  def signed_in?
    current_user.present?
  end

  # ログイン必須のエンドポイントで使う。
  # フロントでボタンを隠すのは表示の話であって制限ではないので、API側で弾く
  def require_login
    render_error(:unauthorized, "ログインしてください") unless signed_in?
  end

  # 管理者専用のエンドポイントで使う。
  # docs/api-spec.md §6 は「すべてのエンドポイントで role: admin を検証する。
  # フロントでメニューを隠すだけにしない」と定めている
  def require_admin
    render_error(:forbidden, "管理者権限が必要です") unless current_user&.admin?
  end

  # 初期パスワードのままなら 403(Issue #288)。
  #
  # 初期パスワードは全員に同じものが配られる前提の運用なので(CLAUDE.md §10)、
  # 変えていない人が残っていると、その文字列を知っている人が全員のアカウントに
  # 入れる。本人が設定するまで使わせない。
  #
  # **未ログインは素通しする。** ここで弾くと、ログイン画面もイベント一覧も
  # 見られなくなる。ログインの要否は require_login の仕事で、こちらは
  # 「ログインしている人が使えるかどうか」だけを見る。
  # サイネージ(?token=)も current_user が nil なのでここを通る
  def require_password_change_done
    return unless signed_in?
    return unless current_user.password_unchanged?

    render_error(:forbidden, "初期パスワードのままです。パスワードを変更してください")
  end

  # 企画を編集・削除してよいのは owner 本人と管理者だけ(docs/api-spec.md §2/§3)。
  # イベントとプロジェクトで同じ判定なので、ここに置く
  def owner_or_admin?(resource)
    current_user.admin? || resource.owner_id == current_user.id
  end

  # 1つの企画・プロフィールに付けられるタグの数(docs/spec-tags.md §3.2)。
  # User::MAX_TAGS と同じ値だが、あちらは「その人のスキル」、こちらは
  # 「企画の分野」で意味が違うので、同じ定数を共有しない
  MAX_TAGS_PER_RESOURCE = 5

  # tag_names で指定されたタグを引く。無ければその場で作る(docs/spec-tags.md §3.5)。
  # イベント・プロジェクト・プロフィールで同じ処理になるためここに置く。
  #
  # **名前で受け取るのは、まだ存在しないタグがIDを持てないため。** 以前は tag_ids
  # だったが、自由記述にした時点でIDでは表現できなくなった(§3.7)。
  #
  # 形が違うもの・空・長すぎるもの・多すぎるものは nil を返す(呼び出し側で422にする)。
  # 黙って無視すると、タグを付けたつもりが付いていない状態に気づけない。
  #
  # category を必ず受け取るのは、企画とプロフィールで語彙を分けているため(§3.4)。
  # 既定値を持たせると、付け忘れた側が企画用の語彙に混ざる
  def resolve_tag_names(raw_names, category:)
    return [] if raw_names.blank?
    # 配列以外(ハッシュなど)で渡された場合は弾く。map を呼んで
    # NoMethodError で 500 にしない
    return nil unless raw_names.is_a?(Array)
    return nil unless raw_names.all? { |name| name.is_a?(String) }

    names = raw_names.map { |name| Tag.normalize_name(name) }.reject(&:blank?).uniq
    return nil if names.size > MAX_TAGS_PER_RESOURCE
    return nil if names.any? { |name| name.length > Tag::MAX_NAME_LENGTH }

    find_or_create_tags(names, category)
  end

  # 同じ名前を同時に2人が送ると、どちらも「無い」と判断して両方 INSERT する。
  # UNIQUE(name, category) が片方を弾くので、そこだけ拾って引き直す
  def find_or_create_tags(names, category)
    names.map do |name|
      Tag.find_or_create_by!(name: name, category: category)
    rescue ActiveRecord::RecordNotUnique
      Tag.find_by!(name: name, category: category)
    end
  end

  # エラーレスポンスの形は docs/api-spec.md §0 の
  # { "error": { "code": ..., "message": ... } } に統一する。
  # 各コントローラでハッシュを組み立てると、形がずれても気づけない。
  #
  # code は Rails のステータスシンボルをそのまま文字列にしている
  # (:unauthorized → "unauthorized")。対応表を別に持つと二重管理になるため。
  def render_error(status, message)
    render json: { error: { code: status.to_s, message: message } }, status: status
  end
end
