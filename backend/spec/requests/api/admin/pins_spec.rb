require "rails_helper"

# ピン留め。管理者が注目枠の先頭1つを手動固定する機能。
# 全体で常に1件のみで、これは部分ユニークインデックス
# index_events_single_pinned が DB レベルで保証している(spec-v2.2.md §2.2)。
RSpec.describe "Api::Admin::Pins", type: :request do
  let(:admin) { create(:user, role: :admin) }
  let(:member) { create(:user) }
  let(:event) { create(:event) }

  describe "PUT /api/admin/events/:event_id/pin" do
    it "未ログインでは 401 を返す" do
      put "/api/admin/events/#{event.id}/pin"

      expect(response).to have_http_status(:unauthorized)
    end

    # フロントでメニューを隠すだけにしない。API側で必ず role を検証する
    # (docs/api-spec.md §6)
    it "一般メンバーでは 403 を返し、ピンが立たない" do
      sign_in(member)

      put "/api/admin/events/#{event.id}/pin"

      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body["error"]["code"]).to eq("forbidden")
      expect(event.reload).not_to be_pinned
    end

    it "管理者はピン留めできる" do
      sign_in(admin)

      put "/api/admin/events/#{event.id}/pin"

      expect(response).to have_http_status(:ok)
      expect(event.reload).to be_pinned
    end

    # ここが T3-3 の核心。順序を間違えると部分ユニークインデックスに衝突する
    it "別のイベントをピン留めすると、前のピンが外れる" do
      previous = create(:event, pinned: true)
      sign_in(admin)

      put "/api/admin/events/#{event.id}/pin"

      expect(response).to have_http_status(:ok)
      expect(previous.reload).not_to be_pinned
      expect(event.reload).to be_pinned
    end

    it "ピン留めは常に全体で1件だけになる" do
      create(:event, pinned: true)
      sign_in(admin)

      put "/api/admin/events/#{event.id}/pin"

      expect(Event.where(pinned: true).count).to eq(1)
    end

    it "すでにピン留めされているイベントをもう一度指定しても成功する" do
      event.update!(pinned: true)
      sign_in(admin)

      put "/api/admin/events/#{event.id}/pin"

      expect(response).to have_http_status(:ok)
      expect(Event.where(pinned: true).count).to eq(1)
    end

    it "論理削除済みのイベントは 404 を返す" do
      event.trashed!
      sign_in(admin)

      put "/api/admin/events/#{event.id}/pin"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/admin/events/:event_id/pin" do
    it "管理者はピンを外せる" do
      event.update!(pinned: true)
      sign_in(admin)

      delete "/api/admin/events/#{event.id}/pin"

      expect(response).to have_http_status(:no_content)
      expect(event.reload).not_to be_pinned
    end

    it "一般メンバーでは 403 を返し、ピンが残る" do
      event.update!(pinned: true)
      sign_in(member)

      delete "/api/admin/events/#{event.id}/pin"

      expect(response).to have_http_status(:forbidden)
      expect(event.reload).to be_pinned
    end

    it "ピン留めされていなくても 204 を返す" do
      sign_in(admin)

      delete "/api/admin/events/#{event.id}/pin"

      expect(response).to have_http_status(:no_content)
    end
  end
end
