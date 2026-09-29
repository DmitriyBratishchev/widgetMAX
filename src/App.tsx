import { ChatPage } from '@/pages/ChatPage/ChatPage';
import { LoginPage } from '@/pages/LoginPage/LoginPage';
import { useSessionStore } from '@/stores/sessionStore';

// Роутера нет: экранов два, выбор — по признаку входа (ресёрч max-chat §3 Р1).
function App() {
  const isSignedIn = useSessionStore((s) => s.credentials !== null);
  return isSignedIn ? <ChatPage /> : <LoginPage />;
}

export default App;
