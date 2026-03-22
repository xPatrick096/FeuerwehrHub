import { PDFDocument, PDFName } from 'pdf-lib';

/**
 * Generiert den Beschaffungsauftrag als PDF und öffnet ihn im neuen Tab.
 * Das Original-PDF wird als Template verwendet — Ausgabe ist identisch mit dem Original.
 */
export async function generateBeschaffungsauftrag(order) {
  // PDF-Template laden
  const pdfBytes = await fetch('/Beschaffungsauftrag.pdf').then(r => r.arrayBuffer());
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();

  // ── Hilfsfunktion: Feld befüllen (mit Fehlertoleranz) ────────────────────
  const fill = (name, value) => {
    try {
      form.getTextField(name).setText(value || '');
    } catch (_) {}
  };

  // ── Datum formatieren ────────────────────────────────────────────────────
  const formatDate = (dateStr) => {
    if (!dateStr) return new Date().toLocaleDateString('de-DE');
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE');
  };

  // ── Felder befüllen ──────────────────────────────────────────────────────

  // Bedarfsmelder + Kontakt
  fill('Name',         order.ordered_by_name || '');
  fill('Telefon',      order.telefon || '');
  fill('Datumsfeld 1', formatDate(order.order_date));

  // Lieferanschrift
  fill('Anschrift',    order.lieferanschrift || '');

  // Erste Positionszeile: Bestelldaten
  fill('Anzahl',      String(order.quantity));
  fill('Einheit',     order.unit || '');
  fill('Gegenstand',  order.article_name || '');
  // Menge 1–5 leer lassen (nur erste Zeile befüllt)

  // Begründung
  fill('Begründung',  order.begruendung || '');

  // Händler / Anbieter (bis zu 3)
  fill('Händler 1',   order.haendler_1 || '');
  fill('Händler 2',   order.haendler_2 || '');
  fill('Händler 3',   order.haendler_3 || '');

  // ── Buttons "Eingaben löschen" + "Drucken" entfernen ────────────────────
  ['cmdRueck', 'cmdDruck'].forEach(name => {
    try {
      const field = form.getButton(name);
      field.acroField.getWidgets().forEach(widget => {
        // Rect auf [0,0,0,0] setzen → unsichtbar
        const ctx = widget.dict.context;
        widget.dict.set(PDFName.of('Rect'), ctx.obj([0, 0, 0, 0]));
      });
    } catch (_) {}
  });

  // ── Formular einfrieren (nicht mehr editierbar) ──────────────────────────
  form.flatten();

  // ── PDF speichern + im neuen Tab öffnen ──────────────────────────────────
  const outBytes = await pdfDoc.save();
  const blob = new Blob([outBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
