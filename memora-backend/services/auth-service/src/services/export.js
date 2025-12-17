/**
 * Service d'export PDF et DOCX pour Memora
 * Génère des documents à partir des transcriptions et résumés
 */

const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } = require('docx');
const fs = require('fs');
const path = require('path');

// Dossier pour les exports temporaires
const EXPORTS_DIR = path.join(__dirname, '..', 'exports');

// Créer le dossier s'il n'existe pas
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

/**
 * Formate une date en français
 */
function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Extrait le texte brut d'un contenu (peut être string, objet, ou autre)
 */
function extractText(content) {
  if (!content) return '';
  
  // Si c'est déjà une string
  if (typeof content === 'string') {
    return content;
  }
  
  // Si c'est un objet avec une propriété 'text' ou 'content'
  if (typeof content === 'object') {
    if (content.text) return extractText(content.text);
    if (content.content) return extractText(content.content);
    if (content.transcript) return extractText(content.transcript);
    
    // Si c'est un tableau, joindre les éléments
    if (Array.isArray(content)) {
      return content.map(item => extractText(item)).join('\n');
    }
    
    // Sinon, essayer de convertir en JSON lisible
    try {
      return JSON.stringify(content, null, 2);
    } catch (e) {
      return String(content);
    }
  }
  
  return String(content);
}

/**
 * Parse les sections d'un résumé
 */
function parseSections(sections) {
  if (!sections) return null;
  
  try {
    const parsed = typeof sections === 'string' ? JSON.parse(sections) : sections;
    
    if (typeof parsed !== 'object' || parsed === null) return null;
    
    // Convertir chaque valeur en texte
    const result = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) {
        result[key] = value.map(item => {
          if (typeof item === 'object') {
            // Pour les actionItems qui ont une structure {task, assignee, deadline}
            if (item.task) {
              let text = item.task;
              if (item.assignee) text += ` (${item.assignee})`;
              if (item.deadline) text += ` - ${item.deadline}`;
              return text;
            }
            return JSON.stringify(item);
          }
          return String(item);
        }).join('\n- ');
      } else {
        result[key] = extractText(value);
      }
    }
    return result;
  } catch (e) {
    return null;
  }
}

/**
 * Génère un PDF à partir d'une transcription ou résumé
 */
async function generatePDF(meeting, content, type = 'transcript') {
  return new Promise((resolve, reject) => {
    const filename = `memora-${type}-${meeting.id}-${Date.now()}.pdf`;
    const filepath = path.join(EXPORTS_DIR, filename);
    
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `${meeting.title} - ${type === 'transcript' ? 'Transcription' : 'Resume'}`,
        Author: 'Memora',
        Subject: meeting.title,
        Creator: 'Memora - Assistant de reunions IA'
      }
    });

    const writeStream = fs.createWriteStream(filepath);
    doc.pipe(writeStream);

    // Couleurs Memora
    const primaryColor = '#0891B2'; // Cyan
    const secondaryColor = '#7C3AED'; // Violet
    const textColor = '#1F2937';
    const lightGray = '#9CA3AF';

    // En-tête
    doc.fontSize(24)
       .fillColor(primaryColor)
       .text('Memora', 50, 50);
    
    doc.fontSize(10)
       .fillColor(lightGray)
       .text('Assistant de reunions IA', 50, 80);

    // Ligne de séparation
    doc.moveTo(50, 100)
       .lineTo(545, 100)
       .strokeColor(primaryColor)
       .lineWidth(2)
       .stroke();

    // Titre de la réunion
    doc.moveDown(2);
    doc.fontSize(18)
       .fillColor(textColor)
       .text(meeting.title, { align: 'center' });

    // Badge du type
    const badgeText = type === 'transcript' ? 'Transcription' : 'Resume';
    doc.fontSize(12)
       .fillColor(secondaryColor)
       .text(badgeText, { align: 'center' });

    // Métadonnées
    doc.moveDown(1);
    doc.fontSize(10)
       .fillColor(lightGray);
    
    if (meeting.meeting_date) {
      doc.text(formatDate(meeting.meeting_date), { align: 'center' });
    }
    if (meeting.platform) {
      doc.text(meeting.platform, { align: 'center' });
    }
    if (meeting.participants && meeting.participants.length > 0) {
      doc.text(meeting.participants.join(', '), { align: 'center' });
    }

    // Ligne de séparation
    doc.moveDown(1);
    doc.moveTo(100, doc.y)
       .lineTo(495, doc.y)
       .strokeColor(lightGray)
       .lineWidth(0.5)
       .stroke();

    // Contenu principal
    doc.moveDown(2);
    doc.fontSize(11)
       .fillColor(textColor);

    if (type === 'transcript') {
      // Transcription - extraire le texte correctement
      const text = extractText(content);
      doc.text(text, {
        align: 'justify',
        lineGap: 4
      });
    } else {
      // Résumé avec sections
      const mainContent = extractText(content.content || content);
      if (mainContent && mainContent !== '[object Object]') {
        doc.fontSize(12)
           .fillColor(primaryColor)
           .text('Resume', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11)
           .fillColor(textColor)
           .text(mainContent, { align: 'justify', lineGap: 4 });
      }

      const sections = parseSections(content.sections);
      if (sections) {
        for (const [title, text] of Object.entries(sections)) {
          if (text && text.trim()) {
            doc.moveDown(1);
            doc.fontSize(12)
               .fillColor(primaryColor)
               .text(title, { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(11)
               .fillColor(textColor)
               .text(text, { align: 'justify', lineGap: 4 });
          }
        }
      }
    }

    // Pied de page
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8)
         .fillColor(lightGray)
         .text(
           `Genere par Memora - Page ${i + 1}/${pageCount}`,
           50,
           doc.page.height - 30,
           { align: 'center', width: doc.page.width - 100 }
         );
    }

    doc.end();

    writeStream.on('finish', () => {
      resolve({ filepath, filename });
    });

    writeStream.on('error', reject);
  });
}

