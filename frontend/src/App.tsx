import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { SiteFooter } from "./components/SiteFooter";
import { EventsPage } from "./pages/EventsPage";
import { TopPage } from "./pages/TopPage";
import { LoginPage } from "./pages/LoginPage";
import { LegalPage } from "./pages/LegalPage";
import { CreatePage } from "./pages/CreatePage";
import { EventDetailPage } from "./pages/EventDetailPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { SignagePage } from "./pages/SignagePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminPinsPage } from "./pages/admin/AdminPinsPage";
import { AdminPostsPage } from "./pages/admin/AdminPostsPage";
import { AdminSignageTokensPage } from "./pages/admin/AdminSignageTokensPage";
import { AdminUserCreatePage } from "./pages/admin/AdminUserCreatePage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";

// 画面構成は wireframes/ の3ファイルに対応する。
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MemberLayout />}>
          <Route path="/" element={<TopPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/legal" element={<LegalPage />} />
          {/* 定義していないURL。何も出さないと真っ白な画面になる */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* 管理画面。外枠は member 側と同じで、AdminOnly が管理者かどうかだけ
            見る。URLは wireframe-admin-ver2.html に合わせる */}
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/users/new" element={<AdminUserCreatePage />} />
        <Route path="/admin/posts" element={<AdminPostsPage />} />
        <Route path="/admin/pin" element={<AdminPinsPage />} />
        <Route path="/admin/signage" element={<AdminSignageTokensPage />} />

        {/* サイネージはナビゲーションを一切出さない(wireframe-signage.html) */}
        <Route path="/signage" element={<SignagePage />} />
      </Routes>
    </BrowserRouter>
  );
}

// メンバー画面だけがフッターを共有する。
// 各ページに書いて回ると、新しい画面を足したときに付け忘れる
function MemberLayout() {
  return (
    // 背景をうすいグレーにして、内容を白い面で浮かせる
    // (wireframe-admin-ver2.html の .admin-body と同じ考え方)。
    // 縦を flex で伸ばすのは、内容が短い画面でフッターが宙に浮かないようにするため
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="flex-1">
        <Outlet />
      </div>
      <SiteFooter />
    </div>
  );
}
