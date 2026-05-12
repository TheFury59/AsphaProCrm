<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        return ['data' => Notification::where('user_id', $request->user()->id)
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
}
