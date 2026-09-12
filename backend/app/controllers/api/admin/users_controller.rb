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
      #
      # 学年は編集と同じく「在学何年目か」(1〜9)で受け取り、入学年度と卒業年度は
      # サーバーが逆算する。年度を人手で入れるのは現実的でない
      # (オーナー決定 2026-09-11。update と同じ扱いに揃えた)
      def create
        # 発行では必須。年度は grade_years からしか決まらないので、無いまま保存すると
        # NOT NULL に当たって 500 になる。編集では任意（権限だけ直すことがある）
        if params.dig(:user, :grade_years).nil?
          return render_error(:unprocessable_entity, "学年を指定してください")
        end

        user = User.new(user_params.except(:role))
        error = apply_role(user) || apply_grade_years(user)
        return render_error(:unprocessable_entity, error) if error

        if user.save
          render json: { user: UserSerializer.new(user).as_json }, status: :created
        else
          render_error(:unprocessable_entity, user.errors.full_messages.join("、"))
        end
      end

      # PATCH /api/admin/users/:id
      #
      # 権限・学年・氏名を変える(docs/spec-admin-operations.md §3.3/§3.4)。
      # メール・学科は扱わない。学科は本人が /me/edit で書く。
      #
      # **氏名は本人も変えられる**(PATCH /api/users/me)。入口が2つになるが、
      # 直したい人が違う。改姓は本人が気づき、打ち間違いは発行した管理者が
      # 気づく(オーナー決定 2026-09-12)
      #
      # **現役⇄卒業はここでは動かさない。** 卒業は graduation_year からの
      # 計算結果で、一覧のバッジが専用の入口(graduations_controller)を持つ。
      # 権限を直すつもりの保存で、卒業生が現役に戻らないようにするため
      def update
        user = User.find_by(id: params[:id])
        return render_error(:not_found, "ユーザーが見つかりません") if user.nil?

        error = apply_role(user) || apply_grade_years(user)
        return render_error(:unprocessable_entity, error) if error

        user.name = update_params[:name] if update_params.key?(:name)

        if user.save
          render json: serialize(user)
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

      # demo は受け取らない。users.role には確保しているが画面に出さない
      # 既定なので(ワイヤーフレーム③)、APIからも入れられないようにしておく
      ASSIGNABLE_ROLES = %w[admin member].freeze

      # 権限を組み立てる。問題があればその文言を返す(nil なら通す)。
      #
      # 発行と編集の両方から呼ぶ。発行が素通しだったため、画面に出していない
      # demo を curl から作れ、未知の値では User.new の時点で ArgumentError が
      # 出て 500 になっていた(2026-09-12 の監査)
      def apply_role(user)
        role = params.dig(:user, :role)
        return nil if role.nil?
        return "権限は管理者かメンバーのどちらかです" unless ASSIGNABLE_ROLES.include?(role)
        return nil if role == user.role

        # 自分自身は変えられない。降格した瞬間にこの画面から締め出され、
        # 自分で戻すこともできなくなる。
        #
        # **これがあるので「管理者が0人になる」は起こらない。** 操作している
        # 本人は必ず管理者のまま残るため、降格の上限は1人手前で止まる
        # (destroy が自分自身を消させないのと同じ理由)
        return "自分自身の権限は変更できません" if user.id == current_user.id

        user.role = role
        nil
      end

      # 学年は「在学何年目か」(1〜9)で受け取る。入学年度は User が逆算する。
      # 部員ぶんの年度を人手で入れるのは現実的でない(オーナー決定 2026-09-11)。
      #
      # 発行と編集の両方から呼ぶ。年度の決め方が2通りあると、発行した人だけ
      # 学年がずれる、という食い違いが生まれる
      def apply_grade_years(user)
        raw = params.dig(:user, :grade_years)
        return nil if raw.nil?

        years = Integer(raw, exception: false)
        unless years && User::GRADE_YEARS_RANGE.cover?(years)
          return "学年は#{User::GRADE_YEARS_RANGE.first}〜#{User::GRADE_YEARS_RANGE.last}の数字です"
        end

        # 卒業生に学年は無い(User#grade は nil を返す)。ここで通すと、
        # 卒業年度が導出値で上書きされて現役に戻ってしまう。先にバッジで戻す。
        #
        # persisted? を見るのは、発行のときはまだ卒業年度が入っておらず
        # graduated? が nil を比較して落ちるため。新規は必ず現役になる
        if user.persisted? && user.graduated?
          return "卒業生の学年は変えられません。先に現役に戻してください"
        end

        user.enrollment_year = User.enrollment_year_for(years)
        user.graduation_year = User.graduation_year_for(years)
        nil
      end

      def update_params
        @update_params ||= params.require(:user).permit(:role, :grade_years, :name)
      end

      def serialize(user)
        {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          enrollment_year: user.enrollment_year,
          graduation_year: user.graduation_year,
          # 未入力は null。本人が /me/edit で書くもので、ここでは編集しない
          department: user.department,
          # 卒業したかどうかは年度の切り替わりを跨ぐ判断なので、
          # 画面ごとに計算させない(User#graduated? 参照)
          graduated: user.graduated?,
          # 学年の表記(B3 / M1 …)と、その元になる在学年数。
          # 卒業生と10年目以降は grade が nil になる
          grade: user.grade,
          grade_years: user.grade_years,
          # NULL = 有効。時刻が入っていれば停止中(spec-v2.2.md §2.1)
          suspended: user.suspended?,
          suspended_at: user.suspended_at&.iso8601
        }
      end

      # 年度は受け取らない。grade_years から逆算する(apply_grade_years)。
      # 両方受け取れるようにすると、どちらが勝つのかが読めなくなる。
      #
      # role は permit するが、User.new には渡さない(apply_role が検証してから
      # 入れる)。未知の値を enum に直接渡すと ArgumentError で 500 になる
      def user_params
        params.require(:user).permit(:name, :email, :password, :role)
      end
    end
  end
end
