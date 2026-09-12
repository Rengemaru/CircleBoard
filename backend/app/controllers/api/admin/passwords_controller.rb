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

      # JSON の自動ラップを切る。**このコントローラ名だと params[:password] に
      # ボディ全体が入る。** ActionController::ParamsWrapper は JSON を
      # コントローラ名(passwords → password)のキーで包むので、
      # { "current_password": "x" } が { "password": { "current_password": "x" } } になり、
      # 「新しいパスワードが無い」を検知できなくなる。
      #
      # ラップが要るのは params.require(:user) のように受ける場合で、ここは違う
      wrap_parameters false

      # PUT /api/admin/users/:user_id/password
      def update
        # **空文字と未指定をここで弾く。** has_secure_password の setter は空文字を
        # 渡されても何もせず、User の長さ検証も present? を条件にしているので
        # 素通りする。結果、**何も変えていないのに成功を返していた**（204）。
        # 管理者は再発行したつもりで、使えない値を本人に伝えることになる
        if params[:password].blank?
          return render_error(:unprocessable_entity, "新しいパスワードを入力してください")
        end

        # password_changed_at を nil に戻す。再発行した直後は、また管理者の
        # 知っているパスワードに戻っている。ここを素通しにすると、
        # 本人に設定させる仕組み(Issue #288)が再発行のたびに抜ける
        if @user.update(password: params[:password], password_changed_at: nil)
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
