FactoryBot.define do
  factory :project do
    sequence(:title) { |n| "テストプロジェクト#{n}" }
    description { "説明" }
    status { :recruiting }
    association :owner, factory: :user
  end
end
