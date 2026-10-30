import { formatPrice, todayIso } from '../lib/format';
import { byPosition } from '../lib/order';
import { IDEA_STATUSES, JOB_STAGES } from '../lib/types';
import { liveTasks, useWorkspace } from '../lib/useWorkspace';

interface Bar {
  key: string;
  label: string;
  value: number;
  display: string;
}

function BarList({ title, bars, note }: { title: string; bars: Bar[]; note?: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <section className="stat-block">
      <h2>{title}</h2>
      {bars.length === 0 && <p className="empty-note">{note ?? 'Zatím žádná data.'}</p>}
      <dl className="bar-list">
        {bars.map((bar) => (
          <div className="bar-row" key={bar.key} title={`${bar.label}: ${bar.display}`}>
            <dt>{bar.label}</dt>
            <dd>
              <span className="bar-track">
                {bar.value > 0 && <span className="bar-fill" style={{ width: `${(bar.value / max) * 100}%` }} />}
              </span>
              <span className="bar-value">{bar.display}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function Stats() {
  const workspace = useWorkspace();
  const { pages, ideas, members, companies, contacts } = workspace;
  const today = todayIso();
  const tasks = liveTasks(workspace);
  const open = tasks.filter((t) => !t.done);
  const jobs = pages.filter((p) => p.kind === 'job');
  const billed = jobs.filter((j) => j.stage === 'vyfakturovano');
  const pipeline = jobs.filter((j) => j.stage === 'nabidka' || j.stage === 'realizace' || j.stage === 'predano');
  const sum = (rows: typeof jobs) => rows.reduce((total, j) => total + (j.price ?? 0), 0);
  const overdue = open.filter((t) => t.due && t.due < today).length;

  const facts = [
    { label: 'Vyfakturováno', value: formatPrice(sum(billed)) },
    { label: 'Rozpracováno', value: formatPrice(sum(pipeline)) },
    { label: 'Otevřené úkoly', value: String(open.length) },
    { label: 'Po termínu', value: String(overdue), alert: overdue > 0 },
    { label: 'Klienti', value: String(companies.length) },
    { label: 'Kontakty', value: String(contacts.length) },
  ];

  return (
    <div className="view view-wide">
      <h1 className="view-title">Statistiky</h1>
      <dl className="fact-strip">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd className={fact.alert ? 'is-alert' : ''}>{fact.value}</dd>
          </div>
        ))}
      </dl>
      <div className="stat-grid">
        <BarList
          title="Zakázky podle stavu"
          bars={JOB_STAGES.map((s) => {
            const rows = jobs.filter((j) => (j.stage ?? 'poptavka') === s.id);
            return {
              key: s.id,
              label: s.label,
              value: rows.length,
              display: sum(rows) > 0 ? `${rows.length} · ${formatPrice(sum(rows))}` : String(rows.length),
            };
          })}
        />
        <BarList
          title="Obrat podle odvětví"
          note="Obrat se ukáže po vyfakturování první zakázky s cenou."
          bars={byPosition(pages.filter((p) => p.kind === 'industry'))
            .map((industry) => {
              const value = sum(billed.filter((j) => j.industry_id === industry.id));
              return { key: industry.id, label: industry.title, value, display: formatPrice(value) };
            })
            .filter(() => billed.length > 0)}
        />
        <BarList
          title="Otevřené úkoly podle produktu"
          bars={byPosition(pages.filter((p) => p.kind === 'product')).map((product) => {
            const value = open.filter((t) => t.page_id === product.id).length;
            return { key: product.id, label: product.title, value, display: String(value) };
          })}
        />
        <BarList
          title="Otevřené úkoly podle člověka"
          bars={[
            ...members.map((m) => {
              const value = open.filter((t) => t.assignee === m.user_id).length;
              return { key: m.user_id, label: m.name, value, display: String(value) };
            }),
            { key: 'none', label: 'Nepřiřazeno', value: open.filter((t) => !t.assignee).length, display: String(open.filter((t) => !t.assignee).length) },
          ]}
        />
        <BarList
          title="Nápady podle stavu"
          bars={IDEA_STATUSES.map((s) => {
            const value = ideas.filter((i) => i.status === s.id).length;
            return { key: s.id, label: s.label, value, display: String(value) };
          })}
        />
      </div>
    </div>
  );
}
