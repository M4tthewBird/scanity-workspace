import { useEffect, useState } from 'react';

export type Route = { name: 'overview' } | { name: 'my' } | { name: 'page'; id: string };

function parseRoute(hash: string): Route {
  const page = hash.match(/^#\/page\/([\w-]+)/);
  if (page) return { name: 'page', id: page[1] };
  if (hash.startsWith('#/my')) return { name: 'my' };
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
