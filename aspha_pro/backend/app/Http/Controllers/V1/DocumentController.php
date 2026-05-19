<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Document;
use App\Models\Employee;
use App\Models\Invoice;
use App\Models\Quote;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Documents polymorphique : owner = client / employee / contract / invoice / quote.
 *
 * Stockage : disk 'local' (PRIVÉ) sous /storage/app/documents/<owner_type>/<owner_id>/.
 *
 * ⚠️ HISTORIQUE SÉCURITÉ : avant le 2026-05-19, ce controller utilisait le
 * disk `public` symlinké vers `public/storage`. Conséquence : tout document
 * (contrat employé, fiche de paie, RIB, etc.) était téléchargeable sans
 * auth via l'URL directe `/storage/documents/...`. La réponse JSON exposait
 * même le `file_path` (information disclosure facilitant l'exploit). Audit
 * révélé une CRIT IDOR (rapport 2026-05-19). Fix : disk privé + download
 * uniquement via cet endpoint avec auth + ownership.
 *
 * MIME types autorisés : PDF, images standard, docs Office. Bloqué : html,
 * svg (XSS si servi avec content-type), exe, etc.
 */
class DocumentController extends Controller
{
    private const ALLOWED_OWNER_TYPES = ['client', 'employee', 'contract', 'invoice', 'quote'];

    /**
     * Mimes acceptés à l'upload. La validation `mimes:` Laravel vérifie le
     * vrai content du fichier (via fileinfo), pas juste l'extension client.
     */
    private const ALLOWED_MIMES = 'pdf,jpg,jpeg,png,webp,doc,docx,xls,xlsx,csv,txt';

    public function index(Request $request)
    {
        $request->validate([
            'owner_type' => ['required', 'in:' . implode(',', self::ALLOWED_OWNER_TYPES)],
            'owner_id' => ['required', 'integer'],
        ]);

        $ownerType = $request->query('owner_type');
        $ownerId = (int) $request->query('owner_id');

        // Permission de base : selon le owner_type
        $this->authorizeForOwner($request, $ownerType, 'view');

        // Ownership : non-admins ne voient que les docs de LEUR client / employee
        $this->ensureOwnerOwnership($request, $ownerType, $ownerId);

        $docs = Document::where('owner_type', $ownerType)
            ->where('owner_id', $ownerId)
            ->when(
                $this->isClientPortalUser($request),
                fn ($q) => $q->where('is_client_visible', true)
            )
            ->orderByDesc('id')
            ->get();

        return ['data' => $docs->map(fn ($d) => $this->serialize($d))];
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'owner_type' => ['required', 'in:' . implode(',', self::ALLOWED_OWNER_TYPES)],
            'owner_id' => ['required', 'integer'],
            'label' => ['required', 'string', 'max:255'],
            'document_type' => ['required', 'in:contract,invoice,insurance,product_sheet,protocol,other'],
            'is_client_visible' => ['nullable', 'boolean'],
            // MIME validation stricte. Sans ça on accepterait .html/.svg (XSS),
            // .exe, .php, etc. — cf. audit 2026-05-19.
            'file' => ['required', 'file', 'max:10240', 'mimes:' . self::ALLOWED_MIMES],
        ]);

        $ownerType = $data['owner_type'];
        $ownerId = (int) $data['owner_id'];

        $this->authorizeForOwner($request, $ownerType, 'edit');
        $this->ensureOwnerExists($ownerType, $ownerId);
        $this->ensureOwnerOwnership($request, $ownerType, $ownerId);

        // Filename randomisé pour éviter les collisions + ne pas exposer le
        // nom original côté path. Le `label` reste affiché à l'utilisateur.
        $ext = $request->file('file')->getClientOriginalExtension();
        $filename = Str::random(40) . '.' . preg_replace('/[^a-zA-Z0-9]/', '', $ext);

        // ⚠️ disk 'local' (privé, hors public/). NE PAS basculer en 'public'.
        $path = $request->file('file')->storeAs(
            "documents/{$ownerType}/{$ownerId}",
            $filename,
            'local',
        );

        $doc = Document::create([
            'owner_type' => $ownerType,
            'owner_id' => $ownerId,
            'file_path' => $path,
            'label' => $data['label'],
            'document_type' => $data['document_type'],
            'is_client_visible' => $data['is_client_visible'] ?? false,
        ]);

        return response()->json(['data' => $this->serialize($doc)], 201);
    }

    public function download(Request $request, Document $document)
    {
        $this->authorizeForOwner($request, $document->owner_type, 'view');
        $this->ensureOwnerOwnership($request, $document->owner_type, $document->owner_id);

        // Client portal user : ne voit que les docs `is_client_visible=true`
        if ($this->isClientPortalUser($request) && ! $document->is_client_visible) {
            abort(403, 'Ce document n\'est pas accessible depuis le portail.');
        }

        // Fallback rétro-compat : les fichiers stockés AVANT le 2026-05-19
        // résidaient sur le disk `public` (legacy). On lit d'abord `local`
        // (nouveau standard), sinon `public` (legacy à migrer). Une commande
        // artisan dédiée déplacera les anciens fichiers en lot.
        $disk = Storage::disk('local')->exists($document->file_path) ? 'local'
            : (Storage::disk('public')->exists($document->file_path) ? 'public' : null);
        if (! $disk) {
            abort(404, 'Fichier introuvable.');
        }

        // Sanitize le label utilisé en Content-Disposition (pas de CRLF
        // ni de chars qui cassent le header). Garde uniquement les chars
        // safe + l'extension d'origine.
        $safeLabel = preg_replace('/[^\w\s.\-]/u', '_', $document->label);
        if (! str_contains($safeLabel, '.')) {
            $ext = pathinfo($document->file_path, PATHINFO_EXTENSION);
            $safeLabel .= '.' . $ext;
        }

        return Storage::disk($disk)->download($document->file_path, $safeLabel);
    }

    public function destroy(Request $request, Document $document)
    {
        $this->authorizeForOwner($request, $document->owner_type, 'edit');
        $this->ensureOwnerOwnership($request, $document->owner_type, $document->owner_id);

        // ⚠️ Le model Document utilise SoftDeletes. On ne supprime PAS le
        // fichier disque ici — sinon une restauration soft-delete laisserait
        // une entrée DB sans fichier. Le fichier sera purgé par un job de
        // garbage collection (à implémenter si besoin) après X jours.
        $document->delete();
        return response()->noContent();
    }

    /**
     * Vérifie la permission de base selon le owner_type :
     *  - client/invoice/quote/contract → clients.view|edit
     *  - employee → employees.view|edit
     *
     * Les permissions sont cloisonnées : avoir clients.edit ne donne PAS le
     * droit de toucher aux docs employees (et inversement).
     */
    private function authorizeForOwner(Request $request, string $ownerType, string $action): void
    {
        $user = $request->user();
        abort_unless($user, 401);

        $perm = match ($ownerType) {
            'employee' => $action === 'view' ? 'employees.view' : 'employees.edit',
            default => $action === 'view' ? 'clients.view' : 'clients.edit',
        };

        // Cas spécial : client extranet a `portal.requests.create` mais pas
        // `clients.view`. On l'autorise quand même à voir ses propres docs.
        if ($action === 'view' && $user->hasRole('client')) {
            return;
        }

        abort_unless($user->can($perm), 403, "Permission $perm requise.");
    }

    /**
     * Vérifie que l'owner existe en BDD (pour types simples).
     * Pour contract/invoice/quote on accepte sans check existence — Spatie
     * QueryBuilder n'a pas de nested authorization native ici. Si besoin,
     * étendre le `match` ci-dessous.
     */
    private function ensureOwnerExists(string $ownerType, int $ownerId): void
    {
        $class = match ($ownerType) {
            'client' => Client::class,
            'employee' => Employee::class,
            'contract' => Contract::class,
            'invoice' => Invoice::class,
            'quote' => Quote::class,
            default => null,
        };
        if ($class) {
            abort_unless($class::find($ownerId), 404, 'Owner introuvable.');
        }
    }

    /**
     * Garantit que l'utilisateur courant a le droit d'accéder au owner cible.
     *  - admin/super_admin : passe sans contrôle
     *  - client extranet : doit être le portal_user du client cible (ou du
     *    parent client pour invoice/quote/contract)
     *  - intervenant : doit être lié à l'employee cible (ou l'employee
     *    propriétaire du contract). N'a pas accès aux invoice/quote/client.
     */
    private function ensureOwnerOwnership(Request $request, string $ownerType, int $ownerId): void
    {
        $user = $request->user();
        if ($user->hasRole('super_admin') || $user->hasRole('admin')) {
            return;
        }

        if ($user->hasRole('client')) {
            $clientId = $this->resolveClientIdFromOwner($ownerType, $ownerId);
            $client = $clientId ? Client::find($clientId) : null;
            if (! $client || $client->portal_user_id !== $user->id) {
                abort(403, 'Document hors de votre portail.');
            }
            return;
        }

        if ($user->hasRole('intervenant')) {
            // L'intervenant ne consulte ses docs RH qu'à travers son owner_type=employee
            if (! in_array($ownerType, ['employee', 'contract'], true)) {
                abort(403, 'Type de document non accessible depuis l\'extranet intervenant.');
            }
            $employeeId = $ownerType === 'employee'
                ? $ownerId
                : (Contract::find($ownerId)?->employee_id);
            $employee = $employeeId ? Employee::find($employeeId) : null;
            if (! $employee || $employee->user_id !== $user->id) {
                abort(403, 'Document hors de votre dossier.');
            }
            return;
        }

        // Tout autre rôle inconnu : refus
        abort(403, 'Rôle non autorisé.');
    }

    /**
     * Pour les owner_type qui sont des entités liées à un client (invoice,
     * quote, contract) → remonte au client_id. Pour `client` direct, renvoie
     * tel quel. Pour `employee` (rare ici, on l'a déjà filtré avant), null.
     */
    private function resolveClientIdFromOwner(string $ownerType, int $ownerId): ?int
    {
        return match ($ownerType) {
            'client' => $ownerId,
            'invoice' => Invoice::find($ownerId)?->client_id,
            'quote' => Quote::find($ownerId)?->client_id,
            default => null,
        };
    }

    private function isClientPortalUser(Request $request): bool
    {
        return $request->user()->hasRole('client');
    }

    /**
     * Sérialisation publique. ⚠️ On n'expose plus le `file_path` brut
     * (information disclosure facilitant l'attaque sur le disque public).
     */
    private function serialize(Document $d): array
    {
        return [
            'id' => $d->id,
            'owner_type' => $d->owner_type,
            'owner_id' => $d->owner_id,
            'label' => $d->label,
            'document_type' => $d->document_type,
            'is_client_visible' => (bool) $d->is_client_visible,
            'download_url' => "/api/v1/documents/{$d->id}/download",
            'size_kb' => $d->file_path && Storage::disk('local')->exists($d->file_path)
                ? round(Storage::disk('local')->size($d->file_path) / 1024)
                : null,
            'created_at' => $d->created_at?->toIso8601String(),
        ];
    }
}
