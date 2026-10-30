import { useEffect, useState } from 'react';
import { downloadCsv } from '../lib/csv';
import { formatDate, formatPrice } from '../lib/format';
import { byPosition } from '../lib/order';
import { pageHref } from '../lib/useRoute';
import { matches } from '../lib/text';
import { JOB_STAGES } from '../lib/types';
import { useWorkspace } from '../lib/useWorkspace';
import { Comments } from './Comments';
import { EditableText } from './EditableText';
import { CommitInput, ExportButton, Field } from './Fields';
import { Icon } from './Icon';

function useLastActivity() {
  const { comments } = useWorkspace();
  return (ids: string[], fallback: string | null) => {
    const set = new Set(ids);
    const latest = comments
      .filter((c) => set.has(c.target_id) && c.created_at)
      .map((c) => c.created_at!)
      .sort()
      .at(-1);
    return latest ?? fallback;
  };
}

export function Crm() {
  const { companies, contacts, pages, actions } = useWorkspace();
  const lastActivity = useLastActivity();
  const [view, setView] = useState<'companies' | 'contacts'>('companies');
  const [query, setQuery] = useState('');
  const industryName = (id: string | null) => pages.find((p) => p.id === id)?.title;

  const companyName = (id: string | null) => companies.find((c) => c.id === id)?.name;
  const visibleCompanies = companies
    .filter((c) => !query || matches(query, c.name, c.website, c.notes))
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  const visibleContacts = contacts
    .filter((c) => !query || matches(query, c.name, c.email, c.phone, companyName(c.company_id)))
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'));

  const jobsOf = (companyId: string) => pages.filter((p) => p.kind === 'job' && p.company_id === companyId);

  const exportCsv = () =>
    view === 'companies'
      ? downloadCsv(
          'scanity-firmy.csv',
          ['Firma', 'Odvětví', 'Web', 'Kontaktů', 'Zakázek', 'Obrat', 'Poznámky'],
          companies.map((c) => [
            c.name,
            industryName(c.industry_id),
            c.website,
            contacts.filter((k) => k.company_id === c.id).length,
            jobsOf(c.id).length,
            jobsOf(c.id).filter((j) => j.stage === 'vyfakturovano').reduce((s, j) => s + (j.price ?? 0), 0),
            c.notes,
          ]),
        )
      : downloadCsv(
          'scanity-kontakty.csv',
          ['Jméno', 'Firma', 'Pozice', 'E-mail', 'Telefon', 'Poznámky'],
          contacts.map((c) => [c.name, companyName(c.company_id), c.role, c.email, c.phone, c.notes]),
        );

  return (
    <div className="view view-wide">
      <div className="toolbar">
        <h1>CRM</h1>
        <div className="segmented" role="group" aria-label="Zobrazení">
          <button type="button" className={view === 'companies' ? 'is-active' : ''} aria-pressed={view === 'companies'} onClick={() => setView('companies')}>
            Firmy <span className="count">{companies.length}</span>
          </button>
          <button type="button" className={view === 'contacts' ? 'is-active' : ''} aria-pressed={view === 'contacts'} onClick={() => setView('contacts')}>
            Kontakty <span className="count">{contacts.length}</span>
          </button>
        </div>
        <input className="toolbar-search" placeholder="Filtrovat…" aria-label="Filtrovat" value={query} onChange={(e) => setQuery(e.target.value)} />
        <ExportButton onClick={exportCsv} />
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            location.hash = view === 'companies' ? `#/crm/company/${actions.createCompany()}` : `#/crm/contact/${actions.createContact({})}`;
          }}
        >
          <Icon name="plus" size={16} /> {view === 'companies' ? 'Firma' : 'Kontakt'}
        </button>
      </div>

      {view === 'companies' ? (
        <div className="data-table" role="table" aria-label="Firmy">
          <div className="data-row data-head" role="row">
            <span role="columnheader">Firma</span>
            <span role="columnheader">Odvětví</span>
            <span role="columnheader" className="num">Kontakty</span>
            <span role="columnheader" className="num">Zakázky</span>
            <span role="columnheader" className="num">Obrat</span>
            <span role="columnheader" className="num">Poslední aktivita</span>
          </div>
          {visibleCompanies.map((company) => {
            const jobs = jobsOf(company.id);
            const revenue = jobs.filter((j) => j.stage === 'vyfakturovano').reduce((s, j) => s + (j.price ?? 0), 0);
            const activity = lastActivity([company.id, ...jobs.map((j) => j.id)], company.updated_at);
            return (
              <a className="data-row" role="row" href={`#/crm/company/${company.id}`} key={company.id}>
                <span role="cell" className="data-title">{company.name || 'Bez názvu'}</span>
                <span role="cell" className="data-muted">{industryName(company.industry_id) ?? '–'}</span>
                <span role="cell" className="num">{contacts.filter((c) => c.company_id === company.id).length}</span>
                <span role="cell" className="num">{jobs.length}</span>
                <span role="cell" className="num">{revenue > 0 ? formatPrice(revenue) : '–'}</span>
                <span role="cell" className="num data-muted">{activity ? formatDate(activity) : '–'}</span>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="data-table data-table-contacts" role="table" aria-label="Kontakty">
          <div className="data-row data-head" role="row">
            <span role="columnheader">Jméno</span>
            <span role="columnheader">Firma</span>
            <span role="columnheader">E-mail</span>
            <span role="columnheader">Telefon</span>
          </div>
          {visibleContacts.map((contact) => (
            <a className="data-row" role="row" href={`#/crm/contact/${contact.id}`} key={contact.id}>
              <span role="cell" className="data-title">{contact.name || 'Bez jména'}</span>
              <span role="cell" className="data-muted">{companyName(contact.company_id) ?? '–'}</span>
              <span role="cell" className="data-muted">{contact.email || '–'}</span>
              <span role="cell" className="data-muted">{contact.phone || '–'}</span>
            </a>
          ))}
        </div>
      )}
      {(view === 'companies' ? visibleCompanies : visibleContacts).length === 0 && (
        <p className="empty-note">
          {query
            ? 'Tomuhle filtru nic neodpovídá.'
            : 'Zatím prázdné. Firmy a kontakty se založí samy z nové zakázky, nebo je přidejte ručně či přes Přidat na kterékoli obrazovce.'}
        </p>
      )}
    </div>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="back-link" href={href}><Icon name="back" size={16} /> {label}</a>
  );
}

function useFocusEmpty(selector: string, empty: boolean) {
  useEffect(() => {
    if (empty) requestAnimationFrame(() => document.querySelector<HTMLInputElement>(selector)?.focus());
  }, []);
}

export function CompanyDetail({ id }: { id: string }) {
  const { companies, contacts, pages, actions } = useWorkspace();
  const company = companies.find((c) => c.id === id);
  useFocusEmpty('.detail-name', company?.name === '');

  if (!company) {
    return <div className="view"><BackLink href="#/crm" label="CRM" /><p className="empty-note">Tato firma neexistuje nebo byla smazána.</p></div>;
  }

  const people = contacts.filter((c) => c.company_id === id);
  const jobs = byPosition(pages.filter((p) => p.kind === 'job' && p.company_id === id));
  const revenue = jobs.filter((j) => j.stage === 'vyfakturovano').reduce((s, j) => s + (j.price ?? 0), 0);

  return (
    <div className="view">
      <BackLink href="#/crm" label="CRM" />
      <CommitInput
        className="detail-name"
        placeholder="Název firmy"
        aria-label="Název firmy"
        value={company.name}
        onCommit={(name) => actions.update('companies', id, { name })}
      />
      <p className="detail-summary">
        Zakázky {jobs.length}
        {revenue > 0 && ` · vyfakturováno ${formatPrice(revenue)}`}
      </p>
      <div className="detail-grid">
        <div className="detail-main">
          <div className="drawer-fields">
            <Field label="Odvětví">
              <select value={company.industry_id ?? ''} onChange={(e) => actions.update('companies', id, { industry_id: e.target.value || null })}>
                <option value="">Nevybráno</option>
                {byPosition(pages.filter((p) => p.kind === 'industry')).map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </Field>
            <Field label="Web">
              <CommitInput type="url" placeholder="https://" value={company.website ?? ''} onCommit={(website) => actions.update('companies', id, { website })} />
            </Field>
          </div>
          <EditableText
            className="notes-area"
            placeholder="Poznámky k firmě…"
            aria-label="Poznámky"
            multiline
            table="companies"
            rowId={id}
            value={company.notes ?? ''}
            onValueChange={(notes) => actions.update('companies', id, { notes }, true)}
          />
          <Comments
            type="company"
            id={id}
            relatedIds={jobs.map((j) => j.id)}
            title="Historie"
            placeholder="Zapsat hovor, schůzku, domluvu…"
          />
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              if (window.confirm(`Smazat firmu „${company.name || 'Bez názvu'}“? Zakázky a kontakty zůstanou, jen se od ní odpojí.`)) {
                actions.remove('companies', id);
                location.hash = '#/crm';
              }
            }}
          >
            Smazat firmu
          </button>
        </div>
        <aside className="detail-side">
          <section>
            <h2 className="group-title">Kontakty <span className="count">{people.length}</span></h2>
            {people.map((person) => (
              <a className="dash-row" href={`#/crm/contact/${person.id}`} key={person.id}>
                <span className="dash-row-title">{person.name || 'Bez jména'}</span>
                <span className="dash-row-meta">{[person.role, person.email, person.phone].filter(Boolean).join(' · ')}</span>
              </a>
            ))}
            <button
              type="button"
              className="btn-quiet"
              onClick={() => (location.hash = `#/crm/contact/${actions.createContact({ companyId: id })}`)}
            >
              <Icon name="plus" size={16} /> Kontakt
            </button>
          </section>
          <section>
            <h2 className="group-title">Zakázky <span className="count">{jobs.length}</span></h2>
            {jobs.length === 0 && <p className="empty-note">Zatím žádná.</p>}
            {jobs.map((job) => (
              <a className="dash-row" href={pageHref(job.id)} key={job.id}>
                <span className="dash-row-title">{job.title || 'Bez názvu'}</span>
                <span className="dash-row-meta">
                  {JOB_STAGES.find((s) => s.id === job.stage)?.label}
                  {job.price != null && ` · ${formatPrice(job.price)}`}
                </span>
              </a>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}

export function ContactDetail({ id }: { id: string }) {
  const { contacts, companies, pages, actions } = useWorkspace();
  const contact = contacts.find((c) => c.id === id);
  useFocusEmpty('.detail-name', contact?.name === '');

  if (!contact) {
    return <div className="view"><BackLink href="#/crm" label="CRM" /><p className="empty-note">Tento kontakt neexistuje nebo byl smazán.</p></div>;
  }

  const company = companies.find((c) => c.id === contact.company_id);
  const jobs = byPosition(pages.filter((p) => p.kind === 'job' && p.contact_id === id));

  return (
    <div className="view">
      <BackLink href={company ? `#/crm/company/${company.id}` : '#/crm'} label={company?.name || 'CRM'} />
      <CommitInput
        className="detail-name"
        placeholder="Jméno"
        aria-label="Jméno"
        value={contact.name}
        onCommit={(name) => actions.update('contacts', id, { name })}
      />
      <div className="detail-grid">
        <div className="detail-main">
          <div className="drawer-fields">
            <Field label="Firma">
              <CommitInput
                list="crm-companies"
                placeholder="Název firmy"
                value={company?.name ?? ''}
                onCommit={(name) => actions.update('contacts', id, { company_id: actions.ensureCompany(name) })}
              />
            </Field>
            <Field label="Pozice">
              <CommitInput value={contact.role ?? ''} onCommit={(role) => actions.update('contacts', id, { role })} />
            </Field>
            <Field label="E-mail">
              <CommitInput type="email" value={contact.email ?? ''} onCommit={(email) => actions.update('contacts', id, { email })} />
            </Field>
            <Field label="Telefon">
              <CommitInput type="tel" value={contact.phone ?? ''} onCommit={(phone) => actions.update('contacts', id, { phone })} />
            </Field>
            <datalist id="crm-companies">
              {companies.map((c) => <option key={c.id} value={c.name} />)}
            </datalist>
          </div>
          {(contact.email || contact.phone) && (
            <div className="contact-actions">
              {contact.email && <a className="btn-secondary" href={`mailto:${contact.email}`}>Napsat e-mail</a>}
              {contact.phone && <a className="btn-secondary" href={`tel:${contact.phone.replace(/\s/g, '')}`}>Zavolat</a>}
            </div>
          )}
          <EditableText
            className="notes-area"
            placeholder="Poznámky ke kontaktu…"
            aria-label="Poznámky"
            multiline
            table="contacts"
            rowId={id}
            value={contact.notes ?? ''}
            onValueChange={(notes) => actions.update('contacts', id, { notes }, true)}
          />
          <Comments type="contact" id={id} title="Historie" placeholder="Zapsat hovor, schůzku, domluvu…" />
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              if (window.confirm(`Smazat kontakt „${contact.name || 'Bez jména'}“? Zakázky zůstanou, jen se od něj odpojí.`)) {
                actions.remove('contacts', id);
                location.hash = '#/crm';
              }
            }}
          >
            Smazat kontakt
          </button>
        </div>
        <aside className="detail-side">
          <section>
            <h2 className="group-title">Zakázky <span className="count">{jobs.length}</span></h2>
            {jobs.length === 0 && <p className="empty-note">Zatím žádná.</p>}
            {jobs.map((job) => (
              <a className="dash-row" href={pageHref(job.id)} key={job.id}>
                <span className="dash-row-title">{job.title || 'Bez názvu'}</span>
                <span className="dash-row-meta">{JOB_STAGES.find((s) => s.id === job.stage)?.label}</span>
              </a>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}
