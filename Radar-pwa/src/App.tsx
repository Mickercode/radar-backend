import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AudioPlayerProvider } from './components/AudioPlayer';
import { AppShell } from './components/AppShell';
import { FeedPage } from './pages/feed';
import { CapturePage } from './pages/capture';
import { BrainPage } from './pages/brain';
import { NotebookPage } from './pages/notebook';
import { KnowledgePage } from './pages/knowledge';
import { ProfilePage } from './pages/profile';
import { SettingsPage } from './pages/settings';
import { NotFoundPage } from './pages/not-found';

export function App() {
  return (
    <AudioPlayerProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<FeedPage />} />
            <Route path="capture" element={<CapturePage />} />
            <Route path="notebook" element={<NotebookPage />} />
            <Route path="knowledge" element={<KnowledgePage />} />
            <Route path="brain" element={<BrainPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AudioPlayerProvider>
  );
}
