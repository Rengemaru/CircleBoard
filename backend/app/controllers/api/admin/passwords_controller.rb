module Api
  module Admin
    # 管理者によるパスワードの再発行(docs/spec-admin-operations.md §3.1)。
    #
    # **現在のパスワードは求めない。** 忘れた人が対象なので、本人も知らない。
    # 設定した値は口頭かDMで本人に伝える(アカウント発行と同じ運用)。
    #
    # 通知機能を作らない方針(CLAUDE.md §10)なので、メールでリセットリンクを
    # 送る方式は採れない。
    class PasswordsController < ApplicationController
      before_action :require_login
      before_action :require_admin
      before_action :set_user

      # PUT /api/admin/users/:user_id/password
      def update
        if @user.update(password: params[:password])
          head :no_content
        else
          render_error(:unprocessable_entity, @user.errors.full_messages.join("、"))
        end
      end

      private

      def set_user
        @user = User.find_by(id: params[:user_id])
        return if @user

        render_error(:not_found, "ユーザーが見つかりません")
      end
    end
  end
end
