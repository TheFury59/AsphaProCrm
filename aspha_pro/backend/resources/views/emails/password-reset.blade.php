<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Réinitialisation de votre mot de passe</title>
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
                            <div style="font-size:24px;font-weight:600;line-height:1.2;">Réinitialisation de votre mot de passe</div>
                        </td>
                    </tr>

                    {{-- BODY --}}
                    <tr>
                        <td style="padding:32px;">
                            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
                                Bonjour <strong>{{ $userName }}</strong>,
                            </p>
                            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#444;">
                                Vous avez demandé la réinitialisation de votre mot de passe sur Aspha Pro.
                                Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
                            </p>

                            {{-- CTA --}}
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                                <tr>
                                    <td style="background:linear-gradient(135deg,#10b981 0%,#0ea5e9 100%);border-radius:10px;">
                                        <a href="{{ $resetUrl }}"
                                            style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">
                                            Réinitialiser mon mot de passe →
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            {{-- LIEN BRUT (si le bouton ne fonctionne pas) --}}
                            <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#6b7280;">
                                Si le bouton ne fonctionne pas, copie-colle ce lien dans ton navigateur :
                                <br>
                                <a href="{{ $resetUrl }}" style="color:#10b981;word-break:break-all;font-size:12px;">{{ $resetUrl }}</a>
                            </p>

                            {{-- WARNING expiration --}}
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                                style="background:#fef9c3;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 18px;margin-bottom:16px;">
                                <tr>
                                    <td style="font-size:13px;line-height:1.6;color:#854d0e;">
                                        <strong>⏰ Lien valable {{ $expiresInMinutes }} minutes.</strong>
                                        Au-delà, vous devrez refaire une demande depuis l'écran de connexion.
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
                                Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email —
                                votre mot de passe actuel reste valide.
                            </p>
                        </td>
                    </tr>

                    {{-- FOOTER --}}
                    <tr>
                        <td style="background:#fafbfc;padding:20px 32px;border-top:1px solid #eef0f3;font-size:12px;color:#6b7280;text-align:center;">
                            Email envoyé automatiquement par Aspha Pro.
                            <br>Pour toute question, contactez votre administrateur.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
