module Api
  class TagsController < ApplicationController
    # ゲスト可(docs/api-spec.md §4)。イベント一覧の絞り込みに使うため、
    # 未ログインでも取得できる必要がある
    def index
      # category: skill(1) は未使用なので返さない(仕様書 §2.4)
      tags = Tag.project_event.order(:id)
      render json: { tags: tags.map { TagSerializer.new(_1).as_json } }
    end
  end
end
