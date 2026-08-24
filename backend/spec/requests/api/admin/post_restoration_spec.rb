require "rails_helper"

# 論理削除の取り消し(wireframes/wireframe-admin-ver2.html ④「復旧」)。
# 削除そのものは公開APIの DELETE /api/events/:id なので、
# event_crud_spec.rb / projects_spec.rb が担当する。
RSpec.describe "企画の復旧", type: :request do
  let(:admin) { create(:user, role: :admin) }
  let(:member) { create(:user) }

  describe "DELETE /api/admin/events/:event_id/trash" do
    it "未ログインでは 401 を返す" do
      event = create(:event, visibility: :trashed)
      delete "/api/admin/events/#{event.id}/trash"

      expect(response).to have_http_status(:unauthorized)
      expect(event.reload).to be_trashed
    end

    # owner 本人でも復旧はできない。消えたものに触れるのは管理者だけ
    it "一般メンバーでは 403 を返す" do
      event = create(:event, owner: member, visibility: :trashed)
      sign_in(member)
      delete "/api/admin/events/#{event.id}/trash"

      expect(response).to have_http_status(:forbidden)
      expect(event.reload).to be_trashed
    end

    it "管理者は論理削除済みのイベントを active に戻せる" do
      event = create(:event, visibility: :trashed)
      sign_in(admin)
      delete "/api/admin/events/#{event.id}/trash"

      expect(response).to have_http_status(:no_content)
      expect(event.reload).to be_active
    end

    it "存在しないIDには 404 を返す" do
      sign_in(admin)
      delete "/api/admin/events/0/trash"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/admin/projects/:project_id/trash" do
    it "一般メンバーでは 403 を返す" do
      project = create(:project, visibility: :trashed)
      sign_in(member)
      delete "/api/admin/projects/#{project.id}/trash"

      expect(response).to have_http_status(:forbidden)
      expect(project.reload).to be_trashed
    end

    it "管理者は論理削除済みのプロジェクトを active に戻せる" do
      project = create(:project, visibility: :trashed)
      sign_in(admin)
      delete "/api/admin/projects/#{project.id}/trash"

      expect(response).to have_http_status(:no_content)
      expect(project.reload).to be_active
    end

    it "存在しないIDには 404 を返す" do
      sign_in(admin)
      delete "/api/admin/projects/0/trash"

      expect(response).to have_http_status(:not_found)
    end
  end
end
