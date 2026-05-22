<?php

// 2026-05-20 PDF B2B — constantes société pour la génération PDF devis/factures.
// Ces valeurs alimentent le pied de page légal + les fallbacks d'en-tête quand
// l'Entity ne porte pas l'information (l'Entity n'a que name/phone/email/siret).
return [

    // Pied de page légal présent sur toutes les pages des devis et factures.
    'company' => [
        'legal_name' => env('ASPHA_LEGAL_NAME', 'ASPHA Services'),
        'legal_form' => env('ASPHA_LEGAL_FORM', 'SARL au capital de 7 500 €'),
        'head_office' => env('ASPHA_HEAD_OFFICE', '233 rue Morel, 59500 Douai, France'),
        'siret' => env('ASPHA_SIRET', '000 000 000 00000'),
        'vat_number' => env('ASPHA_VAT_NUMBER', ''),
        'rcs' => env('ASPHA_RCS', 'RCS de DOUAI'),
        'website' => env('ASPHA_WEBSITE', 'www.aspha-services.fr'),
    ],

    // Fallback d'adresse d'agence affichée dans l'en-tête gauche quand aucune
    // adresse n'est rattachée à l'Entity. Adresse du siège par défaut.
    'agency_address_fallback' => env('ASPHA_AGENCY_ADDRESS', '233 rue Morel'),
    'agency_postal_city_fallback' => env('ASPHA_AGENCY_POSTAL_CITY', '59500 Douai'),

    // Mentions légales paramétrables.
    'agreement_number' => env('ASPHA_AGREEMENT_NUMBER', ''),     // N° Agrément (devis)
    'authorization_number' => env('ASPHA_AUTHORIZATION_NUMBER', ''), // N° Autorisation SAP (facture)

    // Modes de règlement acceptés (affichés en bas du devis).
    'payment_methods' => env('ASPHA_PAYMENT_METHODS', 'chèque, virement bancaire, prélèvement SEPA'),
];
