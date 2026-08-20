class SignageToken < ApplicationRecord
  # revoked_at が入っているものは失効。行は消さないので、どのトークンを
  # いつ止めたかの記録が残る(spec-v2.2.md §2.7)
  scope :valid, -> { where(revoked_at: nil) }
end
