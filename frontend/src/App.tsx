import { BrowserRouter, Route, Routes } from "react-router-dom";
import { EventsPage } from "./pages/EventsPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";

// 画面構成は wireframes/ の3ファイルに対応する。
// T1-3 ではルーティングの器だけを作り、中身は各タスクで差し替える。
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PlaceholderPage name="トップ" />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:id" element={<PlaceholderPage name="イベント詳細" />} />
        <Route path="/projects" element={<PlaceholderPage name="プロジェクト一覧" />} />
        <Route path="/projects/:id" element={<PlaceholderPage name="プロジェクト詳細" />} />
        <Route path="/create" element={<PlaceholderPage name="企画作成" />} />
        <Route path="/login" element={<PlaceholderPage name="ログイン" />} />
        <Route path="/legal" element={<PlaceholderPage name="利用規約" />} />
        <Route path="/admin/users" element={<PlaceholderPage name="管理者 / アカウント発行" />} />
        <Route path="/admin/pins" element={<PlaceholderPage name="管理者 / ピン留め設定" />} />
        <Route
          path="/admin/signage-tokens"
          element={<PlaceholderPage name="管理者 / トークン管理" />}
        />
        <Route path="/signage" element={<PlaceholderPage name="サイネージ" />} />
      </Routes>
    </BrowserRouter>
  );
}
