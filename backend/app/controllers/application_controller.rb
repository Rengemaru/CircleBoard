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
