import { createClient } from '@supabase/supabase-js';

const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

// Klient potřebuje jen doménu: Supabase v dashboardu ukazuje i adresu s /rest/v1/, se kterou by přihlášení vracelo 404.
// Neplatná URL by createClient shodila při startu a zůstala by bílá stránka, proto ji vracíme jako null.
function parseOrigin(value: string | undefined): string | null {
  try {
    const parsed = new URL(value?.trim() ?? '');
    return /^https?:$/.test(parsed.protocol) ? parsed.origin : null;
  } catch {
    return null;
  }
}

const url = parseOrigin(import.meta.env.VITE_SUPABASE_URL as string | undefined);

export const isConfigured = Boolean(url && anonKey);

// Klient si hash z odkazu v e-mailu po přečtení smaže, proto ho čteme před jeho vytvořením.
const initialHash = typeof location === 'undefined' ? '' : location.hash;

export const authLink = {
  needsPassword: /[#&]type=(invite|recovery)/.test(initialHash),
  failed: /[#&]error_code=/.test(initialHash),
};

export const supabase = createClient(url ?? 'http://localhost', anonKey || 'missing', {
  auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true },
});
