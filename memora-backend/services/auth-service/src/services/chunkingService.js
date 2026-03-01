/**
 * MEMORA — Service de découpage de texte (chunking)
 *
 * Découpe un texte long en morceaux (chunks) de taille optimale
 * pour l'indexation sémantique dans Qdrant.
 *
 * Stratégie :
 * - Taille cible : 500 caractères par chunk
 * - Overlap : 50 caractères entre les chunks (pour garder le contexte)
 * - Découpe intelligente : coupe sur les fins de phrases (. ! ?) quand possible
 *
 * Fonction exportée :
 * - decouper(texte, metadata) → [{ texte, metadata, position }]
 */

// ============================================
// Configuration
// ============================================
const TAILLE_CHUNK = 500;
const OVERLAP = 50;

/**
 * Trouve la meilleure position de coupure dans un texte
 * Cherche la fin de phrase (. ! ?) la plus proche de la position cible
 *
 * @param {string} texte - Le texte à analyser
 * @param {number} positionCible - Position souhaitée de la coupure
 * @param {number} margeRecherche - Zone de recherche autour de la position cible
 * @returns {number} Position optimale de coupure
 */
function trouverCoupure(texte, positionCible, margeRecherche = 100) {
  // Si le texte est plus court que la cible, retourner la fin
  if (texte.length <= positionCible) {
    return texte.length;
  }

  // Chercher la fin de phrase la plus proche de la position cible
  const debutRecherche = Math.max(0, positionCible - margeRecherche);
  const finRecherche = Math.min(texte.length, positionCible + margeRecherche);
  const zoneRecherche = texte.substring(debutRecherche, finRecherche);

  // Chercher les fins de phrases dans la zone de recherche
  let meilleurePosition = -1;
  let distanceMinimale = Infinity;

  const marqueursFin = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];

  for (const marqueur of marqueursFin) {
    let index = 0;
    while ((index = zoneRecherche.indexOf(marqueur, index)) !== -1) {
      const positionAbsolue = debutRecherche + index + marqueur.length;
      const distance = Math.abs(positionAbsolue - positionCible);

      if (distance < distanceMinimale) {
        distanceMinimale = distance;
        meilleurePosition = positionAbsolue;
      }
      index += 1;
    }
  }

  // Si aucune fin de phrase trouvée, couper sur un espace
  if (meilleurePosition === -1) {
    const espaceAvant = texte.lastIndexOf(' ', positionCible);
    if (espaceAvant > positionCible - margeRecherche && espaceAvant > 0) {
      return espaceAvant + 1;
    }
    // En dernier recours, couper à la position cible
    return positionCible;
  }

  return meilleurePosition;
}

/**
 * Découpe un texte en chunks avec métadonnées
 *
 * @param {string} texte - Le texte à découper
 * @param {Object} metadata - Métadonnées à attacher à chaque chunk
 * @param {number} metadata.sourceId - ID de la source
 * @param {number} metadata.spaceId - ID de l'espace
 * @param {string} metadata.type - Type de source (text, meeting, voice_note, document, upload)
 * @param {string} metadata.nom - Nom de la source
 * @returns {Array<{texte: string, metadata: Object, position: number}>} Tableau de chunks
 */
function decouper(texte, metadata) {
  // Valider les entrées
  if (!texte || texte.trim().length === 0) {
    return [];
  }

  if (!metadata || !metadata.sourceId || !metadata.spaceId) {
    throw new Error('Les métadonnées sourceId et spaceId sont requises pour le découpage');
  }

  const texteNettoye = texte.trim();

  // Si le texte est plus court que la taille cible, retourner un seul chunk
  if (texteNettoye.length <= TAILLE_CHUNK) {
    return [{
      texte: texteNettoye,
      metadata: { ...metadata },
      position: 0
    }];
  }

  const chunks = [];
  let debut = 0;
  let position = 0;

  while (debut < texteNettoye.length) {
    // Déterminer la fin du chunk
    const finEstimee = debut + TAILLE_CHUNK;

    // Trouver la meilleure position de coupure
    const finReelle = trouverCoupure(texteNettoye, finEstimee);

    // Extraire le chunk
    const texteChunk = texteNettoye.substring(debut, finReelle).trim();

    // Ajouter seulement si le chunk n'est pas vide
    if (texteChunk.length > 0) {
      chunks.push({
        texte: texteChunk,
        metadata: { ...metadata },
        position
      });
      position++;
    }

    // Avancer avec overlap (reculer de OVERLAP caractères pour garder le contexte)
    debut = Math.max(debut + 1, finReelle - OVERLAP);

    // Sécurité : éviter les boucles infinies
    if (debut >= texteNettoye.length) break;
  }

  return chunks;
}

module.exports = {
  decouper,
  TAILLE_CHUNK,
  OVERLAP
};
