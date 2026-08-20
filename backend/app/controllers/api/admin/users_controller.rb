module Api
  module Admin
    class UsersController < ApplicationController
      before_action :require_login
      before_action :require_admin

      # POST /api/admin/users
      #
      # アカウントの発行だけを担う。一覧・編集・停止・削除のUIは MVP 対象外で、
      # rails console で対応する(CLAUDE.md §10)。
      def create
        user = User.new(user_params)

        if user.save
          render json: { user: UserSerializer.new(user).as_json }, status: :created
        else
          render_error(:unprocessable_entity, user.errors.full_messages.join("、"))
        end
      end

      private

      def user_params
        params.require(:user).permit(
          :name, :email, :password, :enrollment_year, :graduation_year, :role
        )
      end
    end
  end
end
