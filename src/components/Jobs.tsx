import { useRef, useState } from 'react';
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react';
import { downloadCsv } from '../lib/csv';
import { formatDue, formatPrice, isOverdue } from '../lib/format';
import { byPosition } from '../lib/order';
import { pageHref } from '../lib/useRoute';
import { JOB_STAGES } from '../lib/types';
import type { JobStage, Page } from '../lib/types';
import { liveTasks, useWorkspace } from '../lib/useWorkspace';
import { Comments } from './Comments';
import { CommitInput, ExportButton, Field, TagInput } from './Fields';
import { Icon } from './Icon';

const DRAG_THRESHOLD_PX = 5;

function NewJobForm({ onClose }: { onClose: () => void }) {
  const { pages, companies, contacts, actions } = useWorkspace();
  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [industryId, setIndustryId] = useState('');
  const [price, setPrice] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const id = actions.createJob({
      title,
      companyName,
      contactName,
      email,
      phone,
      industryId: industryId || null,
      price: price === '' ? null : Number(price),
    });
    location.hash = pageHref(id);
  };

  return (
    <form className="new-job" onSubmit={submit}>
      <label className="stack-field stack-wide">
        <span>Název zakázky</span>
        <input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="stack-field">
        <span>Klient</span>
        <input list="company-names" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
      </label>
      <label className="stack-field">
        <span>Kontaktní osoba</span>
        <input list="contact-names" value={contactName} onChange={(e) => setContactName(e.target.value)} />
      </label>
      <label className="stack-field">
        <span>E-mail</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="stack-field">
        <span>Telefon</span>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label className="stack-field">
        <span>Odvětví</span>
        <select value={industryId} onChange={(e) => setIndustryId(e.target.value)}>
          <option value="">Nevybráno</option>
          {byPosition(pages.filter((p) => p.kind === 'industry')).map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </label>
      <label className="stack-field">
        <span>Cena (Kč)</span>
        <input type="number" min="0" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
      </label>
      <datalist id="company-names">
        {companies.map((c) => <option key={c.id} value={c.name} />)}
      </datalist>
      <datalist id="contact-names">
        {contacts.map((c) => <option key={c.id} value={c.name} />)}
      </datalist>
      <p className="form-hint stack-wide">Klient a kontakt se automaticky založí v CRM, pokud tam ještě nejsou.</p>
      <div className="form-actions stack-wide">
        <button type="button" className="btn-quiet" onClick={onClose}>Zrušit</button>
        <button className="btn-primary">Vytvořit zakázku</button>
      </div>
    </form>
  );
}

function JobCard({ job, onDragStart }: { job: Page; onDragStart: (event: ReactPointerEvent, job: Page) => void }) {
  const workspace = useWorkspace();
  const { companies, actions } = workspace;
  const company = companies.find((c) => c.id === job.company_id);
  const tasks = liveTasks(workspace).filter((t) => t.page_id === job.id);
  const done = tasks.filter((t) => t.done).length;
  const overdue = isOverdue(job.due_date, job.stage === 'vyfakturovano' || job.stage === 'predano');

  return (
    <article
      className="job-card"
      onPointerDown={(event) => onDragStart(event, job)}
      onClick={() => (location.hash = pageHref(job.id))}
    >
      <a className="job-title" href={pageHref(job.id)} draggable={false} onClick={(e) => e.stopPropagation()}>
        {job.title || 'Bez názvu'}
      </a>
      {company && <p className="job-client">{company.name}</p>}
      <div className="job-meta">
        {job.price != null && <span className="job-price">{formatPrice(job.price)}</span>}
        {job.due_date && <span className={overdue ? 'is-overdue' : ''}>{overdue ? 'Po termínu ' : 'Do '}{formatDue(job.due_date)}</span>}
        {tasks.length > 0 && <span>{done}/{tasks.length}</span>}
      </div>
      {/* Na dotyku by přetahování bojovalo s posouváním sloupců, proto výběr. */}
      <select
        className="job-stage-select"
        aria-label="Stav zakázky"
        value={job.stage ?? 'poptavka'}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => actions.setJobStage(job.id, e.target.value as JobStage)}
      >
        {JOB_STAGES.map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
    </article>
  );
}

