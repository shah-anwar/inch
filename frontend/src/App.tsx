import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { AuthGuard } from "@/components/AuthGuard";
import { ThemeProvider } from "@/components/theme-provider";
import AboutPage from "@/pages/AboutPage";
import AdminPage from "@/pages/AdminPage";
import AdminPrivilegesPage from "@/pages/AdminPrivilegesPage";
import ArgumentPage from "@/pages/ArgumentPage";
import ContactPage from "@/pages/ContactPage";
import CreateSchemePage from "@/pages/CreateSchemePage";
import CreateTopicSubtopicPage from "@/pages/CreateTopicSubtopicPage";
import HomePage from "@/pages/HomePage";
import LearnPage from "@/pages/LearnPage";
import LoginPage from "@/pages/LoginPage";
import ProfilePage from "@/pages/ProfilePage";
import SearchPage from "@/pages/SearchPage";
import SignupPage from "@/pages/SignupPage";
import SubtopicPage from "@/pages/SubtopicPage";
import SubtopicsPage from "@/pages/SubtopicsPage";
import TopicsPage from "@/pages/TopicsPage";

/**
 * Root application router and providers composition.
 *
 * @returns Top-level app tree with theme provider and route definitions.
 */
export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/topics" element={<TopicsPage />} />
          <Route path="/topics/:topicId" element={<SubtopicsPage />} />
          <Route path="/topics/:topicId/:subtopicId" element={<SubtopicPage />} />
          <Route path="/arg/:argumentId" element={<ArgumentPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/profile"
            element={
              <AuthGuard>
                <ProfilePage />
              </AuthGuard>
            }
          />
          <Route
            path="/admin"
            element={
              <AuthGuard>
                <Navigate to="/admin/schemes" replace />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/schemes"
            element={
              <AuthGuard>
                <AdminPage />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/privileges"
            element={
              <AuthGuard>
                <AdminPrivilegesPage />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/create-scheme"
            element={
              <AuthGuard>
                <CreateSchemePage />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/create-topic-subtopic"
            element={
              <AuthGuard>
                <CreateTopicSubtopicPage />
              </AuthGuard>
            }
          />
          {/* TODO: wrap argument creation / submission routes in AuthGuard when they exist */}
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
