<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\NotificationPreference;
use App\Models\NotificationType;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        return ['data' => Notification::where('user_id', $request->user()->id)
            ->with('notificationType:id,code,label,module')
            ->orderByDesc('id')
            ->limit(50)
            ->get()];
    }

    /**
     * Centre de notifications — historique paginé et filtrable.
     *
     * Endpoint SÉPARÉ de `index` (qui sert la cloche, limitée à 50 sans
     * pagination) pour ne pas casser le comportement existant.
     *
     * Filtres optionnels via query params :
     *  - `status` : 'read' | 'unread'
     *  - `type`   : code de notification_type (ex. 'new_message')
     *  - `search` : recherche texte sur le titre OU le corps
     *  - `per_page` : taille de page (défaut 25, max 100)
     */
    public function history(Request $request)
    {
        $perPage = (int) $request->query('per_page', 25);
        $perPage = max(1, min(100, $perPage));

        $query = Notification::where('user_id', $request->user()->id)
            ->with('notificationType:id,code,label,module')
            ->orderByDesc('id');

        $status = $request->query('status');
        if ($status === 'read') {
            $query->where('is_read', true);
        } elseif ($status === 'unread') {
            $query->where('is_read', false);
        }

        if ($code = $request->query('type')) {
            $query->whereHas('notificationType', fn ($q) => $q->where('code', $code));
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('body', 'like', "%{$search}%");
            });
        }

        return $query->paginate($perPage);
    }

    /**
     * Référentiel léger des types de notification actifs — alimente le
     * sélecteur de filtre du Centre de notifications.
     */
    public function types()
    {
        return ['data' => NotificationType::where('status', 'active')
            ->orderBy('module')
            ->orderBy('label')
            ->get(['id', 'code', 'label', 'module'])];
    }

    public function unreadCount(Request $request)
    {
        return ['count' => Notification::where('user_id', $request->user()->id)
            ->where('is_read', false)
            ->count()];
    }

    /**
     * GET /api/v1/notifications/unread-count-by-module
     *
     * Renvoie le nombre de notifications NON LUES groupées par module
     * (`planning`, `portal`, `messaging`, `sales`, `telemanagement`,
     * `stock`, `documents`, `missions`, `rh`, `matching`).
     *
     * Utilisé par la sidebar côté frontend pour afficher des badges
     * de comptage à côté de chaque onglet (cf. AppLayout).
     *
     * Réponse :
     *   { "data": { "portal": 3, "messaging": 1, "sales": 2, ... } }
     */
    public function unreadCountByModule(Request $request)
    {
        $rows = Notification::query()
            ->join('notification_types', 'notifications.notification_type_id', '=', 'notification_types.id')
            ->where('notifications.user_id', $request->user()->id)
            ->where('notifications.is_read', false)
            ->selectRaw('notification_types.module as module, COUNT(*) as count')
            ->groupBy('notification_types.module')
            ->pluck('count', 'module')
            ->map(fn ($v) => (int) $v);

        return ['data' => $rows];
    }

    public function markRead(Request $request, Notification $notification)
    {
        abort_unless($notification->user_id === $request->user()->id, 403);
        $notification->update(['is_read' => true, 'read_at' => now()]);
        return ['data' => $notification];
    }

    public function markAllRead(Request $request)
    {
        Notification::where('user_id', $request->user()->id)
            ->where('is_read', false)
            ->update(['is_read' => true, 'read_at' => now()]);
        return ['data' => ['marked' => true]];
    }

    /**
     * Récupère les préférences de notification de l'utilisateur courant.
     * Si un type n'a pas encore de préférence, on renvoie les default_channels du type.
     */
    public function listPreferences(Request $request)
    {
        $userId = $request->user()->id;
        $types = NotificationType::where('status', 'active')->orderBy('module')->orderBy('label')->get();
        $prefs = NotificationPreference::where('user_id', $userId)->get()->keyBy('notification_type_id');

        return ['data' => $types->map(function ($type) use ($prefs) {
            $pref = $prefs->get($type->id);
            $defaults = $pref ? null : array_map('trim', explode(',', $type->default_channels ?? ''));
            return [
                'type' => $type,
                'preference' => $pref ?: [
                    'notification_type_id' => $type->id,
                    'is_enabled' => true,
                    'via_push' => in_array('push', $defaults ?? [], true),
                    'via_email' => in_array('email', $defaults ?? [], true),
                ],
            ];
        })];
    }

    public function updatePreference(Request $request, int $typeId)
    {
        $data = $request->validate([
            'is_enabled' => ['boolean'],
            'via_push' => ['boolean'],
            'via_email' => ['boolean'],
        ]);
        $pref = NotificationPreference::updateOrCreate(
            ['user_id' => $request->user()->id, 'notification_type_id' => $typeId],
            $data,
        );
        return ['data' => $pref];
    }
}
