class ProjectParticipation < ApplicationRecord
  # 🟡 MVPは0(approved)固定
  enum :status, { approved: 0, pending: 1, rejected: 2 }

  belongs_to :project, optional: true
  belongs_to :user, optional: true
end
