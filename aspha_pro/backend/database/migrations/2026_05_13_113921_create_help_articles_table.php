<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Articles de documentation utilisateur in-app.
 *
 *  - slug : URL-friendly, unique
 *  - title, summary, body (Markdown)
 *  - category : 'planning', 'clients', 'stock', 'facturation', etc.
 *  - audience : 'all' | 'admin' | 'intervenant' | 'client' (filtre par rôle)
 *  - order : tri dans la sidebar
 *  - published : draft vs publié
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('help_articles', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->string('summary')->nullable();
            $table->text('body');  // markdown
            $table->string('category')->default('general');
            $table->string('audience')->default('all');  // all | admin | intervenant | client
            $table->integer('display_order')->default(0);
            $table->boolean('published')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('help_articles');
    }
};
