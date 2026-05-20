<?php

namespace App\Observers;

use App\Models\Message;
use App\Models\MessageThreadParticipant;
use App\Services\NotificationDispatcher;

/**
 * Observer Message — point d'émission unique pour les notifs de messagerie.
 *
 * Event couvert :
 *  - created → `new_message` : tous les participants du thread SAUF l'expéditeur.
 *
 * Avant : la notif était créée à la main dans MessagingController::postMessage
 * (bypass du NotificationDispatcher → pas de push/email, pas de respect des
 * préférences user). Désormais centralisée ici : toute création de Message,
 * quel que soit le chemin (controller, command, seeder…), déclenche la notif.
 *
 * target = le thread (morph 'message_thread') → deep-link cloche vers la
 * conversation.
 */
class MessageObserver
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function created(Message $message): void
    {
        $message->loadMissing(['thread', 'sender:id,name']);
        $thread = $message->thread;
        if (! $thread) return;

        // Tous les participants sauf l'expéditeur du message.
        $recipientIds = MessageThreadParticipant::where('thread_id', $message->thread_id)
            ->where('user_id', '!=', $message->sender_id)
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if (empty($recipientIds)) return;

        $senderName = $message->sender?->name ?? 'un utilisateur';
        $title = $thread->subject
            ? "Nouveau message · {$thread->subject}"
            : "Nouveau message de {$senderName}";

        $this->dispatcher->dispatch(
            code: 'new_message',
            userIds: $recipientIds,
            title: $title,
            body: mb_substr($message->body ?? '', 0, 120),
            target: $thread,
        );
    }
}
