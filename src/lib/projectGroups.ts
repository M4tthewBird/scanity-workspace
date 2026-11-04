import { between, byPosition } from './order';
import type { Page } from './types';
import { useWorkspace } from './useWorkspace';

// Skupina na Přehledu: Scanity (produkty), obor (odvětví zakázky), nebo bez oboru.
export const SCANITY = 'scanity';
export const NO_GROUP = 'none';

export const groupOf = (page: Page): string =>
  page.kind === 'product' ? SCANITY : page.industry_id ?? NO_GROUP;

export function useProjectGroups() {
  const { pages, actions } = useWorkspace();
  const industries = byPosition(pages.filter((p) => p.kind === 'industry'));
  const known = new Set(industries.map((i) => i.id));
  const normalize = (group: string) => (group === SCANITY || known.has(group) ? group : NO_GROUP);

  const pinnedIn = (group: string, exceptId?: string) =>
    byPosition(
      pages.filter(
        (p) =>
          p.pinned &&
          p.state !== 'done' &&
          (p.kind === 'job' || p.kind === 'product') &&
          p.id !== exceptId &&
          normalize(groupOf(p)) === group,
      ),
    );

  const options = [
    { id: SCANITY, label: 'Scanity' },
    ...industries.map((i) => ({ id: i.id, label: i.title || 'Bez názvu' })),
    { id: NO_GROUP, label: 'Bez oboru' },
  ];

  // Pozice před/za dlaždicí overId, nebo na konec skupiny.
  const positionIn = (group: string, exceptId: string, overId: string | null, before: boolean) => {
    const items = pinnedIn(group, exceptId);
    const overIndex = overId ? items.findIndex((p) => p.id === overId) : -1;
    const index = overIndex < 0 ? items.length : before ? overIndex : overIndex + 1;
    return between(items[index - 1]?.position, items[index]?.position);
  };

  const groupPatch = (group: string): Partial<Page> =>
    group === SCANITY ? { kind: 'product' } : { kind: 'job', industry_id: group === NO_GROUP ? null : group };

  const move = (pageId: string, group: string, overId: string | null = null, before = false) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    const position = positionIn(group, pageId, overId, before);
    const { industry_id, ...patch } = groupPatch(group);
    // Přesun z archivu na Přehled projekt zase otevře.
    const reopen = page.state === 'done' ? { state: 'active' as const } : {};
    actions.update('pages', pageId, { ...patch, ...reopen, pinned: true, position });
    // Obor zakázky jde přes setJobIndustry, aby se propsal i ke klientovi v CRM.
    if (group !== SCANITY && page.industry_id !== industry_id) actions.setJobIndustry(pageId, industry_id ?? null);
  };

  const duplicate = (pageId: string, group: string, overId: string | null = null, before = false): string => {
    const page = pages.find((p) => p.id === pageId);
    const reopen = page?.state === 'done' ? { state: 'active' as const } : {};
    return actions.duplicatePage(pageId, { ...groupPatch(group), ...reopen, pinned: true, position: positionIn(group, pageId, overId, before) });
  };

  return { industries, options, pinnedIn, normalize, move, duplicate };
}
