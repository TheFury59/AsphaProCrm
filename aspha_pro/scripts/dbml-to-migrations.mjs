#!/usr/bin/env node
/**
 * Parse crm_ximi_schema_final.dbml → génère les migrations Laravel
 * dans aspha_pro/backend/database/migrations/.
 *
 * Usage : node scripts/dbml-to-migrations.mjs [--clean]
 *
 * --clean : supprime d'abord toutes les migrations existantes sauf
 *           les migrations Laravel par défaut (users, cache, jobs) et
 *           celles de Spatie (permission, activitylog, media).
 *
 * Tables SKIP (gérées ailleurs) :
 *   - roles, permissions, role_permission, users (Phase 0 + Spatie)
 */

import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PROJECT_ROOT = join(ROOT, "..");
const DBML_PATH = join(PROJECT_ROOT, "crm_ximi_schema_final.dbml");
const MIGRATIONS_DIR = join(ROOT, "backend", "database", "migrations");

// === Configuration ===

// Tables à ignorer (gérées par Spatie ou Phase 0)
const SKIP_TABLES = new Set([
  "roles", "permissions", "role_permission", "users",
]);

// Ordre topologique des tables (respect des FK)
const ORDER = [
  // 1. Entités (agences) — racine
  "entities", "entity_zones",
  // 2. Adresses (polymorphique)
  "addresses",
  // 3. Référentiels indépendants
  "skills", "job_references", "vat_rates", "product_categories",
  "client_absence_reasons", "absence_reasons", "surcharge_rules",
  "km_indemnity_rates", "third_party_payers", "suppliers",
  "bank_accounts", "creditor_contacts", "stock_categories",
  "client_event_types", "employee_event_types", "notification_types",
  // 4. Clients
  "clients", "client_companies", "billing_contacts",
  "client_contacts", "related_contacts",
  // 5. Employees
  "employees", "employee_skills",
  // 6. Contrats RH (utilise addresses)
  "contracts", "contract_blocked_slots", "contract_surcharge_overrides",
  // 7. Absences & formations
  "client_absences", "employee_absences", "trainings",
  // 8. Saisies sur salaire
  "salary_deductions", "salary_deduction_debts", "deduction_payments",
  // 9. Produits (catalogue)
  "products", "product_price_tiers",
  // 10. Devis
  "quote_types", "quotes", "quote_surcharge_rules",
  // 11. Missions + prestations
  "missions", "client_prestations",
  // 12. Planning (interventions + satellites)
  "interventions", "recurrence_assignments", "matching_requests",
  "client_employee_history",
  // 13. Événements
  "client_events", "client_event_recurrences",
  "employee_events", "employee_event_recurrences",
  // 14. Télégestion (QR + checkins)
  "qr_codes", "checkins", "telemanagement_logs",
  // 15. SEPA
  "entity_bank_accounts", "entity_sepa_config",
  "sepa_mandates", "sepa_orders",
  // 16. Cycles facturation + factures + règlements
  "billing_cycles", "invoices", "invoice_items",
  "reglements", "reglement_invoice_lines",
  // 17. Messagerie
  "message_threads", "message_thread_participants", "messages",
  // 18. Clés
  "keys", "key_movements",
  // 19. Documents (polymorphique)
  "documents",
  // 20. Portail client
  "client_requests", "consumable_reorders",
  "electronic_signatures", "quality_controls",
  // 21. Stock
  "stock_products", "stock_inventories", "stock_inventory_lines",
  "stock_movements",
  // 22. Notifications (préférences + générées)
  "notification_preferences", "notifications",
];

// === Parser DBML ===

function parseDbml(src) {
  const tables = new Map();
  const refs = [];

  // Tables : "Table name {\n ... \n}"
  const tableRegex = /Table\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = tableRegex.exec(src)) !== null) {
    const name = m[1];
    const body = m[2];
    tables.set(name, parseTableBody(body));
  }

  // Refs : "Ref: source.field > target.field"
  const refRegex = /^Ref:\s+(\w+)\.(\w+)\s*>\s*(\w+)\.(\w+)/gm;
  while ((m = refRegex.exec(src)) !== null) {
    refs.push({
      sourceTable: m[1],
      sourceField: m[2],
      targetTable: m[3],
      targetField: m[4],
    });
  }

  // Attacher les refs aux colonnes
  for (const ref of refs) {
    const table = tables.get(ref.sourceTable);
    if (!table) continue;
    const col = table.columns.find((c) => c.name === ref.sourceField);
    if (col) {
      col.fk = { table: ref.targetTable, field: ref.targetField };
    }
  }

  return { tables, refs };
}

