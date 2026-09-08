require "rails_helper"

# 企画一覧・全件(wireframes/wireframe-admin-ver2.html ④)。
# 復旧は post_restoration_spec.rb が担当する。
RSpec.describe "企画一覧(全件)", type: :request do
  let(:admin) { create(:user, role: :admin) }
  let(:member) { create(:user) }

  describe "GET /api/admin/posts" do
    it "未ログインでは 401 を返す" do
      get "/api/admin/posts"

      expect(response).to have_http_status(:unauthorized)
    end

    # フロントでメニューを隠すだけにしない。API側で必ず role を検証する
    it "一般メンバーでは 403 を返す" do
      sign_in(member)
      get "/api/admin/posts"

      expect(response).to have_http_status(:forbidden)
    end

    it "イベントとプロジェクトを1つの配列に混ぜて返す" do
      event = create(:event)
      project = create(:project)
      sign_in(admin)
      get "/api/admin/posts"

      expect(response).to have_http_status(:ok)
      posts = response.parsed_body["posts"]
      expect(posts.map { _1.values_at("kind", "id") })
        .to contain_exactly([ "event", event.id ], [ "project", project.id ])
    end

    it "1行に画面④が必要とする項目を返す" do
      create(:event)
      sign_in(admin)
      get "/api/admin/posts"

      expect(response.parsed_body["posts"].first.keys).to contain_exactly(
        "id", "kind", "title", "status", "trashed", "owner_name", "capacity",
        "participants_count", "created_at"
      )
    end

    # この画面だけが論理削除済みを見る。公開APIは trashed を必ず外すので、
    # 使い回すと「復旧する対象が一覧に出ない」ことになる
    it "論理削除済みの企画も含めて返す" do
      trashed_event = create(:event, visibility: :trashed)
      trashed_project = create(:project, visibility: :trashed)
      sign_in(admin)
      get "/api/admin/posts"

      rows = response.parsed_body["posts"]
      expect(rows.find { _1["kind"] == "event" && _1["id"] == trashed_event.id }["trashed"]).to be(true)
      expect(rows.find { _1["kind"] == "project" && _1["id"] == trashed_project.id }["trashed"]).to be(true)
    end

    it "終了したプロジェクトも含めて返す" do
      completed = create(:project, status: :completed)
      sign_in(admin)
      get "/api/admin/posts"

      row = response.parsed_body["posts"].find { _1["kind"] == "project" && _1["id"] == completed.id }
      expect(row["status"]).to eq("completed")
    end

    it "投稿日の新しい順に並べる" do
      old_event = create(:event, created_at: 10.days.ago)
      new_project = create(:project, created_at: 1.day.ago)
      middle_event = create(:event, created_at: 5.days.ago)
      sign_in(admin)
      get "/api/admin/posts"

      # イベントとプロジェクトでIDが重複しうるので、種別と組で比べる
      expect(response.parsed_body["posts"].map { _1.values_at("kind", "id") })
        .to eq([ [ "project", new_project.id ], [ "event", middle_event.id ], [ "event", old_event.id ] ])
    end

    # 公開APIと同じ数え方に揃える。片方だけ数え方が違うと、
    # 管理画面とイベント詳細で参加人数が食い違う
    it "イベントの参加者数はキャンセル済みを除いて数える" do
      event = create(:event)
      create(:event_participation, event: event)
      create(:event_participation, event: event, cancelled_at: Time.current)
      sign_in(admin)
      get "/api/admin/posts"

      row = response.parsed_body["posts"].find { _1["kind"] == "event" && _1["id"] == event.id }
      expect(row["participants_count"]).to eq(1)
    end

    it "退会した投稿者は owner_name が null になる" do
      event = create(:event)
      event.owner.destroy!
      sign_in(admin)
      get "/api/admin/posts"

      row = response.parsed_body["posts"].find { _1["kind"] == "event" && _1["id"] == event.id }
      expect(row["owner_name"]).to be_nil
    end
  end
end
