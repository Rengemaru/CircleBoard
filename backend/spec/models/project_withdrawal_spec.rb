require "rails_helper"

# プロジェクトの脱退(spec-v2.2.md §2.6。オーナー決定 2026-09-12)。
#
# 申請制で、承認されるまでは参加したまま。行は消さず cancelled_at に時刻を入れる。
RSpec.describe "プロジェクトの脱退" do
  let(:project) { create(:project, capacity: 2) }
  let(:participation) { create(:project_participation, project: project) }

  describe "状態の遷移" do
    it "作った直後は参加中" do
      expect(participation).not_to be_withdrawal_requested
      expect(participation).not_to be_cancelled
    end

    it "申請すると「申請中」になり、まだ抜けていない" do
      participation.request_withdrawal!

      expect(participation).to be_withdrawal_requested
      expect(participation).not_to be_cancelled
    end

    # 取り下げ(本人)と却下(owner)は同じ結果になる
    it "取り下げると参加中に戻る" do
      participation.request_withdrawal!
      participation.cancel_withdrawal_request!

      expect(participation).not_to be_withdrawal_requested
      expect(participation).not_to be_cancelled
    end

    it "承認すると抜ける。行は残る" do
      participation.request_withdrawal!

      expect { participation.approve_withdrawal! }.not_to change(ProjectParticipation, :count)
      expect(participation).to be_cancelled
      expect(participation.user).to be_present
    end

    # 抜けたあとは「申請中」に見えない。時刻は残っているが、脱退が優先する
    it "抜けたあとは申請中として数えない" do
      participation.request_withdrawal!
      participation.approve_withdrawal!

      expect(participation).not_to be_withdrawal_requested
    end
  end

  describe "参加者の数え方" do
    # **抜けたぶんの枠が空かないと、脱退の意味が無い**
    it "抜けた人は定員に数えない" do
      create(:project_participation, project: project)
      second = create(:project_participation, project: project)
      expect(project.reload).to be_full

      second.approve_withdrawal!

      expect(project.reload).not_to be_full
    end

    it "抜けた人は参加者に数えない" do
      participation.approve_withdrawal!

      expect(project.reload.active_project_participations).to be_empty
      expect(project.project_participations).not_to be_empty
    end
  end

  describe "一意制約" do
    # 部分ユニークインデックスに貼り替えたので、抜けたあと戻れる
    it "抜けたあと同じプロジェクトに参加し直せる" do
      user = participation.user
      participation.approve_withdrawal!

      expect {
        create(:project_participation, project: project, user: user)
      }.to change(ProjectParticipation, :count).by(1)
    end

    it "参加中に二重で参加はできない" do
      user = participation.user

      expect {
        create(:project_participation, project: project, user: user)
      }.to raise_error(ActiveRecord::RecordNotUnique)
    end
  end
end
