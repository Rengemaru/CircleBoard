import { BrowserRouter, Route, Routes } from "react-router-dom";
import { EventsPage } from "./pages/EventsPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { SignagePage } from "./pages/SignagePage";
import { AdminPinsPage } from "./pages/admin/AdminPinsPage";
import { AdminSignageTokensPage } from "./pages/admin/AdminSignageTokensPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";

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
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/pins" element={<AdminPinsPage />} />
        <Route path="/admin/signage-tokens" element={<AdminSignageTokensPage />} />
        <Route path="/signage" element={<SignagePage />} />
      </Routes>
    </BrowserRouter>
  );
}
