module Api
  module Admin
    class SignageTokensController < ApplicationController
      before_action :require_login
      before_action :require_admin

      # GET /api/admin/signage_tokens
      #
      # 失効済みも含めて全部返す。行を消さないので、どのトークンをいつ止めたかを
      # 管理画面から追える(docs/api-spec.md §6)
      def index
        tokens = SignageToken.order(created_at: :desc)
        render json: { signage_tokens: tokens.map { serialize(_1) } }
      end

      # POST /api/admin/signage_tokens
      def create
        token = SignageToken.new(signage_token_params)

        if token.save
          render json: serialize(token), status: :created
        else
          render_error(:unprocessable_entity, token.errors.full_messages.join("、"))
        end
      end

      # DELETE /api/admin/signage_tokens/:id
      def destroy
        token = SignageToken.find_by(id: params[:id])
        return render_error(:not_found, "トークンが見つかりません") if token.nil?

        # 行を消さない。どのトークンをいつ止めたかの記録を残す(docs/api-spec.md §6)
        token.update!(revoked_at: Time.current)
        head :no_content
      end

      private

      # 管理画面はトークンの実値とURLを見せる必要がある。端末に貼り付けるのが
      # 目的なので、ここだけは伏せない。admin 以外はこのエンドポイントに
      # 到達できない(require_admin)
      def serialize(token)
        {
          id: token.id,
          name: token.name,
          token: token.token,
          url: token.signage_url,
          revoked_at: token.revoked_at&.iso8601,
          created_at: token.created_at.iso8601
        }
      end

      # token は permit しない。サーバー側で生成する
      def signage_token_params
        params.require(:signage_token).permit(:name)
      end
    end
  end
end
