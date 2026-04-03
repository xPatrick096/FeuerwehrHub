import { writable } from 'svelte/store';

// Aktive Seite, z.B. 'home', 'orders', 'incidents'
export const currentPageStore = writable('');
