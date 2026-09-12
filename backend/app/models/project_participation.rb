class ProjectParticipation < ApplicationRecord
  # 🟡 MVPは0(approved)固定
  enum :status, { approved: 0, pending: 1, rejected: 2 }

  belongs_to :project, optional: true
  belongs_to :user, optional: true

  # 脱退は申請制(spec-v2.2.md §2.6。オーナー決定 2026-09-12)。
  #
  # プロジェクトは継続的に成果物を作る活動で、抜けられると owner が引き継ぎを
  # 考える必要がある。黙って消えると気づけないので、イベントの参加キャンセルと
  # 同じ「1クリックで抜ける」にはしない。
  #
  # **status は使わない。** あちらは「参加を承認するか」の軸で 🟡 MVPは0固定。
  # 脱退は別の軸なので、1つの列に2つの意味を持たせない。
  #
  #   参加中       … 両方 nil
  #   脱退を申請中 … withdrawal_requested_at だけ時刻
  #   脱退済み     … 両方に時刻
  scope :active, -> { where(cancelled_at: nil) }
  scope :withdrawal_requested, -> { active.where.not(withdrawal_requested_at: nil) }

  def cancelled? = cancelled_at.present?
  def withdrawal_requested? = !cancelled? && withdrawal_requested_at.present?

  def request_withdrawal!
    update!(withdrawal_requested_at: Time.current)
  end

  # 取り下げ(本人)と却下(owner)は同じ結果になる。申請していない状態に戻す
  def cancel_withdrawal_request!
    update!(withdrawal_requested_at: nil)
  end

  # 行は消さない。参加していた事実を残す(events.cancelled_at と同じ)
  def approve_withdrawal!
    update!(cancelled_at: Time.current)
  end
end
