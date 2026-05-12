// Génère docs/06-cartographie-fonctionnelle.docx à partir du même contenu
// que docs/06-cartographie-fonctionnelle.md (source de vérité textuelle).
// Usage : npm run docx:cartography

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  PageBreak,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUTPUT = join(ROOT, "docs", "06-cartographie-fonctionnelle.docx");

// === Constantes layout ===
const FONT = "Arial";
const MONO = "Consolas";
const A4_WIDTH = 11906;
const MARGINS = 1440; // 1 inch
const CONTENT_WIDTH = A4_WIDTH - MARGINS * 2; // 9026

const COLORS = {
  primary: "1F4E79",   // bleu Aspha
  primaryLight: "D9E2F3",
  text: "1F1F1F",
  muted: "595959",
  green: "548135",
  greenBg: "E2EFD9",
  red: "9C2227",
  redBg: "FBE5E5",
  amber: "BF6900",
  amberBg: "FCE9D2",
  blue: "1F4E79",
  blueBg: "DEEAF6",
  border: "BFBFBF",
};

// === Helpers ===
const border = { style: BorderStyle.SINGLE, size: 4, color: COLORS.border };
const allBorders = { top: border, bottom: border, left: border, right: border };
const cellMargin = { top: 80, bottom: 80, left: 120, right: 120 };

const text = (str, opts = {}) =>
  new TextRun({ text: str, font: opts.font ?? FONT, size: opts.size ?? 22, bold: opts.bold, italics: opts.italics, color: opts.color ?? COLORS.text });

const para = (children, opts = {}) =>
  new Paragraph({
    children: Array.isArray(children) ? children : [children],
    spacing: { before: opts.before ?? 0, after: opts.after ?? 80 },
    alignment: opts.alignment,
    pageBreakBefore: opts.pageBreakBefore,
    style: opts.style,
  });

const p = (str, opts = {}) => para(text(str, opts), opts);

const h1 = (str, opts = {}) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    pageBreakBefore: opts.pageBreakBefore,
    children: [text(str, { size: 36, bold: true, color: COLORS.primary })],
  });

const h2 = (str) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [text(str, { size: 28, bold: true, color: COLORS.primary })],
  });

const h3 = (str) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    children: [text(str, { size: 24, bold: true, color: COLORS.text })],
  });

const bullet = (str) =>
  new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 60 },
    children: [text(str)],
  });

const monoLines = (lines) =>
  lines.map((line) =>
    new Paragraph({
      spacing: { after: 20 },
      shading: { fill: "F4F4F4", type: ShadingType.CLEAR },
      children: [text(line, { font: MONO, size: 20 })],
    })
  );

// Construit une cellule
function tc({ content, widthDxa, fill, bold, mono, alignment, color, size, span }) {
  let runs;
  if (Array.isArray(content)) {
    runs = content;
  } else {
    runs = [text(String(content ?? ""), { bold, font: mono ? MONO : FONT, color, size })];
  }
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: allBorders,
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    margins: cellMargin,
    columnSpan: span,
    children: [new Paragraph({ alignment, children: runs })],
  });
}

// Décision pictogramme + couleur
function decisionCell(value, widthDxa) {
  const map = {
    "✅": { label: "✅ Garder", fill: COLORS.greenBg },
    "🔀": { label: "🔀 Fusionner", fill: COLORS.blueBg },
    "❌": { label: "❌ Supprimer", fill: COLORS.redBg },
    "❓": { label: "❓ À clarifier", fill: COLORS.amberBg },
    "⏸": { label: "⏸ En attente", fill: COLORS.amberBg },
  };
  const m = map[value] ?? { label: value, fill: undefined };
  return tc({ content: m.label, widthDxa, fill: m.fill, bold: true, alignment: AlignmentType.CENTER, size: 20 });
}

