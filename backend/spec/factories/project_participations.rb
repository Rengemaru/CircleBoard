FactoryBot.define do
  factory :project_participation do
    association :project
    association :user
    status { :approved }
    approved_at { Time.current }
  end
end
