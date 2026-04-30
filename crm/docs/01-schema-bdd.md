# Schéma BDD — Aspha CRM

> Code en anglais (tables/colonnes), UI en français.
> Single-DB multi-tenant via `site_id`. SQLite en dev, MySQL/MariaDB en prod o2switch.

## Vue d'ensemble (cœur calendrier)

```
sites ──┬── users ──┬── employees ──┬── employee_contracts
        │           │               ├── absences
        │           │               └── unavailabilities
        │           └── clients ──── client_addresses ── qr_codes
        │
        └── service_assignments  ◄── « période de service »
              ├── client / address / service / employee
              ├── recurrence_rule (RRULE iCal)
              └── appointments (instances)
                    └── qr_scans (badgeages)
```

## Tables

### Référentiels

**sites** — agences Aspha multi-villes.
- id, name, code (unique), address, city, postal_code, phone, timezone, is_active

**users** — auth Laravel + Sanctum.
- id, name, email (unique), password, type ENUM('admin','manager','employee','client'), site_id (FK, nullable pour super-admin)
- email_verified_at, remember_token, last_login_at
- timestamps + softDeletes

**roles, permissions, model_has_roles, model_has_permissions, role_has_permissions** — Spatie Permission.

### Personnes

**employees** — profil métier des salariés.
- id, user_id (FK 1-1), site_id (FK)
- first_name, last_name, phone, mobile, birthdate
- address_line1, address_line2, postal_code, city, country
- geo_lat DECIMAL(10,7), geo_lng DECIMAL(10,7) — pour cartographie
- hire_date, status ENUM('active','on_leave','inactive')
- notes
- timestamps + softDeletes

**employee_contracts** — un actif + historique avenants.
- id, employee_id (FK), position, weekly_hours DECIMAL(5,2)
- vacation_days_per_year, hourly_gross_rate
- start_date, end_date (nullable), is_current BOOL
- contract_type ENUM('cdi','cdd','interim','other')
- timestamps

**clients** — clients Aspha.
- id, site_id (FK), user_id (FK, nullable — extranet activé ou pas)
- type ENUM('individual','company'), first_name, last_name, company_name
- email, phone, mobile, billing_email
- siret, vat_number (entreprises)
- notes
- timestamps + softDeletes

**client_addresses** — 1 client = N adresses.
- id, client_id (FK), label (ex. "Domicile principal")
- address_line1, address_line2, postal_code, city, country
- geo_lat, geo_lng
- access_notes (digicode, étage, etc.)
- is_default BOOL
- timestamps + softDeletes

### Catalogue & affectations (cœur calendrier)

**services** — catalogue prestations (ex. "Ménage 2h", "Aide aux courses").
- id, name, code (unique), description
- default_hourly_rate DECIMAL(8,2), default_duration_minutes INT
- color (pour affichage calendrier, hex)
- is_active
- timestamps + softDeletes

