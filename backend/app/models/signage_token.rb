class SignageToken < ApplicationRecord
  # revoked_at が入っているものは失効。行は消さないので、どのトークンを
  # いつ止めたかの記録が残る(spec-v2.2.md §2.7)
  scope :valid, -> { where(revoked_at: nil) }

  validates :name, presence: true
  validates :token, presence: true, uniqueness: true

  # token はサーバー側で生成する。リクエストの値を信用すると、
  # 推測しやすい値を外から設定できてしまう。
  # SecureRandom.hex(16) = 32文字(spec-v2.2.md §2.7)
  before_validation :generate_token, on: :create

  # 端末に貼り付けるURL。組み立てを1箇所に置く
  def signage_url
    "#{ENV.fetch('PUBLIC_BASE_URL')}/signage?token=#{token}"
  end

  private

  def generate_token
    self.token = SecureRandom.hex(16)
  end
end