/**
 * Génère un DOCX à partir d'une transcription ou résumé
 */
async function generateDOCX(meeting, content, type = 'transcript') {
  const filename = `memora-${type}-${meeting.id}-${Date.now()}.docx`;
  const filepath = path.join(EXPORTS_DIR, filename);

  const children = [];

  // Titre principal
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Memora',
          bold: true,
          size: 36,
          color: '0891B2'
        })
      ],
      spacing: { after: 100 }
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Assistant de reunions IA',
          size: 20,
          color: '9CA3AF'
        })
      ],
      spacing: { after: 400 }
    })
  );

  // Titre de la réunion
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: meeting.title,
          bold: true,
          size: 32
        })
      ],
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    })
  );

  // Badge type
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: type === 'transcript' ? 'Transcription' : 'Resume',
          size: 24,
          color: '7C3AED'
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    })
  );

  // Métadonnées
  if (meeting.meeting_date) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: formatDate(meeting.meeting_date),
            size: 20,
            color: '6B7280'
          })
        ],
        alignment: AlignmentType.CENTER
      })
    );
  }

  if (meeting.platform) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: meeting.platform,
            size: 20,
            color: '6B7280'
          })
        ],
        alignment: AlignmentType.CENTER
      })
    );
  }

  // Ligne de séparation visuelle
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '' })],
      spacing: { after: 400 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E5E7EB' }
      }
    })
  );

  // Contenu
  if (type === 'transcript') {
    // Transcription - extraire le texte correctement
    const text = extractText(content);
    const paragraphs = text.split('\n\n');
    
    paragraphs.forEach(para => {
      if (para.trim()) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: para.trim(),
                size: 22
              })
            ],
            spacing: { after: 200 }
          })
        );
      }
    });
  } else {
    // Résumé
    const mainContent = extractText(content.content || content);
    if (mainContent && mainContent !== '[object Object]') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Resume',
              bold: true,
              size: 26,
              color: '0891B2'
            })
          ],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 200 }
        })
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: mainContent,
              size: 22
            })
          ],
          spacing: { after: 200 }
        })
      );
    }

    const sections = parseSections(content.sections);
    if (sections) {
      for (const [title, text] of Object.entries(sections)) {
        if (text && text.trim()) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: title,
                  bold: true,
                  size: 26,
                  color: '0891B2'
                })
              ],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 200 }
            })
          );

          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: text,
                  size: 22
                })
              ],
              spacing: { after: 200 }
            })
          );
        }
      }
    }
  }

  // Pied de page
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '' })],
      spacing: { before: 600 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 6, color: 'E5E7EB' }
      }
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Genere par Memora - ${new Date().toLocaleDateString('fr-FR')}`,
          size: 18,
          color: '9CA3AF'
        })
      ],
      alignment: AlignmentType.CENTER
    })
  );

  const docxDocument = new Document({
    sections: [{
      properties: {},
      children: children
    }]
  });

  const buffer = await Packer.toBuffer(docxDocument);
  fs.writeFileSync(filepath, buffer);

  return { filepath, filename };
}

/**
 * Nettoie les anciens fichiers d'export (> 1 heure)
 */
function cleanupExports() {
  const ONE_HOUR = 60 * 60 * 1000;
  const now = Date.now();

  try {
    const files = fs.readdirSync(EXPORTS_DIR);
    files.forEach(file => {
      const filePath = path.join(EXPORTS_DIR, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > ONE_HOUR) {
        fs.unlinkSync(filePath);
      }
    });
  } catch (error) {
    console.error('Erreur cleanup exports:', error);
  }
}

// Nettoyer toutes les heures
setInterval(cleanupExports, 60 * 60 * 1000);

module.exports = {
  generatePDF,
  generateDOCX,
  cleanupExports,
  EXPORTS_DIR
};
