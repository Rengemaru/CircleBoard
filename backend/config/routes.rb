Rails.application.routes.draw do
  # 死活監視。/api 配下ではない。認証不要(docs/api-spec.md §7)。
  get "/healthz", to: "healthz#show"

  namespace :api do
    resources :events, only: [ :index ]
  end
end
