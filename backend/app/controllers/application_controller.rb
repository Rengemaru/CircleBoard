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
end
