require "rails_helper"

# アカウント停止(spec-v2.2.md §2.1、wireframes/wireframe-admin-ver2.html ②)。
#
# ここで一番大事なのは「停止は表示上のラベルではない」こと。
# 止めた瞬間に、すでにログイン中のセッションも効かなくなる。
RSpec.describe "アカウント停止", type: :request do
  let(:admin) { create(:user, role: :admin) }
  let(:member) { create(:user) }

  describe "PUT /api/admin/users/:user_id/suspension" do
    it "未ログインでは 401 を返し、停止しない" do
      target = member

      put "/api/admin/users/#{target.id}/suspension"

      expect(response).to have_http_status(:unauthorized)
      expect(target.reload).not_to be_suspended
    end

    it "一般メンバーでは 403 を返し、停止しない" do
      target = create(:user)
      sign_in(member)

      put "/api/admin/users/#{target.id}/suspension"

      expect(response).to have_http_status(:forbidden)
      expect(target.reload).not_to be_suspended
    end

    it "管理者は他のユーザーを停止できる" do
      target = create(:user)
      sign_in(admin)

      put "/api/admin/users/#{target.id}/suspension"

      expect(response).to have_http_status(:ok)
      expect(target.reload).to be_suspended
      expect(response.parsed_body["suspended"]).to be(true)
      expect(response.parsed_body["suspended_at"]).to be_present
    end

    # 停止した瞬間に自分のセッションが無効になり、解除もできなくなる
    it "自分自身は停止できず 422 を返す" do
      sign_in(admin)

      put "/api/admin/users/#{admin.id}/suspension"

      expect(response).to have_http_status(:unprocessable_entity)
      expect(admin.reload).not_to be_suspended
    end

    it "存在しないIDでは 404 を返す" do
      sign_in(admin)

      put "/api/admin/users/0/suspension"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/admin/users/:user_id/suspension" do
    it "管理者は停止を解除できる" do
      target = create(:user, suspended_at: Time.current)
      sign_in(admin)

      delete "/api/admin/users/#{target.id}/suspension"

      expect(response).to have_http_status(:ok)
      expect(target.reload).not_to be_suspended
      expect(response.parsed_body["suspended"]).to be(false)
    end

    it "一般メンバーでは 403 を返し、解除しない" do
      target = create(:user, suspended_at: Time.current)
      sign_in(member)

      delete "/api/admin/users/#{target.id}/suspension"

      expect(response).to have_http_status(:forbidden)
      expect(target.reload).to be_suspended
    end
  end

  describe "停止が効いているか" do
    it "停止中はログインできず 403 を返す" do
      user = create(:user, password: "password123", suspended_at: Time.current)

      post "/api/session", params: { email: user.email, password: "password123" }, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body["error"]["message"]).to include("停止")
    end

    # ここが本体。ログイン時だけ弾くのでは「停止」にならない
    it "ログイン済みの人を停止すると、そのセッションは即座に無効になる" do
      user = create(:user, password: "password123")
      post "/api/session", params: { email: user.email, password: "password123" }, as: :json
      expect(response).to have_http_status(:ok)

      user.suspend!

      get "/api/session"
      expect(response.parsed_body["user"]).to be_nil

      # ログイン必須のエンドポイントも通らない
      get "/api/projects"
      expect(response).to have_http_status(:unauthorized)
    end

    it "停止を解除すると、また使えるようになる" do
      user = create(:user, password: "password123", suspended_at: Time.current)

      user.unsuspend!
      post "/api/session", params: { email: user.email, password: "password123" }, as: :json

      expect(response).to have_http_status(:ok)
    end

    # 停止は削除ではない。データは消さない
    it "停止しても、その人が作った企画は残る" do
      user = create(:user)
      event = create(:event, owner: user)

      user.suspend!

      expect(event.reload.owner_id).to eq(user.id)
    end
  end
end