export function Jobs() {
  const { pages, companies, contacts, actions } = useWorkspace();
  const [adding, setAdding] = useState(false);
  const [industry, setIndustry] = useState('');
  const [overStage, setOverStage] = useState<JobStage | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const suppressClick = useRef(false);

  const jobs = byPosition(pages.filter((p) => p.kind === 'job')).filter((j) => !industry || j.industry_id === industry);
  const industries = byPosition(pages.filter((p) => p.kind === 'industry'));
  const template = pages.find((p) => p.kind === 'template');

  const startDrag = (event: ReactPointerEvent, job: Page) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;
    let target: JobStage | null = null;

    const onMove = (e: PointerEvent) => {
      if (!active && Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD_PX) return;
      if (!active) {
        active = true;
        setDraggingId(job.id);
        document.body.classList.add('is-dragging');
      }
      target = (document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-stage]')?.dataset.stage as JobStage) ?? null;
      setOverStage(target);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (!active) return;
      document.body.classList.remove('is-dragging');
      setDraggingId(null);
      setOverStage(null);
      if (target) actions.setJobStage(job.id, target);
      // Puštění tlačítka vyvolá click, který by jinak otevřel kartu.
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const exportCsv = () =>
    downloadCsv(
      'scanity-zakazky.csv',
      ['Zakázka', 'Stav', 'Klient', 'Kontakt', 'Odvětví', 'Cena', 'Začátek', 'Termín', 'Štítky'],
      pages
        .filter((p) => p.kind === 'job')
        .map((j) => [
          j.title,
          JOB_STAGES.find((s) => s.id === j.stage)?.label,
          companies.find((c) => c.id === j.company_id)?.name,
          contacts.find((c) => c.id === j.contact_id)?.name,
          pages.find((p) => p.id === j.industry_id)?.title,
          j.price,
          j.start_date,
          j.due_date,
          j.tags,
        ]),
    );

  return (
    <div className="view view-wide">
      <div className="toolbar">
        <h1>Zakázky</h1>
        <select aria-label="Filtr podle odvětví" value={industry} onChange={(e) => setIndustry(e.target.value)}>
          <option value="">Všechna odvětví</option>
          {industries.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        {template && <a className="btn-quiet" href={pageHref(template.id)}>Upravit šablonu</a>}
        <ExportButton onClick={exportCsv} />
        <button type="button" className="btn-primary" onClick={() => setAdding(!adding)}>
          <Icon name="plus" size={16} /> Nová zakázka
        </button>
      </div>

      {adding && <NewJobForm onClose={() => setAdding(false)} />}

      <div
        className="kanban"
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {JOB_STAGES.map((stage) => {
          const column = jobs.filter((j) => (j.stage ?? 'poptavka') === stage.id);
          const sum = column.reduce((total, j) => total + (j.price ?? 0), 0);
          return (
            <section className={`kanban-column ${overStage === stage.id ? 'is-over' : ''}`} data-stage={stage.id} key={stage.id}>
              <header>
                <h2>{stage.label} <span className="count">{column.length}</span></h2>
                {sum > 0 && <span className="kanban-sum">{formatPrice(sum)}</span>}
              </header>
              <div className="kanban-cards">
                {column.map((job) => (
                  <div key={job.id} className={draggingId === job.id ? 'is-drag-source' : ''}>
                    <JobCard job={job} onDragStart={startDrag} />
                  </div>
                ))}
                {column.length === 0 && <p className="kanban-empty">Nic</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// Obchodní údaje v záhlaví stránky zakázky. Klient a kontakt se při zápisu sami založí v CRM.
export function JobPanel({ job }: { job: Page }) {
  const { pages, companies, contacts, actions } = useWorkspace();
  const company = companies.find((c) => c.id === job.company_id);
  const contact = contacts.find((c) => c.id === job.contact_id);

  return (
    <>
      <div className="job-panel">
        <Field label="Stav">
          <select value={job.stage ?? 'poptavka'} onChange={(e) => actions.setJobStage(job.id, e.target.value as JobStage)}>
            {JOB_STAGES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Klient">
          <CommitInput list="company-names" placeholder="Název firmy" value={company?.name ?? ''} onCommit={(name) => actions.setJobCompany(job.id, name)} />
        </Field>
        <Field label="Kontakt">
          <CommitInput list="contact-names" placeholder="Jméno" value={contact?.name ?? ''} onCommit={(name) => actions.setJobContact(job.id, name)} />
        </Field>
        {contact && (
          <>
            <Field label="E-mail">
              <CommitInput type="email" value={contact.email ?? ''} onCommit={(email) => actions.update('contacts', contact.id, { email })} />
            </Field>
            <Field label="Telefon">
              <CommitInput type="tel" value={contact.phone ?? ''} onCommit={(phone) => actions.update('contacts', contact.id, { phone })} />
            </Field>
          </>
        )}
        <Field label="Odvětví">
          <select value={job.industry_id ?? ''} onChange={(e) => actions.setJobIndustry(job.id, e.target.value || null)}>
            <option value="">Nevybráno</option>
            {byPosition(pages.filter((p) => p.kind === 'industry')).map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </Field>
        <Field label="Cena (Kč)">
          <CommitInput
            type="number"
            min="0"
            inputMode="numeric"
            value={job.price == null ? '' : String(job.price)}
            onCommit={(value) => actions.update('pages', job.id, { price: value === '' ? null : Number(value) })}
          />
        </Field>
        <Field label="Začátek">
          <input type="date" value={job.start_date ?? ''} onChange={(e) => actions.update('pages', job.id, { start_date: e.target.value || null })} />
        </Field>
        <Field label="Termín">
          <input type="date" value={job.due_date ?? ''} onChange={(e) => actions.update('pages', job.id, { due_date: e.target.value || null })} />
        </Field>
        <Field label="Štítky">
          <TagInput tags={job.tags} onChange={(tags) => actions.update('pages', job.id, { tags })} />
        </Field>
        <datalist id="company-names">
          {companies.map((c) => <option key={c.id} value={c.name} />)}
        </datalist>
        <datalist id="contact-names">
          {contacts.map((c) => <option key={c.id} value={c.name} />)}
        </datalist>
      </div>
      {company && <a className="crm-link" href={`#/crm/company/${company.id}`}>Otevřít firmu v CRM</a>}
    </>
  );
}

export function JobHistory({ job }: { job: Page }) {
  return <Comments type="job" id={job.id} title="Historie" placeholder="Zapsat poznámku k zakázce…" />;
}
