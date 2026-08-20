require "rails_helper"

RSpec.describe "イベントの参加表明・キャンセル", type: :request do
  let(:member) { create(:user) }
  let(:other) { create(:user) }
  let(:event) { create(:event, capacity: 2) }

  describe "POST /api/events/:event_id/participation" do
    it "未ログインでは 401 を返す" do
      post "/api/events/#{event.id}/participation"

      expect(response).to have_http_status(:unauthorized)
    end

    it "ログインしていれば参加でき、201 を返す" do
      sign_in(member)

      expect {
        post "/api/events/#{event.id}/participation"
      }.to change { event.event_participations.active.count }.by(1)

      expect(response).to have_http_status(:created)
    end

    it "二重に参加しようとすると 422 を返す" do
      sign_in(member)
      post "/api/events/#{event.id}/participation"

      expect {
        post "/api/events/#{event.id}/participation"
      }.not_to change { event.event_participations.active.count }

      expect(response).to have_http_status(:unprocessable_entity)
    end

    # 定員チェックはフロントのボタン非表示だけでなくAPI側でも必ず行う。
    # ボタンを隠すのは表示の話であり、認可でも制限でもない(instructions.md T2-6)
    context "定員" do
      it "定員ちょうどまでは参加できる" do
        create(:event_participation, event: event, user: other)
        sign_in(member)

        post "/api/events/#{event.id}/participation"

        expect(response).to have_http_status(:created)
      end

      it "定員を超えると 422 を返す" do
        create(:event_participation, event: event, user: other)
        create(:event_participation, event: event, user: create(:user))
        sign_in(member)

        post "/api/events/#{event.id}/participation"

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body["error"].keys).to contain_exactly("code", "message")
      end

      # capacity が nil のときは無制限(仕様書 §2.2)
      it "capacity が nil なら何人でも参加できる" do
        unlimited = create(:event, capacity: nil)
        3.times { create(:event_participation, event: unlimited, user: create(:user)) }
        sign_in(member)

        post "/api/events/#{unlimited.id}/participation"

        expect(response).to have_http_status(:created)
      end

      # キャンセル済みは定員に数えない
      it "キャンセルした人は定員に数えない" do
        create(:event_participation, event: event, user: other)
        create(:event_participation, event: event, user: create(:user), cancelled_at: 1.day.ago)
        sign_in(member)

        post "/api/events/#{event.id}/participation"

        expect(response).to have_http_status(:created)
      end
    end

    it "論理削除済みのイベントには参加できず 404 を返す" do
      event.trashed!
      sign_in(member)

      post "/api/events/#{event.id}/participation"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/events/:event_id/participation" do
    # 物理削除しない。注目スコアの「直近3日の増減」を正確に出すために必要(仕様書 §2.5)
    it "キャンセルすると 204 を返し、行は残って cancelled_at が入る" do
      sign_in(member)
      post "/api/events/#{event.id}/participation"
      participation = event.event_participations.last

      expect {
        delete "/api/events/#{event.id}/participation"
      }.not_to change { event.event_participations.count }

      expect(response).to have_http_status(:no_content)
      expect(participation.reload.cancelled_at).to be_present
    end

    it "参加していない場合は 404 を返す" do
      sign_in(member)

      delete "/api/events/#{event.id}/participation"

      expect(response).to have_http_status(:not_found)
    end

    # 部分ユニークインデックスが cancelled_at IS NULL のみを対象にしているため、
    # 一度キャンセルした人も再参加できる(仕様書 §2.5)
    it "キャンセル後に再参加できる" do
      sign_in(member)
      post "/api/events/#{event.id}/participation"
      delete "/api/events/#{event.id}/participation"

      post "/api/events/#{event.id}/participation"

      expect(response).to have_http_status(:created)
      expect(event.event_participations.active.count).to eq(1)
    end
  end
end
