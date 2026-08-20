module Api
  module Admin
    class UsersController < ApplicationController
      before_action :require_login
      before_action :require_admin

      # GET /api/admin/users
      #
      # ユーザー管理画面(wireframes/wireframe-admin-ver2.html ②)で使う。
      #
      # 検索と絞り込みはクエリで受けない。部員は多くても数十人で、
      # 全件返してもレスポンスは小さい。1文字打つたびにサーバーへ往復させるより、
      # 一度返して画面側で絞る方が速く、実装も少ない。
      #
      # UserSerializer を使い回さないのは、あちらが email を返さないため。
      # 「仕様書 §4.1 のアクセス制御表に載っていない情報は外に出さない」という
      # 判断で意図的に落としている。管理画面だけが必要とする形をここで組み立てる。
      def index
        # 卒業年度の新しい順。現役が上に来て、卒業生が下に沈む
        users = User.order(graduation_year: :desc, id: :asc)
        render json: { users: users.map { serialize(_1) } }
      end

      # POST /api/admin/users
      def create
        user = User.new(user_params)

        if user.save
          render json: { user: UserSerializer.new(user).as_json }, status: :created
        else
          render_error(:unprocessable_entity, user.errors.full_messages.join("、"))
        end
      end

      # DELETE /api/admin/users/:id
      #
      # 物理削除。外部キーがすべて ON DELETE SET NULL なので、
      # その人が作った企画と参加記録は残り、owner_id / user_id だけが nil になる
      # (docs/er.md)。卒業生を消しても過去の活動記録は失われない。
      def destroy
        user = User.find_by(id: params[:id])
        return render_error(:not_found, "ユーザーが見つかりません") if user.nil?

        # 自分自身は消せない。これがあれば管理者が0人になることは起こらない。
        # 管理者が自分以外を消せても、消した本人が管理者として残るため
        if user.id == current_user.id
          return render_error(:unprocessable_entity, "自分自身は削除できません")
        end

        user.destroy!
        head :no_content
      end

      private

      def serialize(user)
        {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          enrollment_year: user.enrollment_year,
          graduation_year: user.graduation_year
        }
      end

      def user_params
        params.require(:user).permit(
          :name, :email, :password, :enrollment_year, :graduation_year, :role
        )
      end
    end
  end
end
