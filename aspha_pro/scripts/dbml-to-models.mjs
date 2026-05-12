#!/usr/bin/env node
/**
 * Parse crm_ximi_schema_final.dbml → génère les modèles Eloquent
 * dans aspha_pro/backend/app/Models/.
 *
 * Usage : node scripts/dbml-to-models.mjs
 *
 * SKIP : User (existe déjà, étendu manuellement)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PROJECT_ROOT = join(ROOT, "..");
const DBML_PATH = join(PROJECT_ROOT, "crm_ximi_schema_final.dbml");
const MODELS_DIR = join(ROOT, "backend", "app", "Models");

const SKIP_TABLES = new Set([
  "users", "roles", "permissions", "role_permission",
]);

// Tables avec soft deletes (entités métier sensibles)
const SOFT_DELETES = new Set([
  "clients", "employees", "contracts",
  "invoices", "quotes", "missions", "client_prestations",
  "documents", "keys",
]);

// Tables avec audit Spatie ActivityLog
const AUDIT_LOG = new Set([
  "clients", "employees", "contracts",
  "invoices", "quotes", "reglements",
  "interventions", "documents", "electronic_signatures",
]);

// === DBML Parser ===
function parseDbml(src) {
  const tables = new Map();
  const refs = [];

  const tableRegex = /Table\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = tableRegex.exec(src)) !== null) {
    tables.set(m[1], parseTableBody(m[2]));
  }

  const refRegex = /^Ref:\s+(\w+)\.(\w+)\s*>\s*(\w+)\.(\w+)/gm;
  while ((m = refRegex.exec(src)) !== null) {
    refs.push({
      sourceTable: m[1], sourceField: m[2],
      targetTable: m[3], targetField: m[4],
    });
  }

  for (const ref of refs) {
    const t = tables.get(ref.sourceTable);
    if (!t) continue;
    const col = t.columns.find((c) => c.name === ref.sourceField);
    if (col) col.fk = { table: ref.targetTable, field: ref.targetField };
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
        const idxRegex = /\(([^)]+)\)\s*\[([^\]]+)\]/g;
        let im;
        while ((im = idxRegex.exec(indexBuffer)) !== null) {
          indexes.push({
            fields: im[1].split(",").map((s) => s.trim()),
            options: im[2].split(",").map((s) => s.trim()),
          });
        }
        inIndexes = false;
      }
      continue;
    }

    const colMatch = line.match(/^(\w+)\s+(\w+(?:\([^)]+\))?)\s*(?:\[([^\]]+)\])?\s*(?:\/\/(.*))?$/);
    if (colMatch) {
      const [, name, typeRaw, optsRaw, comment] = colMatch;
      columns.push({
        name, type: typeRaw,
        options: optsRaw ? optsRaw.split(",").map((s) => s.trim()) : [],
        comment: comment ? comment.trim() : null,
      });
    }
  }

  return { columns, indexes };
}

// === Helpers ===
function toPascalCase(snake) {
  return snake.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join("");
}

function toCamelCase(snake) {
  const parts = snake.split("_");
  return parts[0] + parts.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
}

function singularize(plural) {
  // Cas spéciaux
  const special = {
    addresses: "address",
    entities: "entity",
    companies: "company",
    categories: "category",
    histories: "history",
    inventories: "inventory",
    movements: "movement",
    deductions: "deduction",
    references: "reference",
    types: "type",
    payments: "payment",
    payers: "payer",
    accounts: "account",
    contacts: "contact",
    suppliers: "supplier",
    rules: "rule",
    rates: "rate",
    overrides: "override",
    slots: "slot",
    skills: "skill",
    trainings: "training",
    debts: "debt",
    tiers: "tier",
    quotes: "quote",
    missions: "mission",
    prestations: "prestation",
    interventions: "intervention",
    assignments: "assignment",
    requests: "request",
    events: "event",
    recurrences: "recurrence",
    logs: "log",
    codes: "code",
    checkins: "checkin",
    cycles: "cycle",
    invoices: "invoice",
    items: "item",
    reglements: "reglement",
    lines: "line",
    threads: "thread",
    participants: "participant",
    messages: "message",
    keys: "key",
    documents: "document",
    reorders: "reorder",
    signatures: "signature",
    controls: "control",
    products: "product",
    preferences: "preference",
    notifications: "notification",
    permissions: "permission",
    roles: "role",
    users: "user",
    employees: "employee",
    clients: "client",
    mandates: "mandate",
    orders: "order",
    reasons: "reason",
    absences: "absence",
    zones: "zone",
  };
  if (special[plural]) return special[plural];
  if (plural.endsWith("ies")) return plural.slice(0, -3) + "y";
  if (plural.endsWith("ses")) return plural.slice(0, -2);
  if (plural.endsWith("s")) return plural.slice(0, -1);
  return plural;
}

function isPolymorphicTable(columns) {
  return columns.some((c) => c.name === "owner_type") &&
         columns.some((c) => c.name === "owner_id");
}

// === Détection des relations ===
function detectRelations(tableName, table, tables, refs) {
  const relations = [];

  // BelongsTo : depuis les FK de cette table
  for (const col of table.columns) {
    if (!col.fk) continue;
    const targetTable = col.fk.table;
    const targetModel = toPascalCase(singularize(targetTable));
    const relName = col.name.endsWith("_id") ? toCamelCase(col.name.slice(0, -3)) : toCamelCase(col.name);
    relations.push({
      kind: "belongsTo",
      name: relName,
      model: targetModel,
      foreignKey: col.name,
    });
  }

  // HasMany : tables qui ont une FK vers nous
  const myFkPattern = singularize(tableName) + "_id";
  for (const [otherName, otherTable] of tables) {
    if (otherName === tableName) continue;
    if (SKIP_TABLES.has(otherName)) continue;
    for (const col of otherTable.columns) {
      if (col.fk && col.fk.table === tableName) {
        const otherModel = toPascalCase(singularize(otherName));
        // Nom de la relation : pluralized
        const relName = toCamelCase(otherName);
        relations.push({
          kind: "hasMany",
          name: relName,
          model: otherModel,
          foreignKey: col.name,
        });
      }
    }
  }

  // MorphTo (si table polymorphique)
  if (isPolymorphicTable(table.columns)) {
    relations.push({
      kind: "morphTo",
      name: "owner",
    });
  }

  return relations;
}

// === Casts ===
function detectCasts(columns) {
  const casts = {};
  for (const col of columns) {
    const t = col.type.toLowerCase();
    if (col.name === "id" || col.name.endsWith("_id")) continue;

    if (t === "boolean") casts[col.name] = "boolean";
    else if (t === "datetime" || t === "timestamp") casts[col.name] = "datetime";
    else if (t === "date") casts[col.name] = "date";
    else if (t === "decimal") casts[col.name] = "decimal:2";
    else if (t === "json") casts[col.name] = "array";
    else if (t === "float" || t === "double") casts[col.name] = "float";
  }
  return casts;
}

// === Fillable ===
function detectFillable(columns) {
  return columns
    .filter((c) => c.name !== "id" && c.name !== "created_at" && c.name !== "updated_at" && c.name !== "deleted_at")
    .map((c) => c.name);
}

// === Génération du model ===
function emitModel(tableName, table, tables, refs) {
  const modelName = toPascalCase(singularize(tableName));
  const isPoly = isPolymorphicTable(table.columns);
  const hasSoftDeletes = SOFT_DELETES.has(tableName);
  const hasAudit = AUDIT_LOG.has(tableName);

  const fillable = detectFillable(table.columns);
  const casts = detectCasts(table.columns);
  const relations = detectRelations(tableName, table, tables, refs);

  // Pour les pivot tables sans id (composite PK), on ne crée pas un model standard
  const hasId = table.columns.some((c) => c.name === "id");
  if (!hasId) {
    // Pivot table : skip pour le moment (à gérer via belongsToMany sur les parents)
    return null;
  }

  // Imports
  const imports = ["use Illuminate\\Database\\Eloquent\\Model;"];
  if (hasSoftDeletes) imports.push("use Illuminate\\Database\\Eloquent\\SoftDeletes;");
  if (hasAudit) {
    imports.push("use Spatie\\Activitylog\\LogOptions;");
    imports.push("use Spatie\\Activitylog\\Traits\\LogsActivity;");
  }

  const hasRelations = relations.length > 0;
  if (hasRelations) {
    const kinds = new Set(relations.map((r) => r.kind));
    if (kinds.has("belongsTo")) imports.push("use Illuminate\\Database\\Eloquent\\Relations\\BelongsTo;");
    if (kinds.has("hasMany")) imports.push("use Illuminate\\Database\\Eloquent\\Relations\\HasMany;");
    if (kinds.has("morphTo")) imports.push("use Illuminate\\Database\\Eloquent\\Relations\\MorphTo;");
  }

  // Traits
  const traits = [];
  if (hasSoftDeletes) traits.push("SoftDeletes");
  if (hasAudit) traits.push("LogsActivity");

  // Header
  let php = `<?php\n\nnamespace App\\Models;\n\n`;
  php += imports.sort().join("\n") + "\n\n";

  php += `class ${modelName} extends Model\n{\n`;

  if (traits.length > 0) {
    php += `    use ${traits.join(", ")};\n\n`;
  }

  // Timestamps : désactivés si le DBML ne définit pas created_at
  const hasCreatedAt = table.columns.some((c) => c.name === "created_at");
  if (!hasCreatedAt) {
    php += `    public $timestamps = false;\n\n`;
  }

  // Fillable
  if (fillable.length > 0) {
    php += `    protected $fillable = [\n`;
    for (const f of fillable) {
      php += `        '${f}',\n`;
    }
    php += `    ];\n\n`;
  }

  // Casts
  if (Object.keys(casts).length > 0) {
    php += `    protected function casts(): array\n    {\n`;
    php += `        return [\n`;
    for (const [k, v] of Object.entries(casts)) {
      php += `            '${k}' => '${v}',\n`;
    }
    php += `        ];\n    }\n\n`;
  }

  // Activity log
  if (hasAudit) {
    php += `    public function getActivitylogOptions(): LogOptions\n    {\n`;
    php += `        return LogOptions::defaults()\n`;
    php += `            ->logFillable()\n`;
    php += `            ->logOnlyDirty()\n`;
    php += `            ->dontSubmitEmptyLogs();\n`;
    php += `    }\n\n`;
  }

  // Relations (dedup)
  const seen = new Set();
  for (const rel of relations) {
    const key = `${rel.kind}:${rel.name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (rel.kind === "belongsTo") {
      php += `    public function ${rel.name}(): BelongsTo\n    {\n`;
      php += `        return $this->belongsTo(${rel.model}::class, '${rel.foreignKey}');\n`;
      php += `    }\n\n`;
    } else if (rel.kind === "hasMany") {
      php += `    public function ${rel.name}(): HasMany\n    {\n`;
      php += `        return $this->hasMany(${rel.model}::class, '${rel.foreignKey}');\n`;
      php += `    }\n\n`;
    } else if (rel.kind === "morphTo") {
      php += `    public function ${rel.name}(): MorphTo\n    {\n`;
      php += `        return $this->morphTo();\n`;
      php += `    }\n\n`;
    }
  }

  php += `}\n`;

  return { modelName, content: php };
}

// === Main ===
function main() {
  console.log(`[*] Reading DBML : ${DBML_PATH}`);
  const dbml = readFileSync(DBML_PATH, "utf8");
  const { tables, refs } = parseDbml(dbml);
  console.log(`[*] Parsed ${tables.size} tables, ${refs.length} refs.`);

  if (!existsSync(MODELS_DIR)) mkdirSync(MODELS_DIR, { recursive: true });

  let generated = 0;
  let skipped = 0;
  let pivots = 0;

  for (const [tableName, table] of tables) {
    if (SKIP_TABLES.has(tableName)) {
      skipped++;
      continue;
    }
    const result = emitModel(tableName, table, tables, refs);
    if (!result) {
      pivots++;
      continue;
    }
    const outPath = join(MODELS_DIR, `${result.modelName}.php`);
    writeFileSync(outPath, result.content);
    generated++;
  }

  console.log(`[*] Done. ${generated} models generated, ${skipped} skipped (auth), ${pivots} pivots skipped.`);
}

main();
