module Api
  module Admin
    class SuspensionsController < ApplicationController
      before_action :require_login
      before_action :require_admin
      before_action :set_user

      # PUT /api/admin/users/:user_id/suspension — 停止
      #
      # 停止は表示上のラベルではない。ApplicationController#current_user が
      # 停止中を nil として扱うので、この時点で相手のセッションは無効になる
      # (spec-v2.2.md §2.1)。
      def update
        return if reject_self

        @user.suspend!
        render json: serialize(@user)
      end

      # DELETE /api/admin/users/:user_id/suspension — 停止解除
      def destroy
        @user.unsuspend!
        render json: serialize(@user)
      end

      private

      def set_user
        @user = User.find_by(id: params[:user_id])
        return if @user

        render_error(:not_found, "ユーザーが見つかりません")
      end

      # 自分自身は停止できない。停止した瞬間に自分のセッションが無効になり、
      # 管理画面から締め出されて解除もできなくなる。
      # 削除の禁止と同じ理由で、管理者が0人になる状態を作らせない
      def reject_self
        return false unless @user.id == current_user.id

        render_error(:unprocessable_entity, "自分自身は停止できません")
        true
      end

      def serialize(user)
        {
          id: user.id,
          suspended: user.suspended?,
          suspended_at: user.suspended_at&.iso8601
        }
      end
    end
  end
end
