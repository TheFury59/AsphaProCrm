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

    public function unreadCount(Request $request)
    {
        return ['count' => Notification::where('user_id', $request->user()->id)
            ->where('is_read', false)
            ->count()];
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