function parseTableBody(body) {
  const columns = [];
  const indexes = [];
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  let inIndexes = false;
  let indexBuffer = "";

  for (const line of lines) {
    if (line.startsWith("//")) continue;

    if (line.startsWith("indexes")) {
      inIndexes = true;
      indexBuffer = line;
      continue;
    }
    if (inIndexes) {
      indexBuffer += " " + line;
      if (line.includes("}")) {
        // Parse indexes block
        const idxRegex = /\(([^)]+)\)\s*\[([^\]]+)\]/g;
        let im;
        while ((im = idxRegex.exec(indexBuffer)) !== null) {
          const fields = im[1].split(",").map((s) => s.trim());
          const opts = im[2].split(",").map((s) => s.trim());
          indexes.push({ fields, options: opts });
        }
        inIndexes = false;
      }
      continue;
    }

    // Colonne : "name type [options]   // comment"
    const colMatch = line.match(/^(\w+)\s+(\w+(?:\([^)]+\))?)\s*(?:\[([^\]]+)\])?\s*(?:\/\/(.*))?$/);
    if (colMatch) {
      const [, name, typeRaw, optsRaw, comment] = colMatch;
      const opts = optsRaw ? optsRaw.split(",").map((s) => s.trim()) : [];
      columns.push({
        name,
        type: typeRaw,
        options: opts,
        comment: comment ? comment.trim() : null,
      });
    }
  }

  return { columns, indexes };
}

// === Mapping DBML → Laravel migration ===

function isPolymorphicTable(tableName, columns) {
  const hasOwnerType = columns.some((c) => c.name === "owner_type");
  const hasOwnerId = columns.some((c) => c.name === "owner_id");
  return hasOwnerType && hasOwnerId;
}

function emitColumnLine(col, tableName) {
  const opts = col.options || [];
  const isPk = opts.includes("pk");
  const isIncrement = opts.includes("increment");
  const isUnique = opts.includes("unique");

  // PK auto-increment → $table->id()
  if (col.name === "id" && isPk && isIncrement) {
    return `            $table->id();`;
  }

  // FK détectée
  if (col.fk) {
    const onDelete = pickOnDelete(tableName, col);
    const nullable = isNullableFk(tableName, col);
    let stmt = `            $table->foreignId('${col.name}')`;
    if (nullable) stmt += `->nullable()`;
    if (isUnique) stmt += ``;  // unique géré après constrained
    stmt += `->constrained('${col.fk.table}')`;
    if (onDelete === "cascade") stmt += `->cascadeOnDelete()`;
    else if (onDelete === "set null") stmt += `->nullOnDelete()`;
    else stmt += `->restrictOnDelete()`;
    if (isUnique) stmt = stmt.replace("$table->foreignId", "$table->foreignId").replace("->constrained", "->unique()->constrained");
    stmt += `;`;
    if (col.comment) stmt += ` // ${col.comment}`;
    return stmt;
  }

  // Type mapping
  const type = col.type.toLowerCase();
  let stmt = `            $table->`;

  if (type.startsWith("int")) stmt += `unsignedBigInteger('${col.name}')`;
  else if (type.startsWith("tinyint")) stmt += `tinyInteger('${col.name}')`;
  else if (type.startsWith("smallint")) stmt += `smallInteger('${col.name}')`;
  else if (type.startsWith("bigint")) stmt += `bigInteger('${col.name}')`;
  else if (type.startsWith("varchar")) stmt += `string('${col.name}')`;
  else if (type === "text") stmt += `text('${col.name}')`;
  else if (type === "boolean") stmt += `boolean('${col.name}')`;
  else if (type === "datetime") stmt += `dateTime('${col.name}')`;
  else if (type === "timestamp") stmt += `timestamp('${col.name}')`;
  else if (type === "date") stmt += `date('${col.name}')`;
  else if (type === "time") stmt += `time('${col.name}')`;
  else if (type === "decimal") stmt += `decimal('${col.name}', 12, 2)`;
  else if (type === "float") stmt += `float('${col.name}')`;
  else if (type === "double") stmt += `double('${col.name}')`;
  else if (type === "json") stmt += `json('${col.name}')`;
  else stmt += `string('${col.name}')`;  // fallback

  if (isUnique) stmt += `->unique()`;

  // Nullable par défaut sauf id, created_at, et FK explicites
  const alwaysNonNull = new Set([
    "id", "created_at", "updated_at",
    "name", "label", "code", "type", "status",
    "scanned_at", "moved_at", "checkin_time", "movement_date",
  ]);
  if (!alwaysNonNull.has(col.name) && !col.name.endsWith("_id")) {
    // Booléens : pas nullable, mais default false
    if (type === "boolean") stmt += `->default(false)`;
    else stmt += `->nullable()`;
  }

  stmt += `;`;
  if (col.comment) stmt += ` // ${col.comment}`;
  return stmt;
}

