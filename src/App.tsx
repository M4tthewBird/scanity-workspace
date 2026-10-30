import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Login, SetPassword } from './auth/Login';
import { Logo } from './components/Logo';
import { MyTasks, Overview } from './components/Overview';
import { PageView } from './components/PageView';
import { Sidebar, SaveIndicator } from './components/Sidebar';
import { TaskDrawer } from './components/TaskDrawer';
import { fetchMember } from './lib/api';
import { authLink, isConfigured, supabase } from './lib/supabase';
import type { Member } from './lib/types';
import { useRoute } from './lib/useRoute';
import { useWorkspaceStore, WorkspaceContext } from './lib/useWorkspace';

function Notice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <Logo />
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  );
}

const signOut = () => void supabase.auth.signOut();

export default function App() {
  if (!isConfigured) {
    return (
      <Notice title="Chybí konfigurace">
        <p>VITE_SUPABASE_URL nebo VITE_SUPABASE_ANON_KEY chybí nebo je neplatný. Opravte je podle README.</p>
      </Notice>
    );
  }
  return <AuthGate />;
}

function AuthGate() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [needsPassword, setNeedsPassword] = useState(authLink.needsPassword);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setNeedsPassword(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="loading">Načítám…</div>;
  if (!session) return <Login linkFailed={authLink.failed} />;
  if (needsPassword) return <SetPassword onDone={() => setNeedsPassword(false)} />;
  return <MemberGate key={session.user.id} userId={session.user.id} />;
}

function MemberGate({ userId }: { userId: string }) {
  const [member, setMember] = useState<Member | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  const load = () => {
    setFailed(false);
    fetchMember(userId).then(setMember, (error) => {
      console.error('Načtení člena selhalo', error);
      setFailed(true);
    });
  };
  useEffect(load, [userId]);

  if (failed) {
    return (
      <Notice title="Nepodařilo se připojit">
        <p>Zkontrolujte připojení k internetu a zkuste to znovu.</p>
        <button className="btn-primary" onClick={load}>Zkusit znovu</button>
      </Notice>
    );
  }
  if (member === undefined) return <div className="loading">Načítám…</div>;
  if (member === null) {
    return (
      <Notice title="Nemáte přístup">
        <p>Váš účet není mezi členy týmu. Požádejte správce o přidání.</p>
        <button className="btn-secondary" onClick={signOut}>Odhlásit se</button>
      </Notice>
    );
  }
  return <WorkspaceApp me={member} />;
}

function WorkspaceApp({ me }: { me: Member }) {
  const workspace = useWorkspaceStore(me);
  const route = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const routeKey = route.name === 'page' ? route.id : route.name;

  useEffect(() => {
    setMenuOpen(false);
    setOpenTaskId(null);
  }, [routeKey]);

  const openTask = workspace.tasks.find((t) => t.id === openTaskId);

  return (
    <WorkspaceContext.Provider value={workspace}>
      <div className="app">
        <Sidebar route={route} open={menuOpen} onClose={() => setMenuOpen(false)} onSignOut={signOut} />
        <div className="content">
          <header className="topbar">
            <button className="icon-btn" aria-label="Otevřít menu" onClick={() => setMenuOpen(true)}>☰</button>
            <Logo />
            <SaveIndicator />
          </header>
          <main className="main">
            {workspace.loadFailed ? (
              <div className="empty">
                <p>Data se nepodařilo načíst.</p>
                <button className="btn-secondary" onClick={workspace.actions.reload}>Zkusit znovu</button>
              </div>
            ) : !workspace.ready ? (
              <div className="empty">Načítám…</div>
            ) : route.name === 'page' ? (
              <PageView key={route.id} pageId={route.id} onOpenTask={setOpenTaskId} />
            ) : route.name === 'my' ? (
              <MyTasks onOpenTask={setOpenTaskId} />
            ) : (
              <Overview onOpenTask={setOpenTaskId} />
            )}
          </main>
        </div>
        {openTask && <TaskDrawer key={openTask.id} task={openTask} onClose={() => setOpenTaskId(null)} />}
      </div>
    </WorkspaceContext.Provider>
  );
}