// Construit une table d'audit (3 colonnes)
function auditTable(rows) {
  const widths = [3200, 2000, 3826]; // = 9026
  const header = new TableRow({
    tableHeader: true,
    children: [
      tc({ content: "Entrée Ximi", widthDxa: widths[0], fill: COLORS.primary, bold: true, color: "FFFFFF" }),
      tc({ content: "Décision", widthDxa: widths[1], fill: COLORS.primary, bold: true, color: "FFFFFF", alignment: AlignmentType.CENTER }),
      tc({ content: "Notes", widthDxa: widths[2], fill: COLORS.primary, bold: true, color: "FFFFFF" }),
    ],
  });
  const body = rows.map(([entry, decision, notes]) =>
    new TableRow({
      children: [
        tc({ content: entry, widthDxa: widths[0], size: 20 }),
        decisionCell(decision, widths[1]),
        tc({ content: notes ?? "", widthDxa: widths[2], size: 20, color: COLORS.muted }),
      ],
    })
  );
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [header, ...body],
  });
}

// Table générique 2 colonnes
function twoColTable(headers, rows, widths = [4513, 4513]) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => tc({ content: h, widthDxa: widths[i], fill: COLORS.primary, bold: true, color: "FFFFFF" })),
  });
  const bodyRows = rows.map((row) =>
    new TableRow({
      children: row.map((cell, i) => tc({ content: cell, widthDxa: widths[i], size: 20 })),
    })
  );
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...bodyRows],
  });
}

// Table 3 colonnes Question
function questionsTable(rows) {
  const widths = [800, 3300, 4926];
  const header = new TableRow({
    tableHeader: true,
    children: [
      tc({ content: "#", widthDxa: widths[0], fill: COLORS.primary, bold: true, color: "FFFFFF", alignment: AlignmentType.CENTER }),
      tc({ content: "Sujet", widthDxa: widths[1], fill: COLORS.primary, bold: true, color: "FFFFFF" }),
      tc({ content: "Question", widthDxa: widths[2], fill: COLORS.primary, bold: true, color: "FFFFFF" }),
    ],
  });
  const body = rows.map(([id, subject, question]) =>
    new TableRow({
      children: [
        tc({ content: id, widthDxa: widths[0], bold: true, alignment: AlignmentType.CENTER, size: 20 }),
        tc({ content: subject, widthDxa: widths[1], size: 20 }),
        tc({ content: question, widthDxa: widths[2], size: 20, color: COLORS.muted }),
      ],
    })
  );
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [header, ...body],
  });
}

// Légende des décisions
function legendTable() {
  const widths = [1600, 7426];
  const rows = [
    ["✅", "Garder en l'état dans Aspha CRM"],
    ["🔀", "Garder mais fusionner avec une autre entrée (onglet, vue détail, sous-section)"],
    ["❌", "Supprimer — hors périmètre Aspha"],
    ["❓", "À clarifier avec la cliente avant arbitrage"],
    ["⏸", "En attente d'arbitrage cliente"],
  ];
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map(([picto, desc]) =>
      new TableRow({
        children: [
          tc({ content: picto, widthDxa: widths[0], bold: true, alignment: AlignmentType.CENTER, size: 24 }),
          tc({ content: desc, widthDxa: widths[1], size: 20 }),
        ],
      })
    ),
  });
}

// Mini-paragraphe d'espacement
const space = (after = 120) => new Paragraph({ spacing: { after }, children: [text("")] });

