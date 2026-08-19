FactoryBot.define do
  factory :event do
    sequence(:title) { |n| "テストイベント#{n}" }
    description { "説明" }
    location { "部室A" }
    starts_at { 3.days.from_now }
    association :owner, factory: :user
  end
end
