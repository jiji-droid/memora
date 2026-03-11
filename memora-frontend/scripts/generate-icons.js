/**
 * Génération des icônes PWA à partir du SVG source.
 * Utilise sharp pour convertir le SVG en PNG aux tailles requises.
 *
 * Usage : node scripts/generate-icons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DOSSIER_PUBLIC = path.join(__dirname, '..', 'public');
const DOSSIER_ICONES = path.join(DOSSIER_PUBLIC, 'icons');
const FICHIER_SVG = path.join(DOSSIER_PUBLIC, 'icon.svg');

async function genererIcones() {
  // Créer le dossier icons/ s'il n'existe pas
  if (!fs.existsSync(DOSSIER_ICONES)) {
    fs.mkdirSync(DOSSIER_ICONES, { recursive: true });
    console.log('Dossier icons/ créé');
  }

  const svgBuffer = fs.readFileSync(FICHIER_SVG);
  console.log('SVG source lu :', FICHIER_SVG);

  // 1. Icône 192x192 (PWA standard)
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(DOSSIER_ICONES, 'icon-192x192.png'));
  console.log('Généré : icons/icon-192x192.png');

  // 2. Icône 512x512 (PWA standard)
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(DOSSIER_ICONES, 'icon-512x512.png'));
  console.log('Généré : icons/icon-512x512.png');

  // 3. Apple Touch Icon 180x180
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(DOSSIER_ICONES, 'apple-touch-icon.png'));
  console.log('Généré : icons/apple-touch-icon.png');

  // 4. Icône maskable 512x512 (avec padding 20% pour zone safe)
  // On génère d'abord l'icône à 80% de la taille, puis on l'incruste sur un fond coloré
  const tailleInterne = Math.round(512 * 0.8); // 410px (80% de 512)
  const padding = Math.round((512 - tailleInterne) / 2); // 51px de chaque côté

  const iconeInterne = await sharp(svgBuffer)
    .resize(tailleInterne, tailleInterne)
    .png()
    .toBuffer();

  // Fond bleu Gestimatech pour l'icône maskable
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 9, g: 48, b: 126, alpha: 1 }, // #09307e
    },
  })
    .composite([{
      input: iconeInterne,
      top: padding,
      left: padding,
    }])
    .png()
    .toFile(path.join(DOSSIER_ICONES, 'maskable-icon-512x512.png'));
  console.log('Généré : icons/maskable-icon-512x512.png');

  console.log('\nToutes les icônes ont été générées avec succès.');
}

genererIcones().catch((erreur) => {
  console.error('Erreur lors de la génération des icônes :', erreur);
  process.exit(1);
});
