import { addDays, todayIso } from '../lib/format';
import { byPosition } from '../lib/order';
import { pageHref } from '../lib/useRoute';
import type { Task } from '../lib/types';
import { liveTasks, useWorkspace } from '../lib/useWorkspace';
import { Icon } from './Icon';
import { TaskListRow } from './Overview';
import { hasMeetings } from '../lib/api';
import { MeetingCard } from './Meetings';
import { ProjectBoard } from './ProjectBoard';
import { projectState } from './ProjectTile';

const WEEK = 7;
const FEED_SIZE = 10;
const MINE_SIZE = 8;

function plural(count: number, one: string, few: string, many: string): string {
  if (count === 1) return `1 ${one}`;
  return `${count} ${count >= 2 && count <= 4 ? few : many}`;
}

function timeAgo(value: string): string {
  const minutes = Math.round((Date.now() - Date.parse(value)) / 60000);
  if (minutes < 1) return 'právě teď';
  if (minutes < 60) return `před ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `před ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'včera' : `před ${days} dny`;
}

interface FeedItem {
  key: string;
  at: string;
  who?: string;
  text: string;
  href: string;
}

function Column({ title, count, className, children }: { title: string; count?: number; className?: string; children: React.ReactNode }) {
  return (
    <section className={`dash-block ${className ?? ''}`}>
      <h2>
        {title}
        {count !== undefined && <span className="count">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

// Hoří: priorita P1, nebo termín dnes, zítra či už po něm.
function isBurning(task: Task, today: string): boolean {
  return task.priority === 'P1' || Boolean(task.due && task.due <= addDays(today, 1));
}

export function Dashboard({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const workspace = useWorkspace();
  const { pages, ideas, comments, members, me } = workspace;
  const today = todayIso();
  const tasks = liveTasks(workspace);
  const open = tasks.filter((t) => !t.done);
  const jobs = pages.filter((p) => p.kind === 'job');
  const pinned = [
    ...byPosition(pages.filter((p) => p.pinned && p.kind === 'product')),
    ...byPosition(pages.filter((p) => p.pinned && p.kind === 'job')),
  ];
  // Bez migration-004.sql sloupec pinned v datech vůbec není.
  const migrated = pages.length === 0 || pages.some((p) => p.pinned !== undefined);

  const hotProjects = pinned.filter((p) => projectState(p) === 'hot');
  const byUrgency = (a: Task, b: Task) =>
    (a.due ?? '9999').localeCompare(b.due ?? '9999') || (a.priority ?? 'P9').localeCompare(b.priority ?? 'P9');
  const burning = open.filter((t) => isBurning(t, today)).sort(byUrgency);
  const soon = open.filter((t) => !burning.includes(t) && t.due && t.due <= addDays(today, WEEK)).sort(byUrgency);
  const mine = open.filter((t) => t.assignee === me.user_id && !burning.includes(t) && !soon.includes(t));
  const newIdeas = ideas.filter((i) => i.status === 'new');
  const fireCount = hotProjects.length + burning.length;

  const summary = [
    fireCount > 0 && plural(fireCount, 'věc hoří', 'věci hoří', 'věcí hoří'),
    soon.length > 0 && `${plural(soon.length, 'úkol', 'úkoly', 'úkolů')} tento týden`,
    newIdeas.length > 0 && plural(newIdeas.length, 'nový nápad', 'nové nápady', 'nových nápadů'),
  ].filter(Boolean) as string[];

  const memberName = (id: string | null) => members.find((m) => m.user_id === id)?.name;
  const pageOf = (id: string) => pages.find((p) => p.id === id);
  const taskOf = (id: string) => workspace.tasks.find((t) => t.id === id);
  const feed: FeedItem[] = [
    ...comments
      .filter((c) => c.created_at)
      .map((c): FeedItem => {
        const job = c.target_type === 'job' ? pageOf(c.target_id) : undefined;
        const task = c.target_type === 'task' ? taskOf(c.target_id) : undefined;
        const context = job?.title ?? task?.text;
        return {
          key: c.id,
          at: c.created_at!,
          who: memberName(c.author),
          text: `${c.system ? '' : 'Komentář: '}${c.body}${context ? ` (${context})` : ''}`,
          href: job ? pageHref(job.id) : task ? pageHref(task.page_id) : '#/crm',
        };
      }),
    ...ideas
      .filter((i) => i.created_at)
      .map((i): FeedItem => ({ key: i.id, at: i.created_at!, who: memberName(i.created_by), text: `Nápad: ${i.text}`, href: '#/dev/ideas' })),
    ...tasks
      .filter((t) => t.done && t.updated_at)
      .map((t): FeedItem => ({ key: t.id, at: t.updated_at!, text: `Hotovo: ${t.text || 'Nový úkol'}`, href: pageHref(t.page_id) })),
    ...tasks
      .filter((t) => !t.done && t.created_at && t.text)
      .map((t): FeedItem => ({ key: `${t.id}-new`, at: t.created_at!, who: memberName(t.created_by), text: `Nový úkol: ${t.text}`, href: pageHref(t.page_id) })),
    ...jobs
      .filter((j) => j.created_at)
      .map((j): FeedItem => ({ key: j.id, at: j.created_at!, text: `Nová zakázka: ${j.title || 'Bez názvu'}`, href: pageHref(j.id) })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, FEED_SIZE);

  return (
    <div className="view dash">
      <header className="dash-head">
        <h1>{summary.length > 0 ? `${summary.join(', ')}.` : 'Všechno je v klidu.'}</h1>
      </header>

      <div className="dash-grid">
        <div className="dash-main">
          {migrated ? (
            <ProjectBoard />
          ) : (
            <p className="empty-note">Dlaždice projektů potřebují v Supabase spustit <code>supabase/migration-004.sql</code>.</p>
          )}

          {soon.length > 0 && (
            <Column title="Tento týden" count={soon.length}>
              {soon.map((task) => <TaskListRow key={task.id} task={task} showPage onOpen={onOpenTask} />)}
            </Column>
          )}

          <Column title="Moje další úkoly" count={mine.length}>
            {mine.length === 0 && <p className="empty-note">Nic dalšího nemáte přiřazeno. Přiřaďte si úkol kliknutím na kolečko u něj.</p>}
            {mine.slice(0, MINE_SIZE).map((task) => <TaskListRow key={task.id} task={task} showPage onOpen={onOpenTask} />)}
          </Column>
        </div>

        <aside className="dash-side">
          <Column title="Co hoří" count={fireCount} className="dash-fire">
            {fireCount === 0 && <p className="empty-note">Nic nehoří. Projekt sem dostanete stavem Hoří, úkol prioritou P1 nebo termínem do zítřka.</p>}
            {hotProjects.map((page) => (
              <a className="fire-project" href={pageHref(page.id)} key={page.id}>
                <Icon name="flame" size={16} />
                <span className="fire-body">
                  <span className="dash-row-title">{page.title || 'Bez názvu'}</span>
                  {page.status && <span className="dash-row-meta fire-status">{page.status}</span>}
                </span>
              </a>
            ))}
            {burning.map((task) => <TaskListRow key={task.id} task={task} showPage onOpen={onOpenTask} />)}
          </Column>

          {hasMeetings() && <MeetingCard />}

          <Column title="Co se dělo">
            {feed.length === 0 && <p className="empty-note">Zatím tu nic není. Aktivita týmu se ukáže tady.</p>}
            <ol className="feed">
              {feed.map((item) => (
                <li key={item.key}>
                  <a href={item.href}>{item.text}</a>
                  <span className="feed-meta">
                    {item.who && `${item.who} · `}
                    {timeAgo(item.at)}
                  </span>
                </li>
              ))}
            </ol>
          </Column>

          {newIdeas.length > 0 && (
            <a className="dash-link" href="#/dev/ideas">
              <Icon name="bulb" size={16} /> {plural(newIdeas.length, 'nový nápad', 'nové nápady', 'nových nápadů')} čeká na roztřídění
            </a>
          )}
        </aside>
      </div>
    </div>
  );
}