// === Page de garde ===
const cover = [
  new Paragraph({
    spacing: { before: 2400, after: 200 },
    alignment: AlignmentType.CENTER,
    children: [text("ASPHA CRM", { size: 28, bold: true, color: COLORS.muted })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [text("Cartographie fonctionnelle", { size: 56, bold: true, color: COLORS.primary })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 1200 },
    children: [text("Audit du menu Ximi (Xelya) → décisions Aspha CRM", { size: 26, italics: true, color: COLORS.muted })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [text("Maître d'œuvre :  ", { size: 22, color: COLORS.muted }), text("BI Développement", { size: 22, bold: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [text("Développeur référent :  ", { size: 22, color: COLORS.muted }), text("Téo Debay", { size: 22, bold: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [text("Version :  ", { size: 22, color: COLORS.muted }), text("v0.1 — document de travail", { size: 22, bold: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [text("Date :  ", { size: 22, color: COLORS.muted }), text("30 avril 2026", { size: 22, bold: true })],
  }),
];

// === Méthodologie ===
const methodology = [
  h1("1. Méthodologie", { pageBreakBefore: true }),
  p("Pour chaque entrée du menu Ximi, on prend une décision parmi les cinq statuts ci-dessous. Le menu cible Aspha à la fin de chaque section liste ce qui sera développé."),
  space(),
  legendTable(),
];

// === Section CLIENTS ===
const clients = [
  h1("2. CLIENTS", { pageBreakBefore: true }),
  p("Élargissement Aspha : les clients peuvent désormais être des entreprises (pas uniquement des particuliers comme historiquement chez Aspha).", { italics: true, color: COLORS.muted }),
  h2("Audit Ximi"),
  auditTable([
    ["Clients", "✅", "Élargi : type ∈ {individual, company}"],
    ["Missions", "❌", "Terminologie Ximi non reprise par Aspha"],
    ["Prestations", "✅", "Catalogue de services attribuables aux clients"],
    ["Prises en charge", "❌", "Concept paramédical (CPAM, mutuelle) hors périmètre"],
    ["Modalités de Prises en charge", "❌", "Idem"],
    ["Mandats SEPA", "❌", "Sera géré dans Pennylane (comptabilité externe)"],
    ["Enfants", "❌", "Concept Ximi non applicable"],
    ["Absences client", "🔀", "Fusion avec « Absences client périodiques » sous une seule entrée avec deux onglets"],
    ["Absences client périodiques", "🔀", "Idem"],
    ["Mesures de protection", "❌", "Tutelle/curatelle — hors périmètre"],
    ["Clés", "🔀", "Fusion avec « Mouvements de clés » : la fiche clé contient l'onglet « Historique des mouvements »"],
    ["Mouvements de clés", "🔀", "Idem"],
    ["Tiers-payeurs", "❌", "Pas de tiers-payeur chez Aspha"],
    ["Heures de régularisation", "❌", "Sera géré dans la facturation"],
  ]),
  h2("Menu cible Aspha"),
  ...monoLines([
    "CLIENTS",
    "├── Clients              (particuliers + entreprises)",
    "├── Prestations          (catalogue de services)",
    "├── Clés                 (avec onglet « Historique des mouvements »)",
    "└── Absences client      (avec onglets « Ponctuelles » / « Périodiques »)",
  ]),
];

// === Section RH ===
const rh = [
  h1("3. RH", { pageBreakBefore: true }),
  h2("Audit Ximi"),
  auditTable([
    ["Intervenants", "✅", "= salariés Aspha (terme « intervenant » conservé pour cohérence métier)"],
    ["Formations", "✅", "Conservé — sera utilisé en phase ultérieure (validation cliente)"],
    ["Absences intervenant", "🔀", "Fusion avec « Détails d'absences intervenant » : une seule vue avec liste + détail au clic"],
    ["Détails d'absences intervenant", "🔀", "Idem"],
    ["Diplômes intervenant", "❌", "Hors périmètre (peut-être à reprendre dans Formations plus tard)"],
    ["Complémentaires santé", "❌", "Géré par la paie (Silae)"],
    ["Temps partiels thérapeutiques", "❌", "Géré par la paie (Silae)"],
    ["Indemnités journalières", "❌", "Géré par la paie (Silae)"],
    ["Saisies sur salaire", "✅", "Conservé"],
  ]),
  h2("Menu cible Aspha"),
  ...monoLines([
    "RH",
    "├── Intervenants",
    "├── Formations              (alimentation progressive — phase ultérieure)",
    "├── Absences intervenant    (vue unique avec détail)",
    "└── Saisies sur salaire",
  ]),
];

// === Section PLANIFICATION ===
const planif = [
  h1("4. PLANIFICATION", { pageBreakBefore: true }),
  p("Tout est conservé — c'est le cœur métier d'Aspha, le module Ximi à reproduire fidèlement.", { italics: true, color: COLORS.muted }),
  h2("Audit Ximi"),
  auditTable([
    ["Planning", "✅", "Vue calendrier principale (timeGrid + drag-and-drop)"],
    ["Interventions", "✅", "Liste tabulaire des appointments (ponctuelles)"],
    ["Interventions périodiques", "✅", "Liste des service_assignments récurrents"],
    ["Historique intervenants", "✅", "Vue passée du planning par intervenant"],
    ["Dispos / Indispos", "✅", "Disponibilités/indisponibilités ponctuelles"],
    ["Dispos / Indispos périodiques", "✅", "Récurrentes"],
    ["Événements intervenant", "✅", "Évènements spécifiques (formation, RDV médical, etc.)"],
    ["Événements intervenant périodiques", "✅", "Récurrents"],
    ["Carte", "✅", "Cartographie clients + intervenants (Leaflet + Google Distance Matrix)"],
  ]),
  h2("Menu cible Aspha"),
  ...monoLines([
    "PLANIFICATION",
    "├── Planning                              (vue calendrier — cœur du CRM)",
    "├── Interventions                         (ponctuelles)",
    "├── Interventions périodiques             (récurrentes)",
    "├── Historique intervenants",
    "├── Dispos / Indispos",
    "├── Dispos / Indispos périodiques",
    "├── Événements intervenant",
    "├── Événements intervenant périodiques",
    "└── Carte",
  ]),
  space(),
  p("Note technique : « Interventions », « Interventions périodiques », « Dispos », « Événements » et leurs variantes périodiques peuvent partager une logique commune via l'entité service_assignment étendue + types d'évènement (intervention / dispo / événement).", { italics: true, color: COLORS.muted }),
];

// === Section TÉLÉGESTION ===
const telegestion = [
  h1("5. TÉLÉGESTION", { pageBreakBefore: true }),
  p("Tout conservé pour l'instant — pas encore tous les détails fonctionnels côté cliente. Recap à venir.", { italics: true, color: COLORS.muted }),
  h2("Audit Ximi"),
  auditTable([
    ["Télégestion", "✅", "Module global de pointage QR (= QR scans dans notre BDD)"],
    ["Messagerie", "✅", "Échanges intervenant ↔ administration"],
    ["Messages de Télégestion", "✅", "Messages liés au pointage spécifiquement"],
    ["Codes de Télégestion", "✅", "Référentiel des codes/QR codes (= notre table qr_codes)"],
    ["Connexions mobiles", "✅", "Suivi des sessions mobiles intervenants"],
  ]),
  h2("Menu cible Aspha"),
  ...monoLines([
    "TÉLÉGESTION",
    "├── Télégestion              (vue principale — historique badgeages)",
    "├── Messagerie               (chat/notifications)",
    "├── Messages de Télégestion  (messages liés à un badgeage)",
    "├── Codes de Télégestion     (= QR codes par adresse)",
    "└── Connexions mobiles       (sessions actives intervenants)",
  ]),
  space(),
  p("À clarifier avec la cliente : différence exacte entre « Messagerie » (général) et « Messages de Télégestion » (lié au pointage), pour valider qu'il faut bien deux modules distincts ou si on peut fusionner.", { italics: true, color: COLORS.amber }),
];

// === Section VENTES ===
const ventes = [
  h1("6. VENTES", { pageBreakBefore: true }),
  p("Principe : on fusionne les « articles » dans la fiche parente (Devis/Facture) — un devis affiche directement ses lignes dans la même page (pas une entrée de menu séparée). On regroupe les encaissements liés (Règlements / SEPA / Bordereaux) sous une seule rubrique.", { italics: true, color: COLORS.muted }),
  h2("Audit Ximi"),
  auditTable([
    ["Devis", "✅", ""],
    ["Articles de devis", "🔀", "Affichés inline dans la page d'un devis (lignes du devis)"],
    ["Factures", "✅", ""],
    ["Articles de facture", "🔀", "Affichés inline dans la page d'une facture"],
    ["Règlements", "🔀", "Regroupés dans « Encaissements »"],
    ["Prélèvements SEPA", "🔀", "Regroupés dans « Encaissements »"],
    ["Ventilations", "❓", "À clarifier : ventilation comptable analytique ? Si oui, probablement à externaliser dans Pennylane"],
    ["Bordereaux", "🔀", "Regroupés dans « Encaissements » (bordereaux de remise)"],
  ]),
  h2("Menu cible Aspha"),
  ...monoLines([
    "VENTES",
    "├── Devis                       (fiche complète avec lignes inline)",
    "├── Factures                    (fiche complète avec lignes inline)",
    "└── Encaissements",
    "     ├── Règlements              (paiements reçus)",
    "     ├── Prélèvements SEPA       (mandats + opérations)",
    "     └── Bordereaux              (remise de chèques / espèces)",
  ]),
  space(),
  p("À clarifier — Ventilations : trois interprétations possibles. (1) Ventilation comptable (répartition par compte/centre de coût) → externaliser dans Pennylane. (2) Ventilation des règlements (un règlement applicable à plusieurs factures) → garder, sous Encaissements. (3) Autre → demander à la cliente.", { italics: true, color: COLORS.amber }),
];

// === Sections en attente cliente ===
const pending = [
  h1("7. Sections en attente d'arbitrage cliente", { pageBreakBefore: true }),
  p("Ces 4 sections Ximi nécessitent une discussion préalable avec la cliente avant de prendre les décisions de cartographie. Elles seront documentées dans une prochaine version de ce fichier après le prochain rendez-vous."),
  space(),
  twoColTable(
    ["Section Ximi", "À aborder lors du prochain rendez-vous"],
    [
      ["ÉTATS / DÉCLARATIONS", "Quels états/déclarations sont réellement utilisés ? Lesquels remplacés par Pennylane / Silae ?"],
      ["CORRESPONDANCE", "Périmètre : courriers types ? mailing ? historique d'envoi ?"],
      ["ORGANISATION", "Paramétrage agence (sites, équipes, droits) — déjà partiellement couvert par notre module Rôles"],
      ["RAPPORTS", "Quels rapports sont vraiment exploités au quotidien ? Format (PDF/Excel) ? Fréquence ?"],
    ],
    [3500, 5526]
  ),
];

// === Synthèse ===
const synthese = [
  h1("8. Synthèse — Menu Aspha CRM cible (parties auditées)", { pageBreakBefore: true }),
  ...monoLines([
    "┌── CLIENTS",
    "│    ├── Clients",
    "│    ├── Prestations",
    "│    ├── Clés",
    "│    └── Absences client",
    "│",
    "├── RH",
    "│    ├── Intervenants",
    "│    ├── Formations",
    "│    ├── Absences intervenant",
    "│    └── Saisies sur salaire",
    "│",
    "├── PLANIFICATION",
    "│    ├── Planning",
    "│    ├── Interventions",
    "│    ├── Interventions périodiques",
    "│    ├── Historique intervenants",
    "│    ├── Dispos / Indispos",
    "│    ├── Dispos / Indispos périodiques",
    "│    ├── Événements intervenant",
    "│    ├── Événements intervenant périodiques",
    "│    └── Carte",
    "│",
    "├── TÉLÉGESTION",
    "│    ├── Télégestion",
    "│    ├── Messagerie",
    "│    ├── Messages de Télégestion",
    "│    ├── Codes de Télégestion",
    "│    └── Connexions mobiles",
    "│",
    "└── VENTES",
    "     ├── Devis",
    "     ├── Factures",
    "     └── Encaissements",
    "          ├── Règlements",
    "          ├── Prélèvements SEPA",
    "          └── Bordereaux",
  ]),
  space(),
  p("Volumétrie : 5 sections, 21 entrées de menu (vs 51 dans Ximi pour ces mêmes 5 sections → réduction d'environ 60 %).", { bold: true }),
];

// === Questions ===
const questions = [
  h1("9. Points à clarifier avec la cliente", { pageBreakBefore: true }),
  questionsTable([
    ["Q1", "TÉLÉGESTION — Messagerie vs Messages de Télégestion", "Différence exacte ? Faut-il deux modules ou un seul ?"],
    ["Q2", "VENTES — Ventilations", "À quoi sert cette entrée précisément ? Comptable ou applicative ?"],
    ["Q3", "RH — Diplômes intervenant", "Vraiment hors périmètre ou à intégrer dans Formations en phase 2 ?"],
    ["Q4", "CLIENTS — Heures de régularisation", "Confirmer que le besoin est couvert par la facturation (ajustements)"],
    ["Q5", "RH — Saisies sur salaire", "Suivi détaillé dans le CRM ou simple champ libre dans la fiche intervenant ?"],
    ["Q6", "ÉTATS / DÉCLARATIONS", "Lister les états/déclarations réellement utilisés au quotidien"],
    ["Q7", "CORRESPONDANCE", "Périmètre attendu : modèles de courriers ? envoi mail ? historique ?"],
    ["Q8", "ORGANISATION", "Détailler le besoin de paramétrage agence (sites, équipes, droits) au-delà du module Rôles"],
    ["Q9", "RAPPORTS", "Lister les rapports indispensables et leur format/fréquence cible"],
  ]),
];

// === Historique ===
const historique = [
  h1("10. Historique des décisions", { pageBreakBefore: true }),
  twoColTable(
    ["Date", "Décisions"],
    [
      ["2026-04-30", "Premier passage : 5 sections (CLIENTS, RH, PLANIFICATION, TÉLÉGESTION, VENTES) — Téo Debay"],
      ["2026-04-30", "Sections ÉTATS/DÉCLARATIONS, CORRESPONDANCE, ORGANISATION, RAPPORTS marquées en attente d'arbitrage cliente — Téo Debay"],
    ],
    [1800, 7226]
  ),
];

// === Document complet ===
const doc = new Document({
  creator: "Téo Debay — BI Développement",
  title: "Cartographie fonctionnelle Aspha CRM",
  description: "Audit menu Ximi → décisions Aspha CRM",
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 36, bold: true, font: FONT, color: COLORS.primary },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 28, bold: true, font: FONT, color: COLORS.primary },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 24, bold: true, font: FONT },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: A4_WIDTH, height: 16838 },
          margin: { top: MARGINS, right: MARGINS, bottom: MARGINS, left: MARGINS },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                text("Aspha CRM — Cartographie fonctionnelle  ·  Page ", { size: 18, color: COLORS.muted }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, color: COLORS.muted, font: FONT }),
                text(" / ", { size: 18, color: COLORS.muted }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: COLORS.muted, font: FONT }),
              ],
            }),
          ],
        }),
      },
      children: [
        ...cover,
        ...methodology,
        ...clients,
        ...rh,
        ...planif,
        ...telegestion,
        ...ventes,
        ...pending,
        ...synthese,
        ...questions,
        ...historique,
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync(OUTPUT, buffer);
console.log(`OK — généré : ${OUTPUT}`);
console.log(`Taille : ${(buffer.length / 1024).toFixed(1)} ko`);
