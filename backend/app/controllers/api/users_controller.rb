module Api
  class UsersController < ApplicationController
    # プロフィールは未ログインには一切返さない(spec-v2.2.md §4.1)。
    # 表示で隠すのではなく、ここで弾く(CLAUDE.md §3-2)
    before_action :require_login

    def me
      render json: ProfileSerializer.new(with_profile(current_user), current_user:).as_json
    end

    # 更新できるのは自分のプロフィールだけ。パスを /users/me の1本にして、
    # 他人を指せる形そのものを作らない。リクエストの id は見ない
    # (docs/spec-my-page.md §6.3。owner_id について決めたのと同じ)。
    #
    # name / email / role / 年度は受け取らない。名前を変えられると、
    # 参加者一覧も主催欄も名前で出ているので他人になりすませる。
    # 変更は管理者の仕事(Issue #4)
    def update
      tags = resolve_tags(params[:tag_ids])
      return render_error(:unprocessable_entity, "タグの指定が正しくありません") if params[:tag_ids] && tags.nil?

      links = links_param
      return render_error(:unprocessable_entity, "リンクの形式が正しくありません") if links == :invalid

      # 3つとも別々にDBへ書くので、まとめて巻き戻せるようにする。
      # 途中で失敗したときに、古いリンクが消えて新しいリンクが入っていない
      # 状態を残さないため(EventsController#update と同じ)
      ActiveRecord::Base.transaction do
        current_user.tags = tags if params[:tag_ids]
        replace_links!(links) if links
        current_user.update!(profile_params)
      end

      render json: ProfileSerializer.new(with_profile(current_user), current_user:).as_json
    rescue ActiveRecord::RecordInvalid => e
      render_error(:unprocessable_entity, e.record.errors.full_messages.join("、"))
    end

    def show
      user = User.includes(:tags, :user_links).find_by(id: params[:id])
      return render_error(:not_found, "ユーザーが見つかりません") if user.nil?

      render json: ProfileSerializer.new(user, current_user:).as_json
    end

    private

    # 丸ごと置き換える。行の追加・削除・並べ替えを個別のAPIにすると、
    # 画面の操作と1対1にならず往復が増える(docs/spec-my-page.md §5)。
    # 送られた配列の順序をそのまま position に落とす
    def replace_links!(links)
      current_user.user_links.destroy_all

      links.each_with_index do |attrs, position|
        current_user.user_links.create!(label: attrs[:label], url: attrs[:url], position: position)
      end
    end

    # 送られていなければ nil(リンクに触らない)、空配列なら全消し。
    # 配列以外を渡されたときは :invalid を返す。permit が黙って落とすので、
    # そのままだと「形が違うのに 200 が返って何も変わらない」ことになる
    def links_param
      return nil unless params.key?(:links)
      return :invalid unless params[:links].is_a?(Array)

      params.permit(links: [ :label, :url ])[:links] || :invalid
    end

    def profile_params
      params.permit(:department, :bio)
    end

    # tags と links を引くので事前に読む(CLAUDE.md §3-3)。
    # current_user は認証で取ってきたものなので関連が読み込まれていない
    def with_profile(user)
      User.includes(:tags, :user_links).find(user.id)
    end
  end
end
