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
import { AdminPinsPage } from "./pages/admin/AdminPinsPage";
import { AdminSignageTokensPage } from "./pages/admin/AdminSignageTokensPage";
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

        {/* 管理画面はナビもフッターも AdminLayout が持つ */}
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/pins" element={<AdminPinsPage />} />
        <Route path="/admin/signage-tokens" element={<AdminSignageTokensPage />} />

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
    <>
      <Outlet />
      <SiteFooter />
    </>
  );
}
