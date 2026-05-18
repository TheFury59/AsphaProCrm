<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Votre accès au portail Aspha</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:40px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

                    {{-- HEADER avec gradient brand --}}
                    <tr>
                        <td style="background:linear-gradient(135deg,#10b981 0%,#0ea5e9 100%);padding:32px 32px 24px;color:#ffffff;">
                            <div style="font-size:13px;text-transform:uppercase;letter-spacing:1.5px;opacity:0.85;margin-bottom:8px;">Aspha Pro</div>
                            <div style="font-size:24px;font-weight:600;line-height:1.2;">Votre accès au portail client</div>
                        </td>
                    </tr>

                    {{-- BODY --}}
                    <tr>
                        <td style="padding:32px;">
                            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
                                Bonjour <strong>{{ $companyName }}</strong>,
                            </p>
                            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#444;">
                                Votre espace personnel sur le portail Aspha est désormais accessible.
                                Vous y retrouverez vos <strong>factures</strong>, <strong>devis</strong>,
                                <strong>prestations</strong>, et pourrez nous adresser vos demandes via le système de tickets.
                            </p>

                            {{-- IDENTIFIANTS --}}
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                                style="background:#f5f7fb;border-radius:12px;padding:20px;margin-bottom:24px;">
                                <tr>
                                    <td>
                                        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:6px;">Identifiant (email)</div>
                                        <div style="font-size:15px;font-family:ui-monospace,Menlo,Consolas,monospace;color:#111;margin-bottom:16px;font-weight:500;">{{ $email }}</div>

                                        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:6px;">Mot de passe temporaire</div>
                                        <div style="font-size:18px;font-family:ui-monospace,Menlo,Consolas,monospace;color:#111;letter-spacing:1px;font-weight:600;background:#fff;padding:10px 14px;border-radius:8px;display:inline-block;">{{ $password }}</div>
                                    </td>
                                </tr>
                            </table>

                            {{-- CTA --}}
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                                <tr>
                                    <td style="background:linear-gradient(135deg,#10b981 0%,#0ea5e9 100%);border-radius:10px;">
                                        <a href="{{ $loginUrl }}"
                                            style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">
                                            Accéder à mon portail →
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
                                <strong>Conseil de sécurité</strong> — Nous vous recommandons de changer votre mot de passe
                                lors de votre première connexion (fonctionnalité disponible bientôt dans votre profil).
                            </p>
                        </td>
                    </tr>

                    {{-- FOOTER --}}
                    <tr>
                        <td style="background:#fafbfc;padding:20px 32px;border-top:1px solid #eef0f3;font-size:12px;color:#6b7280;text-align:center;">
                            Cet email vous a été envoyé suite à la création de votre accès par l'équipe Aspha.
                            <br>Si vous n'êtes pas à l'origine de cette demande, contactez-nous.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
