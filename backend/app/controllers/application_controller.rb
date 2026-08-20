class ApplicationController < ActionController::API
  # APIモードの ActionController::API は Cookies を含まないので明示的に入れる
  include ActionController::Cookies

  private

  # 認証状態の判定はここ1箇所だけ。各コントローラで再定義しないこと。
  # サイネージは「トークン認証は通っているが current_user は nil」という
  # 状態になる(docs/api-spec.md §0)。混同すると事故る。
  def current_user
    return @current_user if defined?(@current_user)

    @current_user = User.find_by(id: session[:user_id])
  end

  def signed_in?
    current_user.present?
  end

  # ログイン必須のエンドポイントで使う。
  # フロントでボタンを隠すのは表示の話であって制限ではないので、API側で弾く
  def require_login
    render_error(:unauthorized, "ログインしてください") unless signed_in?
  end

  # 企画を編集・削除してよいのは owner 本人と管理者だけ(docs/api-spec.md §2/§3)。
  # イベントとプロジェクトで同じ判定なので、ここに置く
  def owner_or_admin?(resource)
    current_user.admin? || resource.owner_id == current_user.id
  end

  # tag_ids で指定されたタグを引く。イベントとプロジェクトで同じ処理になるためここに置く。
  #
  # 存在しないIDや category: skill が混ざっていたら nil を返す(呼び出し側で422にする)。
  # 黙って無視すると、タグを付けたつもりが付いていない状態に気づけないため。
  # 重複は取り除く。UNIQUE(event_id, tag_id) があるので同じIDを2回渡されても
  # DBは壊れないが、その手前で整えておく
  def resolve_tags(raw_ids)
    return [] if raw_ids.blank?
    # 配列以外(ハッシュなど)で渡された場合は弾く。to_i を呼んで
    # NoMethodError で 500 にしない
    return nil unless raw_ids.is_a?(Array)

    ids = raw_ids.map { |id| Integer(id, exception: false) }
    return nil if ids.any?(&:nil?)

    ids = ids.uniq
    tags = Tag.project_event.where(id: ids).to_a
    tags.size == ids.size ? tags : nil
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
