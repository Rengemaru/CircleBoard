require "rails_helper"

# 初期パスワードのままの人を止める(Issue #288)。
#
# 初期パスワードは全員に同じものが配られる前提の運用なので(CLAUDE.md §10)、
# 変えていない人が残っていると、その文字列を知っている人が全員のアカウントに
# 入れる。**画面で隠すのではなくAPIで止める**(CLAUDE.md §3-2)。
RSpec.describe "初期パスワードのままのとき", type: :request do
  # :initial_password が「管理者が発行したパスワードのまま」。
  # factory の既定は設定済みなので、ここでは明示的に付ける
  let(:user) { create(:user, :initial_password, password: "initialpass1") }
  let(:admin) { create(:user, :admin, :initial_password, password: "initialpass1") }

  describe "他のAPIを弾く" do
    before { sign_in(user, password: "initialpass1") }

    it "イベント一覧を 403 で弾く" do
      get "/api/events"

      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body.dig("error", "message")).to include("初期パスワード")
    end

    it "プロフィールの取得を 403 で弾く" do
      get "/api/users/me"

      expect(response).to have_http_status(:forbidden)
    end

    it "企画の作成を 403 で弾き、作らせない" do
      expect {
        post "/api/events", params: { event: { title: "作れないはず", starts_at: 3.days.from_now } }, as: :json
      }.not_to change(Event, :count)

      expect(response).to have_http_status(:forbidden)
    end

    it "管理者でも弾く" do
      sign_in(admin, password: "initialpass1")
      get "/api/admin/users"

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "通してよい所" do
    before { sign_in(user, password: "initialpass1") }

    it "セッションの取得は通り、password_change_required が true になる" do
      get "/api/session"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["password_change_required"]).to be true
    end

    it "ログアウトできる" do
      delete "/api/session"

      expect(response).to have_http_status(:no_content)
    end

    # **ここが塞がると詰む。** 変更するための唯一の経路
    it "パスワードの変更は通る" do
      patch "/api/users/me/password",
            params: { current_password: "initialpass1", password: "mynewpass123" }, as: :json

      expect(response).to have_http_status(:no_content)
    end
  end

  it "変更したあとは普通に使える" do
    sign_in(user, password: "initialpass1")
    patch "/api/users/me/password",
          params: { current_password: "initialpass1", password: "mynewpass123" }, as: :json

    get "/api/events"
    expect(response).to have_http_status(:ok)

    get "/api/session"
    expect(response.parsed_body["password_change_required"]).to be false
  end

  # 再発行の直後は、また管理者の知っているパスワードに戻っている
  it "管理者が再発行すると、その人はまた弾かれる" do
    user.update!(password: "ownpassword1", password_changed_at: Time.current)
    admin.update!(password_changed_at: Time.current)   # 管理者自身は通れる状態にしておく

    sign_in(admin, password: "initialpass1")
    put "/api/admin/users/#{user.id}/password", params: { password: "reissued12345" }, as: :json
    expect(response).to have_http_status(:no_content)

    sign_in(user, password: "reissued12345")
    get "/api/events"

    expect(response).to have_http_status(:forbidden)
  end

  describe "巻き込まないもの" do
    # 部室のディスプレイを止めない。管理者が自分のブラウザで開くと
    # current_user が居るので、素通りに頼らず明示的に外している
    it "サイネージは、初期パスワードのままの管理者が開いても見られる" do
      token = SignageToken.create!(name: "部室ディスプレイ")
      sign_in(admin, password: "initialpass1")

      get "/api/signage", params: { token: token.token }

      expect(response).to have_http_status(:ok)
    end

    it "未ログインのイベント一覧は今までどおり見られる" do
      get "/api/events"

      expect(response).to have_http_status(:ok)
    end

    it "死活監視は通る" do
      get "/healthz"

      expect(response).to have_http_status(:ok)
    end

    # 停止中は「未ログイン扱い」になるので 401。403 と混ざらないこと
    it "停止中のユーザーは 403 ではなく 401 のまま" do
      sign_in(user, password: "initialpass1")
      user.suspend!

      get "/api/users/me"

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
