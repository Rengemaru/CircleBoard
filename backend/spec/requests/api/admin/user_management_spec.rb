require "rails_helper"

# ユーザーの一覧と削除(wireframes/wireframe-admin-ver2.html ②)。
# 発行は users_spec.rb が担当する。
RSpec.describe "ユーザー管理", type: :request do
  let(:admin) { create(:user, role: :admin) }
  let(:member) { create(:user) }

  describe "GET /api/admin/users" do
    it "未ログインでは 401 を返す" do
      get "/api/admin/users"

      expect(response).to have_http_status(:unauthorized)
    end

    # フロントでメニューを隠すだけにしない。API側で必ず role を検証する
    it "一般メンバーでは 403 を返す" do
      sign_in(member)
      get "/api/admin/users"

      expect(response).to have_http_status(:forbidden)
    end

    it "管理者には email を含む一覧を返す" do
      admin
      member
      sign_in(admin)
      get "/api/admin/users"

      expect(response).to have_http_status(:ok)
      row = response.parsed_body["users"].find { _1["id"] == member.id }
      # 公開APIの UserSerializer は email を返さない。この画面だけが受け取る
      expect(row.keys).to contain_exactly(
        "id", "name", "email", "role", "enrollment_year", "graduation_year"
      )
      expect(row["email"]).to eq(member.email)
    end

    it "パスワードは一切返さない" do
      sign_in(admin)
      get "/api/admin/users"

      expect(response.body).not_to include("password")
    end

    it "卒業年度の新しい順に返す" do
      sign_in(admin)
      create(:user, graduation_year: 2024)
      create(:user, graduation_year: 2030)

      years = response_years_after { get "/api/admin/users" }

      expect(years).to eq(years.sort.reverse)
    end
  end

  describe "DELETE /api/admin/users/:id" do
    it "未ログインでは 401 を返し、削除しない" do
      target = member

      expect { delete "/api/admin/users/#{target.id}" }.not_to change(User, :count)

      expect(response).to have_http_status(:unauthorized)
    end

    it "一般メンバーでは 403 を返し、削除しない" do
      target = create(:user)
      sign_in(member)

      expect { delete "/api/admin/users/#{target.id}" }.not_to change(User, :count)

      expect(response).to have_http_status(:forbidden)
    end

    it "管理者は他のユーザーを削除できる" do
      target = create(:user)
      sign_in(admin)

      expect { delete "/api/admin/users/#{target.id}" }.to change(User, :count).by(-1)

      expect(response).to have_http_status(:no_content)
    end

    # 管理者が0人になると、誰もアカウントを発行できなくなる
    it "自分自身は削除できず 422 を返す" do
      sign_in(admin)

      expect { delete "/api/admin/users/#{admin.id}" }.not_to change(User, :count)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body["error"]["message"]).to include("自分自身")
    end

    it "存在しないIDでは 404 を返す" do
      sign_in(admin)
      delete "/api/admin/users/0"

      expect(response).to have_http_status(:not_found)
    end

    # ここが ON DELETE SET NULL の効き目。卒業生を消しても過去の活動が消えない
    it "削除しても、その人が作った企画と参加記録は残る" do
      target = create(:user)
      event = create(:event, owner: target)
      participation = create(:event_participation, user: target)
      sign_in(admin)

      delete "/api/admin/users/#{target.id}"

      expect(response).to have_http_status(:no_content)
      expect(event.reload.owner_id).to be_nil
      expect(participation.reload.user_id).to be_nil
    end
  end

  def response_years_after
    yield
    response.parsed_body["users"].map { _1["graduation_year"] }
  end
end
