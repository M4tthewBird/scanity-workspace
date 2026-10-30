import { formatDue, formatPrice } from '../lib/format';
import { byPosition } from '../lib/order';
import { pageHref } from '../lib/useRoute';
import { JOB_STAGES } from '../lib/types';
import type { Page } from '../lib/types';
import { liveTasks, useWorkspace } from '../lib/useWorkspace';
import { Icon } from './Icon';

export function Industries() {
  const workspace = useWorkspace();
  const { pages, companies, actions } = workspace;
  const tasks = liveTasks(workspace);
  const industries = byPosition(pages.filter((p) => p.kind === 'industry'));

  return (
    <div className="view view-wide">
      <div className="toolbar">
        <h1>Odvětví</h1>
        <button type="button" className="btn-secondary" onClick={() => (location.hash = pageHref(actions.createPage('industry')))}>
          <Icon name="plus" size={16} /> Odvětví
        </button>
      </div>
      {industries.length === 0 && <p className="empty-note">Zatím tu žádné odvětví není. Přidejte první tlačítkem výše.</p>}
      <div className="industry-grid">
        {industries.map((industry) => {
          const jobs = pages.filter((p) => p.kind === 'job' && p.industry_id === industry.id);
          const revenue = jobs.filter((j) => j.stage === 'vyfakturovano').reduce((sum, j) => sum + (j.price ?? 0), 0);
          const open = tasks.filter((t) => t.page_id === industry.id && !t.done).length;
          const clients = companies.filter((c) => c.industry_id === industry.id).length;
          return (
            <a className="industry-card" href={pageHref(industry.id)} key={industry.id}>
              <span className="industry-icon">{industry.icon}</span>
              <h2>{industry.title || 'Bez názvu'}</h2>
              <dl>
                <div><dt>Zakázky</dt><dd>{jobs.length}</dd></div>
                <div><dt>Klienti</dt><dd>{clients}</dd></div>
                <div><dt>Úkoly</dt><dd>{open}</dd></div>
                <div><dt>Obrat</dt><dd>{revenue > 0 ? formatPrice(revenue) : '–'}</dd></div>
              </dl>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// Zakázky a klienti na stránce odvětví, pod nimi běžné sekce a úkoly.
export function IndustryPanel({ industry }: { industry: Page }) {
  const { pages, companies } = useWorkspace();
  const jobs = byPosition(pages.filter((p) => p.kind === 'job' && p.industry_id === industry.id));
  const clients = companies.filter((c) => c.industry_id === industry.id);

  return (
    <div className="industry-panel">
      <section>
        <h2 className="group-title">Zakázky <span className="count">{jobs.length}</span></h2>
        {jobs.length === 0 && <p className="empty-note">Zakázka se tu objeví, až u ní vyberete toto odvětví.</p>}
        {jobs.map((job) => (
          <a className="dash-row" href={pageHref(job.id)} key={job.id}>
            <span className="dash-row-title">{job.title || 'Bez názvu'}</span>
            <span className="dash-row-meta">
              {JOB_STAGES.find((s) => s.id === job.stage)?.label}
              {job.price != null && ` · ${formatPrice(job.price)}`}
              {job.due_date && ` · do ${formatDue(job.due_date)}`}
            </span>
          </a>
        ))}
      </section>
      <section>
        <h2 className="group-title">Klienti <span className="count">{clients.length}</span></h2>
        {clients.length === 0 && <p className="empty-note">Klient se tu objeví sám, jakmile bude mít zakázku v tomto odvětví.</p>}
        {clients.map((company) => (
          <a className="dash-row" href={`#/crm/company/${company.id}`} key={company.id}>
            <span className="dash-row-title">{company.name || 'Bez názvu'}</span>
          </a>
        ))}
      </section>
    </div>
  );
}
