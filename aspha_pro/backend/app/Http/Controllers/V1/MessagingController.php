<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Message;
use App\Models\MessageThread;
use App\Models\MessageThreadParticipant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Messagerie interne — threads + messages + participants.
 *
 * Modèle simple : un thread (direct, group, telemanagement) a N participants
 * (table pivot avec last_read_at) et N messages. Le nombre de messages non lus
 * d'un thread est calculé via comparaison messages.sent_at > participant.last_read_at.
 *
 * Permission policy minimale : seuls les participants du thread peuvent
 * lire/poster. Pas d'admin override (faut être dans le thread).
 */
class MessagingController extends Controller
{
    /**
     * Liste les threads où l'utilisateur courant est participant,
     * avec le dernier message et le nb de messages non lus.
     */
    public function index(Request $request)
    {
        $userId = $request->user()->id;

        $threads = MessageThread::query()
            ->whereIn('id', function ($q) use ($userId) {
                $q->select('thread_id')
                    ->from('message_thread_participants')
                    ->where('user_id', $userId);
            })
            ->with(['createdBy:id,name', 'messages' => fn ($q) => $q->latest('sent_at')->limit(1)])
            ->withCount('messages')
            ->orderByDesc('id')
            ->get()
            ->map(function ($t) use ($userId) {
                $participant = MessageThreadParticipant::where('thread_id', $t->id)
                    ->where('user_id', $userId)
                    ->first();
                $lastRead = $participant?->last_read_at;
                $unread = Message::where('thread_id', $t->id)
                    ->when($lastRead, fn ($q) => $q->where('sent_at', '>', $lastRead))
                    ->where('sender_id', '!=', $userId)
                    ->count();
                return [
                    'id' => $t->id,
                    'subject' => $t->subject,
                    'type' => $t->type,
                    'created_at' => $t->created_at,
                    'last_message' => $t->messages->first(),
                    'messages_count' => $t->messages_count,
                    'unread_count' => $unread,
                    'created_by' => $t->createdBy,
                ];
            });

        return ['data' => $threads];
    }

    /**
     * Détail d'un thread : participants + messages (paginé inverse).
     */
    public function show(Request $request, MessageThread $thread)
    {
        $this->ensureParticipant($request, $thread);

        $thread->load([
            'messageThreadParticipants.user:id,name,email',
            'createdBy:id,name',
        ]);

        $messages = $thread->messages()
            ->with('sender:id,name')
            ->orderByDesc('sent_at')
            ->paginate(50);

        return [
            'data' => [
                'thread' => $thread,
                'messages' => $messages,
            ],
        ];
    }

    /**
     * Crée un thread + ajoute les participants (+ user courant).
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'subject' => ['nullable', 'string', 'max:255'],
            'type' => ['required', 'in:direct,group,telemanagement'],
            'entity_id' => ['nullable', 'exists:entities,id'],
            'participant_ids' => ['required', 'array', 'min:1'],
            'participant_ids.*' => ['integer', 'exists:users,id'],
            'initial_message' => ['nullable', 'string'],
        ]);

        $userId = $request->user()->id;

        return DB::transaction(function () use ($data, $userId) {
            $thread = MessageThread::create([
                'subject' => $data['subject'] ?? null,
                'type' => $data['type'],
                'entity_id' => $data['entity_id'] ?? null,
                'created_by' => $userId,
            ]);

            $participants = collect($data['participant_ids'])->push($userId)->unique();
            foreach ($participants as $uid) {
                MessageThreadParticipant::create([
                    'thread_id' => $thread->id,
                    'user_id' => $uid,
                    'joined_at' => now(),
                    'last_read_at' => $uid === $userId ? now() : null,
                ]);
            }

            if (! empty($data['initial_message'])) {
                Message::create([
                    'thread_id' => $thread->id,
                    'sender_id' => $userId,
                    'body' => $data['initial_message'],
                    'sent_at' => now(),
                ]);
            }

            return response()->json(['data' => $thread->load('messageThreadParticipants.user', 'messages')], 201);
        });
    }

    /**
     * Poste un message dans un thread.
     */
    public function postMessage(Request $request, MessageThread $thread)
    {
        $this->ensureParticipant($request, $thread);

        $data = $request->validate([
            'body' => ['required', 'string'],
        ]);

        $message = Message::create([
            'thread_id' => $thread->id,
            'sender_id' => $request->user()->id,
            'body' => $data['body'],
            'sent_at' => now(),
        ]);

        // Auto-mark as read pour l'expéditeur
        MessageThreadParticipant::where('thread_id', $thread->id)
            ->where('user_id', $request->user()->id)
            ->update(['last_read_at' => now()]);

        return response()->json(['data' => $message->load('sender:id,name')], 201);
    }

    /**
     * Marque le thread comme lu pour l'utilisateur courant.
     */
    public function markRead(Request $request, MessageThread $thread)
    {
        $this->ensureParticipant($request, $thread);
        MessageThreadParticipant::where('thread_id', $thread->id)
            ->where('user_id', $request->user()->id)
            ->update(['last_read_at' => now()]);
        return ['data' => ['marked' => true]];
    }

    /**
     * Total non lus toutes conversations (pour badge topbar).
     */
    public function totalUnread(Request $request)
    {
        $userId = $request->user()->id;
        $participants = MessageThreadParticipant::where('user_id', $userId)->get();
        $total = 0;
        foreach ($participants as $p) {
            $total += Message::where('thread_id', $p->thread_id)
                ->when($p->last_read_at, fn ($q) => $q->where('sent_at', '>', $p->last_read_at))
                ->where('sender_id', '!=', $userId)
                ->count();
        }
        return ['count' => $total];
    }

    private function ensureParticipant(Request $request, MessageThread $thread): void
    {
        $isParticipant = MessageThreadParticipant::where('thread_id', $thread->id)
            ->where('user_id', $request->user()->id)
            ->exists();
        abort_unless($isParticipant, 403, 'Vous ne participez pas à cette conversation.');
    }
}
