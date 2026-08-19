FactoryBot.define do
  factory :user do
    sequence(:name) { |n| "テストユーザー#{n}" }
    sequence(:email) { |n| "user#{n}@example.ac.jp" }
    password { "password123" }
    role { :member }
    enrollment_year { 2026 }
    graduation_year { 2030 }
  end
end
