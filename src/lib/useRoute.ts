import { useEffect, useState } from 'react';

export type Route =
  | { name: 'overview' }
  | { name: 'dev' }
  | { name: 'ideas' }
  | { name: 'tasks' }
  | { name: 'roadmap' }
  | { name: 'industries' }
  | { name: 'jobs' }
  | { name: 'crm' }
  | { name: 'company'; id: string }
  | { name: 'contact'; id: string }
  | { name: 'stats' }
  | { name: 'page'; id: string }
  | { name: 'meeting'; id: string };

export const meetingHref = (id: string) => `#/meeting/${id}`;

function parseRoute(hash: string): Route {
  const meeting = hash.match(/^#\/meeting\/([\w-]+)/);
  if (meeting) return { name: 'meeting', id: meeting[1] };
  const page = hash.match(/^#\/page\/([\w-]+)/);
  if (page) return { name: 'page', id: page[1] };
  const company = hash.match(/^#\/crm\/company\/([\w-]+)/);
  if (company) return { name: 'company', id: company[1] };
  const contact = hash.match(/^#\/crm\/contact\/([\w-]+)/);
  if (contact) return { name: 'contact', id: contact[1] };
  if (hash.startsWith('#/dev/ideas')) return { name: 'ideas' };
  if (hash.startsWith('#/dev/tasks')) return { name: 'tasks' };
  if (hash.startsWith('#/dev/roadmap')) return { name: 'roadmap' };
  if (hash.startsWith('#/dev')) return { name: 'dev' };
  if (hash.startsWith('#/industries')) return { name: 'industries' };
  if (hash.startsWith('#/jobs')) return { name: 'jobs' };
  if (hash.startsWith('#/crm')) return { name: 'crm' };
  if (hash.startsWith('#/stats')) return { name: 'stats' };
  return { name: 'overview' };
}

export function pageHref(id: string): string {
  return `#/page/${id}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
