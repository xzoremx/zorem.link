import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context';
import { ProtectedRoute } from '@/components';
import { LandingPage } from '@/pages/LandingPage';
import { AuthPage } from '@/pages/AuthPage';
import { CreateRoomPage } from '@/pages/CreateRoomPage';
import { MyRoomsPage } from '@/pages/MyRoomsPage';
import { NicknamePage } from '@/pages/NicknamePage';
import { RoomPage } from '@/pages/RoomPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/nickname" element={<NicknamePage />} />
          <Route path="/room" element={<RoomPage />} />

          {/* Protected routes - require authentication */}
          <Route
            path="/create-room"
            element={
              <ProtectedRoute>
                <CreateRoomPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-rooms"
            element={
              <ProtectedRoute>
                <MyRoomsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
