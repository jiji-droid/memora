/**
 * MEMORA — Service d'extraction de texte
 *
 * Extrait le contenu textuel de différents types de fichiers :
 * - PDF → pdf-parse
 * - DOCX → mammoth
 * - TXT/Markdown → Buffer.toString()
 *
 * Utilisé pour les sources de type 'document' et 'upload'.
 * Le texte extrait est ensuite indexé dans Qdrant.
 *
 * Fonction exportée :
 * - extraireTexte(contenu, mimeType) → texte ou null
 */

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// ============================================
// Types MIME supportés pour l'extraction
// ============================================
const TYPES_PDF = ['application/pdf'];
const TYPES_DOCX = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
];
const TYPES_TEXTE = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html'
];

/**
 * Extrait le texte d'un fichier selon son type MIME
 *
 * @param {Buffer} contenu - Le contenu brut du fichier (Buffer)
 * @param {string} mimeType - Le type MIME du fichier
 * @returns {Promise<string|null>} Le texte extrait, ou null si le type n'est pas supporté
 */
async function extraireTexte(contenu, mimeType) {
  if (!contenu || !mimeType) {
    return null;
  }

  const typeLower = mimeType.toLowerCase();

  try {
    // ============================================
    // PDF → pdf-parse
    // ============================================
    if (TYPES_PDF.includes(typeLower)) {
      const resultat = await pdfParse(contenu);
      const texte = resultat.text ? resultat.text.trim() : '';

      if (texte.length === 0) {
        console.log('[Extraction] PDF extrait mais vide (possible PDF scanné/image)');
        return null;
      }

      console.log(`[Extraction] PDF extrait : ${texte.length} caractères, ${resultat.numpages} pages`);
      return texte;
    }

    // ============================================
    // DOCX → mammoth (extraction texte brut)
    // ============================================
    if (TYPES_DOCX.includes(typeLower)) {
      const resultat = await mammoth.extractRawText({ buffer: contenu });
      const texte = resultat.value ? resultat.value.trim() : '';

      if (texte.length === 0) {
        console.log('[Extraction] DOCX extrait mais vide');
        return null;
      }

      // Afficher les avertissements mammoth s'il y en a
      if (resultat.messages && resultat.messages.length > 0) {
        console.log(`[Extraction] DOCX : ${resultat.messages.length} avertissement(s) mammoth`);
      }

      console.log(`[Extraction] DOCX extrait : ${texte.length} caractères`);
      return texte;
    }

    // ============================================
    // Texte brut / Markdown / CSV / HTML
    // ============================================
    if (TYPES_TEXTE.includes(typeLower)) {
      const texte = contenu.toString('utf-8').trim();

      if (texte.length === 0) {
        console.log('[Extraction] Fichier texte vide');
        return null;
      }

      console.log(`[Extraction] Texte extrait : ${texte.length} caractères`);
      return texte;
    }

    // ============================================
    // Type non supporté
    // ============================================
    console.log(`[Extraction] Type MIME non supporté pour l'extraction : ${mimeType}`);
    return null;

  } catch (erreur) {
    console.error(`[Extraction] Erreur extraction (${mimeType}) :`, erreur.message);
    return null;
  }
}

/**
 * Vérifie si un type MIME est supporté pour l'extraction de texte
 *
 * @param {string} mimeType - Le type MIME à vérifier
 * @returns {boolean} true si le type est supporté
 */
function estExtractible(mimeType) {
  if (!mimeType) return false;
  const typeLower = mimeType.toLowerCase();
  return (
    TYPES_PDF.includes(typeLower) ||
    TYPES_DOCX.includes(typeLower) ||
    TYPES_TEXTE.includes(typeLower)
  );
}

module.exports = {
  extraireTexte,
  estExtractible
};
