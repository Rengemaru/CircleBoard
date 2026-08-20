module Api
  class SessionsController < ApplicationController
    # GET /api/session
    # 未ログインでも 401 ではなく 200 + null を返す。フロントの初期化で毎回
    # 叩くため、エラー扱いにしない(docs/api-spec.md §1)。
    def show
      render json: { user: current_user && UserSerializer.new(current_user).as_json }
    end

    # POST /api/session
    def create
      user = find_user_by_email(params[:email])

      unless user&.authenticate(params[:password])
        # 「メールアドレスが存在しない」と「パスワードが違う」を区別しない。
        # 区別すると、どのメールアドレスが登録済みかを外部から調べられる
        return render json: {
          error: { code: "unauthorized", message: "メールアドレスまたはパスワードが違います" }
        }, status: :unauthorized
      end

      # セッション固定攻撃対策。ログイン前のセッションIDを使い回さない
      reset_session
      session[:user_id] = user.id

      render json: { user: UserSerializer.new(user).as_json }
    end

    # DELETE /api/session
    def destroy
      reset_session
      head :no_content
    end

    private

    # User のバリデーションが uniqueness: { case_sensitive: false } なので、
    # 探すときも大文字小文字を無視する
    def find_user_by_email(email)
      User.find_by("LOWER(email) = ?", email.to_s.downcase)
    end
  end
end
