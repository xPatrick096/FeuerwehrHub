import { writable } from 'svelte/store';

export const userStore    = writable(null);   // aktuell eingeloggter User
export const modulesStore = writable({});     // aktive Module { lager: true, … }
export const ffNameStore  = writable('FeuerwehrHub');
