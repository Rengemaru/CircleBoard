module Api
  class SessionsController < ApplicationController
    # 初期パスワードのままでも通す(Issue #288)。ここを塞ぐと、
    # 変更画面を出すために状態を問い合わせることも、やり直すために
    # ログアウトすることもできなくなる
    skip_before_action :require_password_change_done

    # GET /api/session
    # 未ログインでも 401 ではなく 200 + null を返す。フロントの初期化で毎回
    # 叩くため、エラー扱いにしない(docs/api-spec.md §1)。
    def show
      render json: session_payload
    end

    # POST /api/session
    def create
      user = find_user_by_email(params[:email])

      unless user&.authenticate(params[:password])
        # 「メールアドレスが存在しない」と「パスワードが違う」を区別しない。
        # 区別すると、どのメールアドレスが登録済みかを外部から調べられる
        return render_error(:unauthorized, "メールアドレスまたはパスワードが違います")
      end

      # 停止中は 403。ここだけ「存在を隠す」原則から外れるが、この分岐に
      # 入れるのはパスワードが合っていた人だけなので、外部から登録済みの
      # メールアドレスを調べる材料にはならない。
      # 一律 401 にすると、止められた本人が「パスワードを間違えた」と思って
      # 何度も試し、部長に問い合わせが来る(spec-v2.2.md §2.1)
      if user.suspended?
        return render_error(:forbidden, "このアカウントは停止されています。部長に連絡してください")
      end

      # セッション固定攻撃対策。ログイン前のセッションIDを使い回さない
      reset_session
      session[:user_id] = user.id

      render json: session_payload
    end

    # DELETE /api/session
    def destroy
      reset_session
      head :no_content
    end

    private

    # password_change_required は**自分の状態だけ**を返す。
    #
    # UserSerializer には入れない。あれは企画の owner など他人を出す所でも
    # 使われるので、入れると「この人は初期パスワードのままだ」が
    # 誰にでも見える。初期パスワードは全員に同じものが配られる前提なので
    # (CLAUDE.md §10)、それは狙う相手の一覧を配るのと同じになる(Issue #288)
    def session_payload
      {
        user: current_user && UserSerializer.new(current_user).as_json,
        password_change_required: signed_in? && current_user.password_unchanged?
      }
    end

    # User のバリデーションが uniqueness: { case_sensitive: false } なので、
    # 探すときも大文字小文字を無視する
    def find_user_by_email(email)
      User.find_by("LOWER(email) = ?", email.to_s.downcase)
    end
  end
end
