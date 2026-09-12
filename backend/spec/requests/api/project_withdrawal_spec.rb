require "rails_helper"

# プロジェクトの脱退(docs/api-spec.md「プロジェクトの脱退」)。
#
# 申請制。抜けるのは owner が承認してから。
RSpec.describe "プロジェクトの脱退", type: :request do
  let(:owner) { create(:user) }
  let(:member) { create(:user) }
  let(:project) { create(:project, owner: owner) }
  let!(:participation) { create(:project_participation, project: project, user: member) }

  describe "POST /api/projects/:id/withdrawal（申請）" do
    it "未ログインでは 401" do
      post "/api/projects/#{project.id}/withdrawal"

      expect(response).to have_http_status(:unauthorized)
    end

    it "参加している人は申請できる" do
      sign_in(member)
      post "/api/projects/#{project.id}/withdrawal"

      expect(response).to have_http_status(:no_content)
      expect(participation.reload).to be_withdrawal_requested
      # **申請しただけでは抜けない**
      expect(participation).not_to be_cancelled
    end

    # 403 にすると「参加していないこと」が分かってしまう
    it "参加していない人には 404" do
      sign_in(create(:user))
      post "/api/projects/#{project.id}/withdrawal"

      expect(response).to have_http_status(:not_found)
    end

    # 抜けると持ち主のいない企画が残る。owner の付け替えは MVP 対象外
    it "主催者は脱退できない" do
      create(:project_participation, project: project, user: owner)
      sign_in(owner)
      post "/api/projects/#{project.id}/withdrawal"

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "二重に申請すると 422" do
      sign_in(member)
      participation.request_withdrawal!
      post "/api/projects/#{project.id}/withdrawal"

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "DELETE /api/projects/:id/withdrawal（取り下げ）" do
    it "申請中なら取り下げられる" do
      participation.request_withdrawal!
      sign_in(member)
      delete "/api/projects/#{project.id}/withdrawal"

      expect(response).to have_http_status(:no_content)
      expect(participation.reload).not_to be_withdrawal_requested
    end

    it "申請していなければ 422" do
      sign_in(member)
      delete "/api/projects/#{project.id}/withdrawal"

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "PUT /api/projects/:id/withdrawals/:id（承認）" do
    before { participation.request_withdrawal! }

    it "owner は承認できる" do
      sign_in(owner)
      put "/api/projects/#{project.id}/withdrawals/#{participation.id}"

      expect(response).to have_http_status(:no_content)
      expect(participation.reload).to be_cancelled
      # 行は消さない。参加していた事実が残る
      expect(ProjectParticipation.find(participation.id)).to be_present
    end

    it "管理者も承認できる" do
      sign_in(create(:user, role: :admin))
      put "/api/projects/#{project.id}/withdrawals/#{participation.id}"

      expect(response).to have_http_status(:no_content)
    end

    # フロントでボタンを隠すのは表示の話。API側で必ず判定する
    it "owner でも管理者でもない人は 403" do
      sign_in(create(:user))
      put "/api/projects/#{project.id}/withdrawals/#{participation.id}"

      expect(response).to have_http_status(:forbidden)
      expect(participation.reload).not_to be_cancelled
    end

    # 通すと、本人の意思なしに抜けさせられる
    it "申請していない参加は承認できない（404）" do
      other = create(:project_participation, project: project)
      sign_in(owner)
      put "/api/projects/#{project.id}/withdrawals/#{other.id}"

      expect(response).to have_http_status(:not_found)
      expect(other.reload).not_to be_cancelled
    end
  end

  describe "DELETE /api/projects/:id/withdrawals/:id（却下）" do
    before { participation.request_withdrawal! }

    it "owner は却下できる。参加は続く" do
      sign_in(owner)
      delete "/api/projects/#{project.id}/withdrawals/#{participation.id}"

      expect(response).to have_http_status(:no_content)
      expect(participation.reload).not_to be_withdrawal_requested
      expect(participation).not_to be_cancelled
    end
  end

  describe "詳細に返る情報" do
    it "本人には自分の申請状態が返る" do
      participation.request_withdrawal!
      sign_in(member)
      get "/api/projects/#{project.id}"

      expect(response.parsed_body["current_user_withdrawal_requested"]).to be(true)
    end

    it "owner には申請の一覧が返る" do
      participation.request_withdrawal!
      sign_in(owner)
      get "/api/projects/#{project.id}"

      requests = response.parsed_body["withdrawal_requests"]
      expect(requests.map { _1["id"] }).to eq([ participation.id ])
      expect(requests.first["user"]["name"]).to eq(member.name)
    end

    # 誰が抜けたがっているかは、他の参加者に見せる情報ではない
    it "owner でも管理者でもない人にはキーごと返らない" do
      participation.request_withdrawal!
      sign_in(member)
      get "/api/projects/#{project.id}"

      expect(response.parsed_body).not_to have_key("withdrawal_requests")
    end

    it "抜けた人は参加者一覧から消える" do
      participation.approve_withdrawal!
      sign_in(owner)
      get "/api/projects/#{project.id}"

      expect(response.parsed_body["participants_count"]).to eq(0)
      expect(response.parsed_body["participants"]).to be_empty
    end
  end
end
