module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "react" }]],
    plugins: [
      // SDK 54 + Reanimated 4 : le plugin babel n'est plus nécessaire
      // (Reanimated 4 utilise un Metro transformer). On garde la liste
      // de plugins vide pour permettre un ajout futur sans réécrire.
    ],
  };
};