function pickOnDelete(tableName, col) {
  // Heuristiques par table : tables filles d'un parent fort → cascade
  const cascadeMap = {
    // FK_field → cascade
    "client_companies.client_id": "cascade",
    "billing_contacts.client_id": "cascade",
    "client_contacts.client_id": "cascade",
    "related_contacts.client_id": "cascade",
    "client_absences.client_id": "cascade",
    "employee_skills.employee_id": "cascade",
    "employee_skills.skill_id": "cascade",
    "contract_blocked_slots.contract_id": "cascade",
    "contract_surcharge_overrides.contract_id": "cascade",
    "trainings.employee_id": "cascade",
    "employee_absences.employee_id": "cascade",
    "client_absences.client_id": "cascade",
    "salary_deduction_debts.salary_deduction_id": "cascade",
    "deduction_payments.salary_deduction_id": "cascade",
    "product_price_tiers.product_id": "cascade",
    "quote_surcharge_rules.quote_id": "cascade",
    "client_prestations.client_id": "cascade",
    "checkins.intervention_id": "cascade",
    "invoice_items.invoice_id": "cascade",
    "reglement_invoice_lines.reglement_id": "cascade",
    "message_thread_participants.thread_id": "cascade",
    "messages.thread_id": "cascade",
    "key_movements.key_id": "cascade",
    "stock_inventory_lines.inventory_id": "cascade",
    "client_event_recurrences.client_id": "cascade",
    "client_events.client_id": "cascade",
    "employee_event_recurrences.employee_id": "cascade",
    "employee_events.employee_id": "cascade",
    "notification_preferences.user_id": "cascade",
    "client_requests.client_id": "cascade",
    "consumable_reorders.client_id": "cascade",
    "quality_controls.client_id": "cascade",
    "recurrence_assignments.recurrence_id": "cascade",
  };
  const key = `${tableName}.${col.name}`;
  if (cascadeMap[key]) return cascadeMap[key];

  // Self-refs → set null (parent_id, next_*, adjustment_of_id, etc.)
  if (col.fk && col.fk.table === tableName) return "set null";

  // FK vers users (audit/creator) → set null
  if (col.fk && col.fk.table === "users") return "set null";

  // FK vers tables référentielles → restrict
  return "restrict";
}

function isNullableFk(tableName, col) {
  // Heuristique : si la colonne contient un mot d'optionnalité ou self-ref
  if (col.fk && col.fk.table === tableName) return true;  // self-ref toujours nullable
  if (col.fk && col.fk.table === "users") return true;     // FK users souvent optionnelle
  const nullablePatterns = [
    "owner_user_id", "created_by", "created_by_id", "approved_by",
    "requested_by", "selected_employee_id", "replacement_employee_id",
    "parent_id", "next_intervention_id", "adjustment_of_id",
    "third_party_payer_id", "supplier_id", "employee_id",
    "sepa_order_id", "sepa_mandate_id", "billing_cycle_id",
    "intervention_address_id", "custom_address_id", "medical_visit_address_id",
    "next_recurrence_id", "contact_id", "client_prestation_id",
    "intervention_id", "mission_id", "client_id", "quote_id",
    "reference_id", "entity_id", "category_id", "vat_rate_id",
    "creditor_contact_id", "bank_account_id", "entity_bank_account_id",
    "debtor_bank_account_id", "stock_product_id",
    "pec_third_party_payer_id", "qr_code_id", "checkin_id",
    "assigned_to", "done_by", "moved_by_user_id", "performed_by_user_id",
    "controlled_by", "uploaded_by_user_id", "approved_by_user_id",
    "requested_by_user_id", "created_by_user_id", "last_modified_by_user_id",
    "default_employee_id", "address_id", "event_type_id", "reason_id",
    "product_id", "generated_from_template_id",
  ];
  if (nullablePatterns.includes(col.name)) return true;
  return false;
}

