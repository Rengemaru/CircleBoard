require "rails_helper"

# 権限と学年の変更、および現役⇄卒業の切り替え。
# いずれも rails console でしかできなかった操作(docs/spec-admin-operations.md §3.3)。
RSpec.describe "ユーザーの編集", type: :request do
  let(:admin) { create(:user, role: :admin) }
  let(:member) { create(:user) }
  # 「今この瞬間」の年度。年が変わってもテストが落ちないように、
  # 期待値は固定の数字ではなく年度から組み立てる
  let(:this_year) { User.academic_year }

  describe "PATCH /api/admin/users/:id" do
    it "未ログインでは 401 を返す" do
      patch "/api/admin/users/#{member.id}", params: { user: { role: "admin" } }, as: :json

      expect(response).to have_http_status(:unauthorized)
    end

    # フロントでボタンを隠すのは表示の話。API側で必ず role を検証する
    it "一般メンバーでは 403 を返す" do
      sign_in(member)
      patch "/api/admin/users/#{admin.id}", params: { user: { role: "member" } }, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(admin.reload).to be_admin
    end

    it "存在しないIDでは 404 を返す" do
      sign_in(admin)
      patch "/api/admin/users/0", params: { user: { role: "admin" } }, as: :json

      expect(response).to have_http_status(:not_found)
    end

    describe "権限" do
      it "メンバーを管理者にできる" do
        sign_in(admin)
        patch "/api/admin/users/#{member.id}", params: { user: { role: "admin" } }, as: :json

        expect(response).to have_http_status(:ok)
        expect(member.reload).to be_admin
      end

      it "管理者をメンバーに戻せる" do
        other = create(:user, role: :admin)
        sign_in(admin)
        patch "/api/admin/users/#{other.id}", params: { user: { role: "member" } }, as: :json

        expect(response).to have_http_status(:ok)
        expect(other.reload).to be_member
      end

      # 降格した瞬間に自分が締め出される。**これがあるので管理者は0人にならない**
      it "自分自身の権限は変えられない" do
        sign_in(admin)
        patch "/api/admin/users/#{admin.id}", params: { user: { role: "member" } }, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(admin.reload).to be_admin
      end

      # 学年だけ直すつもりで開いた自分の編集が、権限が同じという理由だけで
      # 弾かれると操作できない
      it "自分自身でも同じ権限を送るのは通る" do
        sign_in(admin)
        patch "/api/admin/users/#{admin.id}",
              params: { user: { role: "admin", grade_years: 2 } }, as: :json

        expect(response).to have_http_status(:ok)
        expect(admin.reload).to be_admin
      end

      # users.role には確保しているが画面には出さない(ワイヤーフレーム③)
      it "demo は指定できない" do
        sign_in(admin)
        patch "/api/admin/users/#{member.id}", params: { user: { role: "demo" } }, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(member.reload).to be_member
      end
    end

    describe "学年" do
      it "在学年数から入学年度と卒業年度を決める" do
        sign_in(admin)
        patch "/api/admin/users/#{member.id}", params: { user: { grade_years: 3 } }, as: :json

        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["grade"]).to eq("B3")
        expect(member.reload.enrollment_year).to eq(this_year - 2)
        # 学部の4年目が終わる年度末に卒業する、とみなす
        expect(member.graduation_year).to eq(this_year + 2)
      end

      it "5 なら M1、8 なら D2 になる" do
        sign_in(admin)

        { 5 => "M1", 8 => "D2" }.each do |years, expected|
          patch "/api/admin/users/#{member.id}",
                params: { user: { grade_years: years } }, as: :json

          expect(response.parsed_body["grade"]).to eq(expected)
        end
      end

      # 0 と 10 以上は入力させない(オーナー決定 2026-09-11)。
      # 画面でも弾くが、curl で直接叩けるのでサーバーでも止める
      [ 0, 10, -1, "３", "abc" ].each do |bad|
        it "#{bad.inspect} は 422 を返す" do
          sign_in(admin)
          before_year = member.enrollment_year
          patch "/api/admin/users/#{member.id}", params: { user: { grade_years: bad } }, as: :json

          expect(response).to have_http_status(:unprocessable_entity)
          expect(member.reload.enrollment_year).to eq(before_year)
        end
      end

      # 通すと、権限だけ直すつもりの保存で卒業年度が上書きされ、
      # 卒業生が現役に戻ってしまう
      it "卒業生の学年は変えられない" do
        graduate = create(:user, graduation_year: this_year)
        sign_in(admin)
        patch "/api/admin/users/#{graduate.id}", params: { user: { grade_years: 3 } }, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(graduate.reload.graduation_year).to eq(this_year)
      end
    end
  end

  describe "PUT /api/admin/users/:user_id/graduation" do
    it "未ログインでは 401 を返す" do
      put "/api/admin/users/#{member.id}/graduation"

      expect(response).to have_http_status(:unauthorized)
    end

    it "一般メンバーでは 403 を返す" do
      other = create(:user)
      sign_in(member)
      put "/api/admin/users/#{other.id}/graduation"

      expect(response).to have_http_status(:forbidden)
      expect(other.reload).not_to be_graduated
    end

    it "卒業生にする" do
      sign_in(admin)
      put "/api/admin/users/#{member.id}/graduation"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["graduated"]).to be(true)
      # 卒業生に学年は出さない
      expect(response.parsed_body["grade"]).to be_nil
      expect(member.reload).to be_graduated
    end
  end

  describe "DELETE /api/admin/users/:user_id/graduation" do
    let(:graduate) { create(:user, enrollment_year: this_year - 2, graduation_year: this_year) }

    it "一般メンバーでは 403 を返す" do
      sign_in(member)
      delete "/api/admin/users/#{graduate.id}/graduation"

      expect(response).to have_http_status(:forbidden)
      expect(graduate.reload).to be_graduated
    end

    # 入学年度は触らないので、戻したときに元の学年がそのまま出る。
    # 卒業年度だけを動かしている(graduations_controller)
    it "現役に戻すと元の学年が戻る" do
      sign_in(admin)
      delete "/api/admin/users/#{graduate.id}/graduation"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["graduated"]).to be(false)
      expect(response.parsed_body["grade"]).to eq("B3")
      expect(graduate.reload).not_to be_graduated
    end

    it "存在しないIDでは 404 を返す" do
      sign_in(admin)
      delete "/api/admin/users/0/graduation"

      expect(response).to have_http_status(:not_found)
    end
  end
end
