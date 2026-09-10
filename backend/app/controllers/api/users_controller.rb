module Api
  class UsersController < ApplicationController
    # プロフィールは未ログインには一切返さない(spec-v2.2.md §4.1)。
    # 表示で隠すのではなく、ここで弾く(CLAUDE.md §3-2)
    before_action :require_login

    def me
      render json: ProfileSerializer.new(with_profile(current_user), current_user:).as_json
    end

    def show
      user = User.includes(:tags, :user_links).find_by(id: params[:id])
      return render_error(:not_found, "ユーザーが見つかりません") if user.nil?

      render json: ProfileSerializer.new(user, current_user:).as_json
    end

    private

    # tags と links を引くので事前に読む(CLAUDE.md §3-3)。
    # current_user は認証で取ってきたものなので関連が読み込まれていない
    def with_profile(user)
      User.includes(:tags, :user_links).find(user.id)
    end
  end
end
