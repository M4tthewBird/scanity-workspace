import { createClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

// Neplatná URL by createClient shodila při startu a zůstala by bílá stránka.
const hasValidUrl = /^https?:\/\/\S+$/.test(url ?? '');

export const isConfigured = hasValidUrl && Boolean(anonKey);

// Klient si hash z odkazu v e-mailu po přečtení smaže, proto ho čteme před jeho vytvořením.
const initialHash = typeof location === 'undefined' ? '' : location.hash;

export const authLink = {
  needsPassword: /[#&]type=(invite|recovery)/.test(initialHash),
  failed: /[#&]error_code=/.test(initialHash),
};

export const supabase = createClient(hasValidUrl ? url! : 'http://localhost', anonKey || 'missing', {
  auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true },
});
