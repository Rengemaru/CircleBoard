Rails.application.routes.draw do
  # 死活監視。/api 配下ではない。認証不要(docs/api-spec.md §7)。
  get "/healthz", to: "healthz#show"

  namespace :api do
    # 単数形リソース。ログイン中のセッションは常に1つなのでIDを取らない
    resource :session, only: [ :show, :create, :destroy ]
    resources :events, only: [ :index, :show, :create, :update, :destroy ] do
      # 1人につき1つなので単数形。参加表明とキャンセルだけを持つ
      resource :participation, only: [ :create, :destroy ], controller: "event_participations"
    end
    resources :projects, only: [ :index, :show, :create, :update, :destroy ]
    resources :tags, only: [ :index ]
  end
end
