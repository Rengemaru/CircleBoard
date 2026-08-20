Rails.application.routes.draw do
  # 死活監視。/api 配下ではない。認証不要(docs/api-spec.md §7)。
  get "/healthz", to: "healthz#show"

  namespace :api do
    # 単数形リソース。ログイン中のセッションは常に1つなのでIDを取らない
    resource :session, only: [ :show, :create, :destroy ]
    resources :events, only: [ :index, :show, :create, :update, :destroy ]
  end
end
