import { groupOf, useProjectGroups } from '../lib/projectGroups';
import { pageHref } from '../lib/useRoute';
import type { Page } from '../lib/types';
import { useWorkspace } from '../lib/useWorkspace';
import { EditableText } from './EditableText';
import { Icon } from './Icon';
import { StatePill } from './ProjectTile';

// Stejné ovládání pro produkt i zakázku: stav, status, skupina na Přehledu, připnutí a kopie.
export function ProjectPanel({ page }: { page: Page }) {
  const { actions } = useWorkspace();
  const { options, move, duplicate, normalize } = useProjectGroups();
  const group = normalize(groupOf(page));

  return (
    <div className="project-panel">
      <div className="project-panel-row">
        <StatePill page={page} />
        <label className="inline-field">
          Skupina
          <select value={group} onChange={(e) => move(page.id, e.target.value)}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={Boolean(page.pinned)}
            onChange={(e) => actions.update('pages', page.id, { pinned: e.target.checked })}
          />
          Na Přehledu
        </label>
        <button
          type="button"
          className="btn-quiet"
          onClick={() => (location.hash = pageHref(duplicate(page.id, group)))}
        >
          <Icon name="copy" size={16} /> Duplikovat
        </button>
      </div>
      <EditableText
        className="project-panel-status"
        placeholder="Status: jak to teď vypadá…"
        aria-label="Status projektu"
        multiline
        table="pages"
        rowId={page.id}
        value={page.status ?? ''}
        onValueChange={(status) => actions.update('pages', page.id, { status }, true)}
      />
    </div>
  );
}