**service_assignments** ⭐ — **« période de service »** (l'ID stable que le client a demandé).
> Un client peut avoir N service_assignments simultanés, même plusieurs le même jour.
- id (PK = ID de la période de service, exposé partout)
- client_id (FK), client_address_id (FK), service_id (FK)
- default_employee_id (FK, nullable = pool)
- type ENUM('punctual','recurring')
- hourly_rate DECIMAL(8,2) — override du service.default
- duration_minutes INT
- # ponctuel
- scheduled_date DATE (nullable si récurrent), scheduled_time TIME (nullable)
- # récurrent
- recurrence_start DATE, recurrence_end DATE (nullable = sans fin)
- recurrence_time TIME, recurrence_rule TEXT (RRULE iCal: `FREQ=WEEKLY;BYDAY=MO,WE`)
- status ENUM('active','paused','ended')
- created_by_user_id, notes
- timestamps + softDeletes

**appointments** — instances réelles dans le calendrier.
- id, service_assignment_id (FK)
- employee_id (FK, intervenant final — peut différer du default si remplacement)
- client_address_id (FK, dénormalisé pour audit)
- scheduled_start DATETIME, scheduled_end DATETIME
- actual_start DATETIME nullable, actual_end DATETIME nullable (rempli par QR scan)
- status ENUM('planned','done','cancelled','no_show')
- paid_to_employee BOOL DEFAULT 1
- invoiced_to_client BOOL DEFAULT 1
- admin_notes TEXT
- created_by_user_id, last_modified_by_user_id
- timestamps + softDeletes

### Pointage QR

**qr_codes** — 1 par adresse client.
- id, client_address_id (FK, unique), code VARCHAR(64) unique (token URL-safe)
- is_active, generated_at, last_scanned_at
- timestamps

**qr_scans** — historique des badgeages.
- id, appointment_id (FK), qr_code_id (FK), employee_id (FK)
- scanned_at DATETIME, scan_type ENUM('check_in','check_out')
- geo_lat, geo_lng (position GPS du téléphone au scan)
- offline_synced_at DATETIME nullable
- raw_payload JSON
- timestamps

### RH

**absences** — congés (longue durée).
- id, employee_id (FK)
- start_date, end_date, type ENUM('paid_leave','sick_leave','unpaid','other')
- status ENUM('requested','approved','rejected'), requested_by_user_id, approved_by_user_id
- notes
- timestamps

**unavailabilities** — indisponibilités courtes.
- id, employee_id (FK), starts_at DATETIME, ends_at DATETIME, reason
- timestamps

### Trajets

**travel_cache** — cache des appels Google Distance Matrix.
- id, from_address_id (FK), to_address_id (FK)
- duration_seconds INT, distance_meters INT, mode ENUM('driving','walking','transit')
- cached_at DATETIME
- UNIQUE(from_address_id, to_address_id, mode)

### Clés

**keys** — référentiel.
- id, code (unique), client_id (FK), client_address_id (FK)
- label, notes, is_active
- timestamps + softDeletes

**key_movements** — historique de remise (porteur polymorphique).
- id, key_id (FK)
- from_holder_type ENUM('employee','agency','safe','client'), from_holder_id
- to_holder_type ENUM('employee','agency','safe','client'), to_holder_id
- moved_at DATETIME, moved_by_user_id, notes
- timestamps

### Documents

**document_templates** — modèles types.
- id, name, type, file_path, variables JSON, is_active
- timestamps

**documents** — polymorphique (attachable client/employee/contract/appointment/...).
- id, documentable_type, documentable_id (polymorphique)
- name, file_path, mime_type, size_bytes, generated_from_template_id (FK nullable)
- expires_at (nullable, pour rappels documents salariés)
- uploaded_by_user_id
- timestamps + softDeletes

### Devis & Factures

**quotes** — devis.
- id, site_id (FK), client_id (FK), reference (unique), issued_on, valid_until
- subtotal, vat_amount, total, status ENUM('draft','sent','accepted','rejected','expired')
- notes
- timestamps + softDeletes

**quote_lines** — lignes de devis.
- id, quote_id (FK), service_id (FK nullable), label
- quantity, unit_price, vat_rate, line_total
- position INT
- timestamps

**invoices** — factures.
- id, site_id (FK), client_id (FK), reference (unique), issued_on, due_on
- subtotal, vat_amount, total, paid_amount, status ENUM('draft','sent','partial','paid','overdue','cancelled')
- pennylane_id (nullable, sync future), notes
- timestamps + softDeletes

**invoice_lines** — lignes de facture.
- id, invoice_id (FK), appointment_id (FK nullable, traçabilité), service_id (FK nullable)
- label, quantity, unit_price, vat_rate, line_total, position INT
- timestamps

### Inventaire

**inventory_items** — stock.
- id, site_id (FK), sku (unique), name, category, unit
- current_qty DECIMAL(10,2), reorder_threshold DECIMAL(10,2), is_active
- timestamps + softDeletes

**inventory_movements** — entrées/sorties.
- id, inventory_item_id (FK), site_id (FK)
- type ENUM('in','out','adjustment'), quantity DECIMAL(10,2)
- reason, performed_by_user_id, performed_at
- timestamps

### Audit

**activity_log** (Spatie) — déjà installé.
**media** (Spatie Media Library) — déjà installé.

## Conventions

- **IDs** : auto-increment unsigned bigint partout (simple, perf OK pour ce volume).
- **Timestamps** : `created_at`, `updated_at`, `deleted_at` (soft delete) sur entités métier.
- **FK** : ON DELETE RESTRICT par défaut, sauf cas explicite.
- **Indexes** : sur tous les FK + `(site_id, …)` composé sur les tables filtrées par site.
- **Statuts** : ENUM string (lisible en DB, contraint).
- **Dates** : DATETIME en UTC en DB, conversion timezone Europe/Paris à l'affichage.
