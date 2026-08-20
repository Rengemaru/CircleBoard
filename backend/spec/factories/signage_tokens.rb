FactoryBot.define do
  factory :signage_token do
    sequence(:name) { |n| "検証用ディスプレイ#{n}" }
    token { SecureRandom.hex(16) }
  end
end
