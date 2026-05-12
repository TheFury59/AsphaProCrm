<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Document;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Documents polymorphique : owner = client / employee / contract / invoice / quote.
 *
 * Stockage : disk 'local' sous /storage/app/documents/<owner_type>/<owner_id>/.
 * En prod o2switch, accès via signed URL (à implémenter quand besoin).
 *
 * Pour la V1 : upload simple, pas de Spatie Media Library (overkill ici).
 */
class DocumentController extends Controller
{
    private const ALLOWED_OWNER_TYPES = ['client', 'employee', 'contract', 'invoice', 'quote'];

    public function index(Request $request)
    {
        abort_unless($request->user()?->can('clients.view'), 403);

        $request->validate([
            'owner_type' => ['required', 'in:client,employee,contract,invoice,quote'],
            'owner_id' => ['required', 'integer'],
        ]);

        $docs = Document::where('owner_type', $request->query('owner_type'))
            ->where('owner_id', $request->query('owner_id'))
            ->orderByDesc('id')
            ->get();

        return ['data' => $docs->map(fn ($d) => $this->serialize($d))];
    }

    public function store(Request $request)
    {
        abort_unless($request->user()?->can('clients.edit') || $request->user()?->can('employees.edit'), 403);

        $data = $request->validate([
            'owner_type' => ['required', 'in:client,employee,contract,invoice,quote'],
            'owner_id' => ['required', 'integer'],
            'label' => ['required', 'string', 'max:255'],
            'document_type' => ['required', 'in:contract,invoice,insurance,product_sheet,protocol,other'],
            'is_client_visible' => ['nullable', 'boolean'],
            'file' => ['required', 'file', 'max:10240'], // 10 MB
        ]);

        // Vérifier que l'owner existe
        $ownerClass = match ($data['owner_type']) {
            'client' => Client::class,
            'employee' => Employee::class,
            default => null,
        };
        if ($ownerClass) {
            abort_unless($ownerClass::find($data['owner_id']), 404, 'Owner not found');
        }

        // Stocker le fichier
        $path = $request->file('file')->store(
            "documents/{$data['owner_type']}/{$data['owner_id']}",
            'public'
        );

        $doc = Document::create([
            'owner_type' => $data['owner_type'],
            'owner_id' => $data['owner_id'],
            'file_path' => $path,
            'label' => $data['label'],
            'document_type' => $data['document_type'],
            'is_client_visible' => $data['is_client_visible'] ?? false,
        ]);

        return response()->json(['data' => $this->serialize($doc)], 201);
    }

    public function download(Request $request, Document $document)
    {
        abort_unless($request->user()?->can('clients.view'), 403);
        return Storage::disk('public')->download($document->file_path, $document->label);
    }

    public function destroy(Request $request, Document $document)
    {
        abort_unless($request->user()?->can('clients.edit') || $request->user()?->can('employees.edit'), 403);

        if ($document->file_path) {
            Storage::disk('public')->delete($document->file_path);
        }
        $document->delete();
        return response()->noContent();
    }

    private function serialize(Document $d): array
    {
        return [
            'id' => $d->id,
            'owner_type' => $d->owner_type,
            'owner_id' => $d->owner_id,
            'label' => $d->label,
            'document_type' => $d->document_type,
            'is_client_visible' => (bool) $d->is_client_visible,
            'file_path' => $d->file_path,
            'download_url' => "/api/v1/documents/{$d->id}/download",
            'size_kb' => $d->file_path && Storage::disk('public')->exists($d->file_path)
                ? round(Storage::disk('public')->size($d->file_path) / 1024)
                : null,
            'created_at' => $d->created_at?->toIso8601String(),
        ];
    }
}
