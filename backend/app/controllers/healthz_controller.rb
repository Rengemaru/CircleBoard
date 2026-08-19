# 死活監視用。DBには触らない。
# アプリが生きているかとDBが生きているかを別々に観測したいため、
# ここでDB接続を確認するとその区別がつかなくなる(docs/api-spec.md §7)。
class HealthzController < ApplicationController
  def show
    render json: { status: "ok" }
  end
end
