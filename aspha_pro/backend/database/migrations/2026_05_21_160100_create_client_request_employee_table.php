<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 2026-05-21 — Affectation d'intervenant(s) à un ticket.
 *
 * Table pivot `client_request_employee` : un ticket peut être confié à
 * plusieurs intervenants, qui deviennent alors participants du fil de
 * discussion (ils voient le ticket dans leur extranet et peuvent y répondre).
 *
 * Distinct de `client_requests.assigned_to` (un seul user, plutôt un admin
 * référent côté traitement interne) : ici ce sont les intervenants terrain
 * sollicités sur la demande.
 *
 *  - `client_request_id` : FK ticket, cascade.
 *  - `employee_id`       : FK intervenant, cascade.
 *  - unique composite    : pas de double affectation du même intervenant.
 *
 * Idempotent (`Schema::hasTable`) + compatible PostgreSQL/SQLite.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('client_request_employee')) {
            return;
        }

        Schema::create('client_request_employee', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_request_id')
                ->constrained('client_requests')->cascadeOnDelete();
            $table->foreignId('employee_id')
                ->constrained('employees')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['client_request_id', 'employee_id'], 'client_request_employee_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_request_employee');
    }
};
