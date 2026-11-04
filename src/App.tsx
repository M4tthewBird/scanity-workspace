import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Login, SetPassword } from './auth/Login';
import { CompanyDetail, ContactDetail, Crm } from './components/Crm';
import { Dashboard } from './components/Dashboard';
import { Ideas } from './components/Ideas';
import { Industries } from './components/Industries';
import { Jobs } from './components/Jobs';
import { Logo } from './components/Logo';
import { MeetingRoom } from './components/MeetingRoom';
import { AllTasks } from './components/Overview';
import { PageView } from './components/PageView';
import { QuickAdd } from './components/QuickAdd';
import type { Toast } from './components/QuickAdd';
import { Roadmap } from './components/Roadmap';
import { SearchDialog } from './components/SearchDialog';
import { Stats } from './components/Stats';
import { TaskDrawer } from './components/TaskDrawer';
import { TopBar } from './components/TopBar';
import { DevHome } from './components/Vyvoj';
import { fetchMember } from './lib/api';
import { authLink, isConfigured, supabase } from './lib/supabase';
import type { Member } from './lib/types';
import { useRoute } from './lib/useRoute';
import type { Route } from './lib/useRoute';
import { useWorkspaceStore, WorkspaceContext } from './lib/useWorkspace';

const TOAST_MS = 4000;

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

function RouteView({ route, onOpenTask }: { route: Route; onOpenTask: (id: string) => void }) {
  switch (route.name) {
    case 'page':
      return <PageView key={route.id} pageId={route.id} onOpenTask={onOpenTask} />;
    case 'dev':
      return <DevHome />;
    case 'ideas':
      return <Ideas />;
    case 'tasks':
      return <AllTasks onOpenTask={onOpenTask} />;
    case 'roadmap':
      return <Roadmap />;
    case 'industries':
      return <Industries />;
    case 'jobs':
      return <Jobs />;
    case 'crm':
      return <Crm />;
    case 'company':
      return <CompanyDetail key={route.id} id={route.id} />;
    case 'contact':
      return <ContactDetail key={route.id} id={route.id} />;
    case 'stats':
      return <Stats />;
    case 'meeting':
      return <MeetingRoom key={route.id} id={route.id} onOpenTask={onOpenTask} />;
    default:
      return <Dashboard onOpenTask={onOpenTask} />;
  }
}

function WorkspaceApp({ me }: { me: Member }) {
  const workspace = useWorkspaceStore(me);
  const route = useRoute();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [searching, setSearching] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const keepTask = useRef<string | null>(null);
  const routeKey = 'id' in route ? route.id : route.name;

  useEffect(() => {
    setOpenTaskId(keepTask.current);
    keepTask.current = null;
    document.querySelector('.main')?.scrollTo(0, 0);
  }, [routeKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearching(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const openTask = workspace.tasks.find((t) => t.id === openTaskId);

  return (
    <WorkspaceContext.Provider value={workspace}>
      <div className="app">
        <TopBar route={route} onAdd={() => setAdding(true)} onSearch={() => setSearching(true)} onSignOut={signOut} />
        <main className="main">
          {workspace.loadFailed ? (
            <div className="empty">
              <p>Data se nepodařilo načíst. Zkontrolujte připojení a zkuste to znovu.</p>
              <button className="btn-secondary" onClick={workspace.actions.reload}>Zkusit znovu</button>
            </div>
          ) : !workspace.ready ? (
            <div className="empty">Načítám…</div>
          ) : (
            <RouteView route={route} onOpenTask={setOpenTaskId} />
          )}
        </main>
        {openTask && <TaskDrawer key={openTask.id} task={openTask} onClose={() => setOpenTaskId(null)} />}
        {adding && <QuickAdd route={route} onClose={() => setAdding(false)} onDone={setToast} />}
        {searching && (
          <SearchDialog
            onClose={() => setSearching(false)}
            onOpenTask={(id) => {
              keepTask.current = id;
              setOpenTaskId(id);
            }}
          />
        )}
        {toast && (
          <div className="toast" role="status">
            {toast.message}
            {toast.href && <a href={toast.href}>Otevřít</a>}
          </div>
        )}
      </div>
    </WorkspaceContext.Provider>
  );
}
