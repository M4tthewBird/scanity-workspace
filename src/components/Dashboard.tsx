import { addDays, formatDue, formatPrice, todayIso } from '../lib/format';
import { byPosition } from '../lib/order';
import { pageHref } from '../lib/useRoute';
import { JOB_STAGES } from '../lib/types';
import { liveTasks, useWorkspace } from '../lib/useWorkspace';
import { Icon } from './Icon';
import { TaskListRow } from './Overview';

const WEEK = 7;
const FEED_SIZE = 12;

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

function Column({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="dash-block">
      <h2>
        {title}
        {count !== undefined && <span className="count">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

export function Dashboard({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const workspace = useWorkspace();
  const { pages, ideas, comments, milestones, members, me } = workspace;
  const today = todayIso();
  const tasks = liveTasks(workspace);
  const open = tasks.filter((t) => !t.done);
  const jobs = pages.filter((p) => p.kind === 'job');
  const activeJobs = jobs.filter((j) => j.stage === 'realizace' || j.stage === 'nabidka');

  const byDue = (a: { due: string | null }, b: { due: string | null }) => (a.due ?? '').localeCompare(b.due ?? '');
  const overdue = open.filter((t) => t.due && t.due < today).sort(byDue);
  const soon = open.filter((t) => t.due && t.due >= today && t.due <= addDays(today, WEEK)).sort(byDue);
  const mine = open.filter((t) => t.assignee === me.user_id && !overdue.includes(t) && !soon.includes(t));
  const newIdeas = ideas.filter((i) => i.status === 'new');
  const running = byPosition(milestones).filter(
    (m) => m.start_date && m.start_date <= today && (!m.end_date || m.end_date >= today),
  );

  const summary = [
    overdue.length > 0 && plural(overdue.length, 'úkol po termínu', 'úkoly po termínu', 'úkolů po termínu'),
    soon.length > 0 && `${plural(soon.length, 'úkol', 'úkoly', 'úkolů')} tento týden`,
    activeJobs.length > 0 && plural(activeJobs.length, 'rozběhnutá zakázka', 'rozběhnuté zakázky', 'rozběhnutých zakázek'),
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

  const milestoneProgress = (id: string) => {
    const linked = tasks.filter((t) => t.milestone_id === id);
    return linked.length ? Math.round((linked.filter((t) => t.done).length / linked.length) * 100) : null;
  };

  return (
    <div className="view dash">
      <header className="dash-head">
        <h1>{summary.length > 0 ? `${summary.join(', ')}.` : 'Všechno je v klidu.'}</h1>
      </header>

      <div className="dash-grid">
        <div className="dash-main">
          {overdue.length > 0 && (
            <Column title="Po termínu" count={overdue.length}>
              {overdue.map((task) => <TaskListRow key={task.id} task={task} showPage onOpen={onOpenTask} />)}
            </Column>
          )}

          <Column title="Tento týden" count={soon.length}>
            {soon.length === 0 && <p className="empty-note">Na příštích 7 dní nic nemá termín.</p>}
            {soon.map((task) => <TaskListRow key={task.id} task={task} showPage onOpen={onOpenTask} />)}
          </Column>

          <Column title="Moje další úkoly" count={mine.length}>
            {mine.length === 0 && <p className="empty-note">Nic dalšího nemáte přiřazeno. Přiřaďte si úkol kliknutím na kolečko u něj.</p>}
            {mine.slice(0, 8).map((task) => <TaskListRow key={task.id} task={task} showPage onOpen={onOpenTask} />)}
          </Column>
        </div>

        <aside className="dash-side">
          <Column title="Rozběhnuté zakázky" count={activeJobs.length}>
            {activeJobs.length === 0 && <p className="empty-note">Teď žádná neběží. <a href="#/jobs">Otevřít zakázky</a></p>}
            {activeJobs.map((job) => {
              const jobTasks = tasks.filter((t) => t.page_id === job.id);
              return (
                <a className="dash-row" href={pageHref(job.id)} key={job.id}>
                  <span className="dash-row-title">{job.title || 'Bez názvu'}</span>
                  <span className="dash-row-meta">
                    {JOB_STAGES.find((s) => s.id === job.stage)?.label}
                    {job.price != null && ` · ${formatPrice(job.price)}`}
                    {job.due_date && ` · do ${formatDue(job.due_date)}`}
                    {jobTasks.length > 0 && ` · ${jobTasks.filter((t) => t.done).length}/${jobTasks.length}`}
                  </span>
                </a>
              );
            })}
          </Column>

          <Column title="Běží na roadmapě" count={running.length}>
            {running.length === 0 && <p className="empty-note">Žádná položka teď neběží. <a href="#/dev/roadmap">Doplnit termíny</a></p>}
            {running.map((item) => {
              const progress = milestoneProgress(item.id);
              return (
                <a className="dash-row" href="#/dev/roadmap" key={item.id}>
                  <span className="dash-row-title">{item.title || 'Bez názvu'}</span>
                  <span className="dash-row-meta">
                    {item.end_date ? `do ${formatDue(item.end_date)}` : 'bez konce'}
                    {progress !== null && ` · ${progress} % hotovo`}
                  </span>
                </a>
              );
            })}
          </Column>

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
