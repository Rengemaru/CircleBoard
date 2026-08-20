import { BrowserRouter, Route, Routes } from "react-router-dom";
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
        <Route path="/" element={<TopPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/legal" element={<LegalPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/pins" element={<AdminPinsPage />} />
        <Route path="/admin/signage-tokens" element={<AdminSignageTokensPage />} />
        <Route path="/signage" element={<SignagePage />} />
        {/* 定義していないURL。何も出さないと真っ白な画面になる */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
