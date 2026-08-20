FactoryBot.define do
  factory :tag do
    sequence(:name) { |n| "タグ#{n}" }
    category { :project_event }
  end
end