function emitMigration(tableName, table, index) {
  const isPoly = isPolymorphicTable(tableName, table.columns);
  const hasIdCol = table.columns.some((c) => c.name === "id");
  const hasCreatedAt = table.columns.some((c) => c.name === "created_at");
  const compositePk = table.indexes.find((idx) => idx.options.includes("pk"));

  const colLines = [];

  // id si présent
  if (hasIdCol) {
    colLines.push(`            $table->id();`);
  } else if (compositePk) {
    // Composite PK : columns sans pk individuelle, primary à la fin
  }

  for (const col of table.columns) {
    if (col.name === "id") continue;  // déjà fait
    if (col.name === "created_at") continue;  // timestamps() à la fin
    if (col.name === "updated_at") continue;  // timestamps() à la fin

    // Polymorphisme : skip owner_type + owner_id séparés, on les remplace par morphs()
    if (isPoly && (col.name === "owner_type" || col.name === "owner_id")) {
      if (col.name === "owner_type") {
        colLines.push(`            $table->morphs('owner');`);
      }
      continue;
    }

    colLines.push(emitColumnLine(col, tableName));
  }

  // Timestamps
  if (hasCreatedAt) {
    colLines.push(`            $table->timestamps();`);
  }

  // Composite primary key
  if (compositePk) {
    const fields = compositePk.fields.map((f) => `'${f}'`).join(", ");
    colLines.push(`            $table->primary([${fields}]);`);
  }

  const className = "Create" + toPascalCase(tableName) + "Table";
  const timestamp = makeTimestamp(index);
  const filename = `${timestamp}_create_${tableName}_table.php`;

  const content = `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('${tableName}', function (Blueprint $table) {
${colLines.join("\n")}
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('${tableName}');
    }
};
`;

  return { filename, content, className };
}

function toPascalCase(snake) {
  return snake.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join("");
}

function makeTimestamp(index) {
  // 2026_05_12_110000 + index * 1 second → unique stable timestamps
  const base = new Date(2026, 4, 12, 11, 0, 0).getTime();
  const t = new Date(base + index * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${t.getFullYear()}_${pad(t.getMonth() + 1)}_${pad(t.getDate())}_${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
}

// === Main ===

function main() {
  const clean = process.argv.includes("--clean");

  console.log(`[*] Reading DBML : ${DBML_PATH}`);
  const dbml = readFileSync(DBML_PATH, "utf8");
  const { tables, refs } = parseDbml(dbml);
  console.log(`[*] Parsed ${tables.size} tables and ${refs.length} refs.`);

  if (clean) {
    console.log(`[*] Cleaning existing CRM migrations...`);
    const keep = /^(0001_01_01_|2026_05_12_09|2026_05_12_10)/;
    const files = readdirSync(MIGRATIONS_DIR);
    let removed = 0;
    for (const f of files) {
      if (f.endsWith(".php") && !keep.test(f)) {
        unlinkSync(join(MIGRATIONS_DIR, f));
        removed++;
      }
    }
    console.log(`    Removed ${removed} CRM migration(s).`);
  }

  console.log(`[*] Generating migrations...`);
  let generated = 0;
  let skipped = 0;

  for (let i = 0; i < ORDER.length; i++) {
    const tableName = ORDER[i];
    if (SKIP_TABLES.has(tableName)) {
      skipped++;
      continue;
    }
    const table = tables.get(tableName);
    if (!table) {
      console.warn(`    [!] Table not found in DBML : ${tableName}`);
      continue;
    }
    const { filename, content } = emitMigration(tableName, table, i);
    const outPath = join(MIGRATIONS_DIR, filename);
    writeFileSync(outPath, content);
    generated++;
  }

  // Warning si une table du DBML n'est pas dans ORDER
  const seen = new Set(ORDER);
  for (const [name] of tables) {
    if (!seen.has(name) && !SKIP_TABLES.has(name)) {
      console.warn(`    [!] DBML table not in ORDER list : ${name}`);
    }
  }

  console.log(`[*] Done. ${generated} migrations generated, ${skipped} skipped.`);
}

main();
