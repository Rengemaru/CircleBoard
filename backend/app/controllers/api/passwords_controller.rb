module Api
  # 本人によるパスワードの変更(docs/spec-admin-operations.md §3.1)。
  #
  # プロフィールの更新(UsersController#update)と入口を分けている。
  # 現在のパスワードを要求する点も、間違えたときに返すものも違うため。
  class PasswordsController < ApplicationController
    before_action :require_login

    # PATCH /api/users/me/password
    def update
      # **現在のパスワードを必ず検証する。** これが無いと、席を外した隙に
      # 画面を触られただけでパスワードを書き換えられ、乗っ取りが固定化する。
      # ログイン中であることは「本人である」ことの証明にならない
      unless current_user.authenticate(params[:current_password].to_s)
        return render_error(:unauthorized, "現在のパスワードが違います")
      end

      if current_user.update(password: params[:password])
        head :no_content
      else
        render_error(:unprocessable_entity, current_user.errors.full_messages.join("、"))
      end
    end
  end
end
