import { createIcons, icons } from 'lucide';

/**
 * Gibt einen Lucide-Icon-Platzhalter zurück, der via renderIcons() ersetzt wird.
 * Verwendung in Template Literals: ${icon('truck')}
 */
export function icon(name, size = 16, cls = '') {
  return `<i data-lucide="${name}" class="icon${cls ? ' ' + cls : ''}" style="width:${size}px;height:${size}px"></i>`;
}

/**
 * Ersetzt alle data-lucide Attribute im Dokument durch echte SVGs.
 * Muss nach jedem innerHTML-Update aufgerufen werden.
 */
export function renderIcons(container = document.body) {
  createIcons({
    icons,
    attrs: { 'stroke-width': 1.75 },
    nameAttr: 'data-lucide',
    rootNode: container,
  });
}
