// Code Tool n8n — "Chercher dans Memora"
// À coller dans le node Code Tool du workflow GEST-016-v9-Agent-Telegram

const API_URL = 'http://localhost:3001';
const API_KEY = $env.MEMORA_API_KEY;

const query = $input.item.json.query;
const spaceId = $input.item.json.spaceId;

try {
  if (spaceId) {
    const response = await fetch(
      `${API_URL}/spaces/${spaceId}/search?q=${encodeURIComponent(query)}&limit=5`,
      { headers: { 'X-API-KEY': API_KEY } }
    );
    const data = await response.json();

    if (!data.success || !data.data?.results?.length) {
      return [{ json: { resultat: `Aucun résultat trouvé dans l'espace ${spaceId} pour "${query}".` } }];
    }

    const resultats = data.data.results.map((r, i) =>
      `${i + 1}. [${r.nom}] (score: ${Math.round(r.score * 100)}%) — ${r.texte.substring(0, 200)}...`
    ).join('\n');

    return [{ json: { resultat: `Résultats Memora :\n\n${resultats}` } }];

  } else {
    const spacesRes = await fetch(`${API_URL}/spaces`, {
      headers: { 'X-API-KEY': API_KEY }
    });
    const spacesData = await spacesRes.json();

    if (!spacesData.data?.spaces?.length) {
      return [{ json: { resultat: 'Aucun espace Memora trouvé.' } }];
    }

    let tousResultats = [];
    for (const space of spacesData.data.spaces.slice(0, 5)) {
      try {
        const searchRes = await fetch(
          `${API_URL}/spaces/${space.id}/search?q=${encodeURIComponent(query)}&limit=3`,
          { headers: { 'X-API-KEY': API_KEY } }
        );
        const searchData = await searchRes.json();
        if (searchData.data?.results?.length) {
          for (const r of searchData.data.results) {
            tousResultats.push({
              espace: space.nom,
              source: r.nom,
              score: r.score,
              extrait: r.texte.substring(0, 200)
            });
          }
        }
      } catch (e) { }
    }

    if (tousResultats.length === 0) {
      return [{ json: { resultat: `Aucun résultat Memora pour "${query}".` } }];
    }

    tousResultats.sort((a, b) => b.score - a.score);
    const top = tousResultats.slice(0, 5);

    const formatted = top.map((r, i) =>
      `${i + 1}. [${r.espace} > ${r.source}] (${Math.round(r.score * 100)}%) — ${r.extrait}...`
    ).join('\n');

    return [{ json: { resultat: `Top résultats Memora :\n\n${formatted}` } }];
  }
} catch (error) {
  return [{ json: { resultat: `Erreur Memora : ${error.message}` } }];
}
