module Api
  class TagsController < ApplicationController
    # ゲスト可(docs/api-spec.md §4)。イベント一覧の絞り込みに使うため、
    # 未ログインでも取得できる必要がある
    def index
      tags = Tag.where(category: requested_category).order(:name)
      render json: { tags: tags.map { TagSerializer.new(_1).as_json } }
    end

    private

    # 企画用とプロフィール用で語彙を分けている(docs/spec-tags.md §3.4)ので、
    # どちらの候補が欲しいかを呼び出し側が指定する。
    #
    # 知らない値は project_event に倒す。エラーにしないのは、絞り込み画面が
    # 未ログインでも開くところで、URLを手で書き換えられただけで500にしたくないため。
    # 省略時も project_event。既存の呼び出し(一覧の絞り込み)を壊さない
    def requested_category
      Tag.categories.key?(params[:category]) ? params[:category] : :project_event
    end
  end
end
