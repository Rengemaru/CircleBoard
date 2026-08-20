require "rails_helper"

# 管理者トップの集計(wireframes/wireframe-admin-ver2.html ①)。
RSpec.describe "GET /api/admin/dashboard", type: :request do
  let(:admin) { create(:user, role: :admin) }
  let(:member) { create(:user) }

  it "未ログインでは 401 を返す" do
    get "/api/admin/dashboard"

    expect(response).to have_http_status(:unauthorized)
  end

  # フロントでメニューを隠すだけにしない。API側で必ず role を検証する
  it "一般メンバーでは 403 を返す" do
    sign_in(member)
    get "/api/admin/dashboard"

    expect(response).to have_http_status(:forbidden)
  end

  describe "集計" do
    before { sign_in(admin) }

    it "メンバー数と、そのうちの卒業生を数える" do
      create(:user, graduation_year: Date.current.year - 3)
      create(:user, graduation_year: Date.current.year + 3)

      get "/api/admin/dashboard"
      stats = response.parsed_body["stats"]

      expect(stats["member_count"]).to eq(User.count)
      expect(stats["graduate_count"]).to eq(1)
    end

    it "停止中のアカウントを数える" do
      create(:user, suspended_at: Time.current)
      create(:user)

      get "/api/admin/dashboard"

      expect(response.parsed_body["stats"]["suspended_count"]).to eq(1)
    end

    # 「進行中」は終わっていないもの。募集中もこれから活動するので含める
    it "終了していないプロジェクトを数え、うち募集中を内訳に出す" do
      create(:project, status: :recruiting)
      create(:project, status: :in_progress)
      create(:project, status: :completed)

      get "/api/admin/dashboard"
      stats = response.parsed_body["stats"]

      expect(stats["active_project_count"]).to eq(2)
      expect(stats["recruiting_project_count"]).to eq(1)
    end

    it "論理削除したプロジェクトは数えない" do
      create(:project, status: :recruiting, visibility: :trashed)

      get "/api/admin/dashboard"

      expect(response.parsed_body["stats"]["active_project_count"]).to eq(0)
    end

    it "今月のイベントだけを数える" do
      create(:event, starts_at: Time.current.beginning_of_month + 2.days)
      create(:event, starts_at: Time.current.end_of_month - 1.day)
      create(:event, starts_at: Time.current.next_month.beginning_of_month + 1.day)

      get "/api/admin/dashboard"

      expect(response.parsed_body["stats"]["events_this_month_count"]).to eq(2)
    end

    it "次に開催されるイベントを1件返す" do
      create(:event, starts_at: 10.days.from_now, title: "あとの方")
      soon = create(:event, starts_at: 3.days.from_now, title: "近い方")

      get "/api/admin/dashboard"
      next_event = response.parsed_body["stats"]["next_event"]

      expect(next_event["id"]).to eq(soon.id)
      expect(next_event["title"]).to eq("近い方")
      expect(next_event["days_until"]).to eq(3)
    end

    it "開催予定が無ければ next_event は null" do
      create(:event, starts_at: 3.days.ago)

      get "/api/admin/dashboard"

      expect(response.parsed_body["stats"]["next_event"]).to be_nil
    end
  end

  describe "最近の企画アクティビティ" do
    before { sign_in(admin) }

    it "イベントとプロジェクトを混ぜて新しい順に返す" do
      create(:project, title: "古いプロジェクト", created_at: 3.days.ago)
      create(:event, title: "新しいイベント", created_at: 1.hour.ago)

      get "/api/admin/dashboard"
      rows = response.parsed_body["recent_activity"]

      expect(rows.first["title"]).to eq("新しいイベント")
      expect(rows.first["kind"]).to eq("event")
      expect(rows.map { _1["title"] }).to include("古いプロジェクト")
    end

    it "5件までしか返さない" do
      create_list(:event, 4)
      create_list(:project, 4)

      get "/api/admin/dashboard"

      expect(response.parsed_body["recent_activity"].size).to eq(5)
    end

    it "論理削除した企画は出さない" do
      create(:event, title: "消した企画", visibility: :trashed)

      get "/api/admin/dashboard"

      expect(response.parsed_body["recent_activity"]).to be_empty
    end

    # owner は退会で nil になりうる(ON DELETE SET NULL)。ここで落ちない
    it "投稿者が退会していても owner_name は null で返る" do
      create(:event, owner: nil)

      get "/api/admin/dashboard"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["recent_activity"].first["owner_name"]).to be_nil
    end
  end
end
