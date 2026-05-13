<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\HelpArticle;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Documentation utilisateur in-app : articles markdown éditables par super-admin.
 *
 *  - GET /help/articles        → liste filtrée par audience (selon rôle user) + search
 *  - GET /help/articles/{slug} → article complet
 *  - POST /help/articles       → super-admin
 *  - PATCH /help/articles/{slug}  → super-admin
 */
class HelpController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $audience = $user?->hasRole('intervenant') ? 'intervenant'
            : ($user?->hasRole('client') ? 'client' : 'admin');

        $search = $request->query('search');

        $query = HelpArticle::query()
            ->where('published', true)
            ->whereIn('audience', ['all', $audience])
            ->when($search, function ($q) use ($search) {
                $q->where(function ($q2) use ($search) {
                    $q2->where('title', 'like', "%$search%")
                       ->orWhere('summary', 'like', "%$search%")
                       ->orWhere('body', 'like', "%$search%");
                });
            })
            ->orderBy('category')
            ->orderBy('display_order')
            ->orderBy('title');

        return ['data' => $query->get(['id', 'slug', 'title', 'summary', 'category', 'audience', 'display_order'])];
    }

    public function show(Request $request, string $slug)
    {
        $article = HelpArticle::where('slug', $slug)->firstOrFail();
        return ['data' => $article];
    }

    public function store(Request $request)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'summary' => ['nullable', 'string'],
            'body' => ['required', 'string'],
            'category' => ['nullable', 'string', 'max:64'],
            'audience' => ['nullable', 'in:all,admin,intervenant,client'],
            'display_order' => ['nullable', 'integer'],
            'published' => ['nullable', 'boolean'],
        ]);
        $data['slug'] = Str::slug($data['title']) . '-' . now()->timestamp;
        $article = HelpArticle::create($data);
        return response()->json(['data' => $article], 201);
    }

    public function update(Request $request, string $slug)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403);
        $article = HelpArticle::where('slug', $slug)->firstOrFail();
        $article->update($request->validate([
            'title' => ['sometimes', 'string'],
            'summary' => ['sometimes', 'nullable', 'string'],
            'body' => ['sometimes', 'string'],
            'category' => ['sometimes', 'string'],
            'audience' => ['sometimes', 'in:all,admin,intervenant,client'],
            'display_order' => ['sometimes', 'integer'],
            'published' => ['sometimes', 'boolean'],
        ]));
        return ['data' => $article->fresh()];
    }

    public function destroy(Request $request, string $slug)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403);
        HelpArticle::where('slug', $slug)->delete();
        return response()->noContent();
    }
}
