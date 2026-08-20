require "rails_helper"

RSpec.describe "プロジェクトの参加申請と参加者一覧", type: :request do
  let(:member) { create(:user) }
  let(:other) { create(:user, name: "佐藤花子") }
  let(:project) { create(:project, capacity: 2) }

  describe "参加者一覧の公開範囲" do
    # T2-2 の完了条件。プロジェクトは一覧・詳細ともログイン必須なので、
    # 未ログインでは参加者一覧どころかレスポンス自体が返らない
    it "未ログインでは詳細を取得できず 401 を返す" do
      create(:project_participation, project: project, user: other)

      get "/api/projects/#{project.id}"

      expect(response).to have_http_status(:unauthorized)
    end

    it "ログイン時は participants と current_user_joined を返す" do
      create(:project_participation, project: project, user: other)
      sign_in(member)

      get "/api/projects/#{project.id}"

      body = response.parsed_body
      expect(body["participants"]).to eq([ { "id" => other.id, "name" => other.name } ])
      expect(body["current_user_joined"]).to be(false)
    end

    it "自分が参加していれば current_user_joined が true になる" do
      create(:project_participation, project: project, user: member)
      sign_in(member)

      get "/api/projects/#{project.id}"

      expect(response.parsed_body["current_user_joined"]).to be(true)
    end
  end

  describe "POST /api/projects/:project_id/participation" do
    it "未ログインでは 401 を返す" do
      post "/api/projects/#{project.id}/participation"

      expect(response).to have_http_status(:unauthorized)
    end

    # MVPでは即時承認(docs/api-spec.md §3、spec-v2.2.md §2.6)
    it "参加すると status: approved と approved_at が入る" do
      sign_in(member)

      post "/api/projects/#{project.id}/participation"

      expect(response).to have_http_status(:created)
      participation = project.project_participations.last
      expect(participation).to be_approved
      expect(participation.approved_at).to be_present
    end

    it "二重に申請すると 422 を返す" do
      create(:project_participation, project: project, user: member)
      sign_in(member)

      expect {
        post "/api/projects/#{project.id}/participation"
      }.not_to change(ProjectParticipation, :count)

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "定員を超えると 422 を返す" do
      2.times { create(:project_participation, project: project, user: create(:user)) }
      sign_in(member)

      post "/api/projects/#{project.id}/participation"

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "capacity が nil なら何人でも参加できる" do
      unlimited = create(:project, capacity: nil)
      3.times { create(:project_participation, project: unlimited, user: create(:user)) }
      sign_in(member)

      post "/api/projects/#{unlimited.id}/participation"

      expect(response).to have_http_status(:created)
    end

    it "論理削除済みのプロジェクトには参加できず 404 を返す" do
      project.trashed!
      sign_in(member)

      post "/api/projects/#{project.id}/participation"

      expect(response).to have_http_status(:not_found)
    end
  end

  # 脱退APIは作らない(MVP対象外。rails console で対応。docs/api-spec.md §3)
  it "脱退APIは存在しない" do
    sign_in(member)

    delete "/api/projects/#{project.id}/participation"

    expect(response).to have_http_status(:not_found)
  end
end
