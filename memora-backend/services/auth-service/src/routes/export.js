// routes/export.js
// Export PDF et DOCX pour transcriptions et résumés
// Compatible Fastify avec gestion correcte des buffers (pas de streaming)

const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } = require('docx');
const path = require('path');
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'memora-logo.png');
const LOGO_PATH_LIGHT = path.join(__dirname, '..', 'assets', 'memora-logo-light.png');

module.exports = async function (fastify, opts) {
  
  // Helper: Vérifier le token (query param pour les téléchargements)
  const verifyToken = (request) => {
    const token = request.query.token || request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new Error('Token manquant');
    }
    try {
      const decoded = fastify.jwt.verify(token);
      return decoded;
    } catch (err) {
      throw new Error('Token invalide');
    }
  };

  // Helper: Récupérer les données de la réunion
  const getMeetingData = async (meetingId, userId) => {
    const { rows: meetings } = await fastify.pg.query(
      'SELECT * FROM meetings WHERE id = $1 AND user_id = $2',
      [meetingId, userId]
    );
    
    if (meetings.length === 0) {
      throw new Error('Réunion non trouvée');
    }

    const { rows: transcripts } = await fastify.pg.query(
      'SELECT * FROM transcripts WHERE meeting_id = $1 ORDER BY created_at DESC LIMIT 1',
      [meetingId]
    );

    const { rows: summaries } = await fastify.pg.query(
      'SELECT * FROM summaries WHERE meeting_id = $1 ORDER BY created_at DESC LIMIT 1',
      [meetingId]
    );

    return {
      meeting: meetings[0],
      transcript: transcripts[0] || null,
      summary: summaries[0] || null
    };
  };

  // Helper: Formater la date
  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('fr-CA', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper: Nettoyer le texte des emojis pour PDF
  const cleanText = (text) => {
    if (!text) return '';
    return text
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .trim();
  };

  // Helper: Générer PDF en buffer (pas en stream - évite l'erreur write after end)
  const generatePDFBuffer = (meeting, transcript, summary, type) => {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ 
          margin: 50,
          size: 'A4',
          bufferPages: true
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // En-tête avec logo
        const fs = require('fs');
        const pdfLogo = fs.existsSync(LOGO_PATH_LIGHT) ? LOGO_PATH_LIGHT : LOGO_PATH;
        if (fs.existsSync(pdfLogo)) {
          doc.image(pdfLogo, 237, 25, { width: 120 });
          // Positionner le texte après le logo
          doc.y = 130;
        } else {
          doc.fontSize(24).fillColor('#1E2A26').text('MEMORA', { align: 'center' });
          doc.moveDown(0.5);
        }
        doc.fontSize(10).fillColor('#666666').text(type === 'transcript' ? 'Transcription' : 'Resume IA', { align: 'center' });
        doc.moveDown(1);

        // Ligne de séparation
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#A8B78A');
        doc.moveDown(1);

        // Titre de la réunion
        doc.fontSize(18).fillColor('#1E2A26').text(cleanText(meeting.title) || 'Sans titre', { align: 'left' });
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor('#666666').text(formatDate(meeting.date || meeting.created_at));
        doc.moveDown(1.5);

        if (type === 'transcript' && transcript) {
          // Métadonnées
          if (transcript.language) {
            doc.fontSize(10).fillColor('#A8B78A').text('Langue: ' + transcript.language.toUpperCase());
          }
          if (transcript.word_count) {
            doc.text('Mots: ' + transcript.word_count);
          }
          doc.moveDown(1);

          // Contenu
          doc.fontSize(11).fillColor('#333333');
          const content = cleanText(transcript.content);
          const paragraphs = content.split(/\n\n+/);
          paragraphs.forEach((para, index) => {
            if (para.trim()) {
              doc.text(para.trim(), { align: 'justify', lineGap: 4 });
              if (index < paragraphs.length - 1) {
                doc.moveDown(0.8);
              }
            }
          });

        } else if (type === 'summary' && summary) {
          // Résumé principal
          if (summary.content) {
            doc.fontSize(12).fillColor('#1E2A26').text('Resume', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(11).fillColor('#333333').text(cleanText(summary.content), {
              align: 'justify',
              lineGap: 4
            });
            doc.moveDown(1.5);
          }

          const sections = typeof summary.sections === 'string' 
            ? JSON.parse(summary.sections) 
            : (summary.sections || {});

          // Points clés
          if (sections.keyPoints && sections.keyPoints.length > 0) {
            doc.fontSize(12).fillColor('#1E2A26').text('Points cles', { underline: true });
            doc.moveDown(0.5);
            sections.keyPoints.forEach((point, i) => {
              doc.fontSize(10).fillColor('#333333').text((i + 1) + '. ' + cleanText(point), {
                indent: 15,
                lineGap: 3
              });
            });
            doc.moveDown(1);
          }

          // Décisions
          if (sections.decisions && sections.decisions.length > 0) {
            doc.fontSize(12).fillColor('#1E2A26').text('Decisions', { underline: true });
            doc.moveDown(0.5);
            sections.decisions.forEach((decision) => {
              doc.fontSize(10).fillColor('#333333').text('- ' + cleanText(decision), {
                indent: 15,
                lineGap: 3
              });
            });
            doc.moveDown(1);
          }

          // Actions
          if (sections.actionItems && sections.actionItems.length > 0) {
            doc.fontSize(12).fillColor('#1E2A26').text('Actions a faire', { underline: true });
            doc.moveDown(0.5);
            sections.actionItems.forEach((item) => {
              const task = typeof item === 'string' ? item : item.task;
              const assignee = typeof item === 'object' ? item.assignee : null;
              let text = '[ ] ' + cleanText(task);
              if (assignee) {
                text += ' (' + cleanText(assignee) + ')';
              }
              doc.fontSize(10).fillColor('#333333').text(text, {
                indent: 15,
                lineGap: 3
              });
            });
            doc.moveDown(1);
          }

          // Questions
          if (sections.questions && sections.questions.length > 0) {
            doc.fontSize(12).fillColor('#1E2A26').text('Questions soulevees', { underline: true });
            doc.moveDown(0.5);
            sections.questions.forEach((question) => {
              doc.fontSize(10).fillColor('#333333').text('? ' + cleanText(question), {
                indent: 15,
                lineGap: 3
              });
            });
            doc.moveDown(1);
          }
        }

        // Pied de page
        doc.moveDown(2);
        doc.fontSize(8).fillColor('#999999').text(
          'Genere par Memora le ' + new Date().toLocaleDateString('fr-CA'),
          { align: 'center' }
        );

        // Finaliser - IMPORTANT: doit être appelé après tout le contenu
        doc.end();

      } catch (err) {
        reject(err);
      }
    });
  };

  // ============================================
  // EXPORT PDF
  // ============================================
  fastify.get('/export/:meetingId/pdf', async (request, reply) => {
    try {
      const decoded = verifyToken(request);
      const { meetingId } = request.params;
      const type = request.query.type || 'transcript';
      
      const { meeting, transcript, summary } = await getMeetingData(meetingId, decoded.userId);

      if (type === 'transcript' && !transcript) {
        return reply.status(404).send({ error: 'Aucune transcription disponible' });
      }
      if (type === 'summary' && !summary) {
        return reply.status(404).send({ error: 'Aucun resume disponible' });
      }

      // Générer le PDF en buffer (attendre que le buffer soit complet)
      const pdfBuffer = await generatePDFBuffer(meeting, transcript, summary, type);

      // Nom du fichier sécurisé
      const safeTitle = (meeting.title || 'reunion').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      const filename = safeTitle + '_' + type + '_' + new Date().toISOString().split('T')[0] + '.pdf';

      // Envoyer le buffer complet
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', 'attachment; filename="' + filename + '"')
        .header('Content-Length', pdfBuffer.length)
        .send(pdfBuffer);

    } catch (error) {
      console.error('Erreur export PDF:', error);
      return reply.status(500).send({ error: error.message || 'Erreur lors de l\'export PDF' });
    }
  });

  // ============================================
  // EXPORT DOCX
  // ============================================
  fastify.get('/export/:meetingId/docx', async (request, reply) => {
    try {
      const decoded = verifyToken(request);
      const { meetingId } = request.params;
      const type = request.query.type || 'transcript';
      
      const { meeting, transcript, summary } = await getMeetingData(meetingId, decoded.userId);

      if (type === 'transcript' && !transcript) {
        return reply.status(404).send({ error: 'Aucune transcription disponible' });
      }
      if (type === 'summary' && !summary) {
        return reply.status(404).send({ error: 'Aucun resume disponible' });
      }

      const children = [];

      // Titre avec logo
      const fs = require('fs');
      const docxLogo = fs.existsSync(LOGO_PATH_LIGHT) ? LOGO_PATH_LIGHT : LOGO_PATH;
      if (fs.existsSync(docxLogo)) {
        const logoBuffer = fs.readFileSync(docxLogo);
        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: logoBuffer,
                transformation: {
                  width: 120,
                  height: 120
                },
                type: 'png'
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
          })
        );
      } else {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: 'MEMORA', bold: true, size: 48, color: '1E2A26' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
          })
        );
      }
      children.push(
        new Paragraph({
          children: [new TextRun({ text: type === 'transcript' ? 'Transcription' : 'Resume IA', size: 24, color: '666666' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        })
      );

      // Titre de la réunion
      children.push(
        new Paragraph({
          children: [new TextRun({ text: meeting.title || 'Sans titre', bold: true, size: 36 })],
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 100 }
        }),
        new Paragraph({
          children: [new TextRun({ text: formatDate(meeting.date || meeting.created_at), size: 20, color: '666666' })],
          spacing: { after: 400 }
        })
      );

      if (type === 'transcript' && transcript) {
        // Métadonnées
        if (transcript.language) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: 'Langue: ' + transcript.language.toUpperCase(), size: 20, color: 'A8B78A' })],
              spacing: { after: 100 }
            })
          );
        }
        if (transcript.word_count) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: 'Mots: ' + transcript.word_count, size: 20, color: 'A8B78A' })],
              spacing: { after: 300 }
            })
          );
        }

        // Contenu
        const paragraphs = (transcript.content || '').split(/\n\n+/);
        paragraphs.forEach(para => {
          if (para.trim()) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: para.trim(), size: 22 })],
                spacing: { after: 200 }
              })
            );
          }
        });

      } else if (type === 'summary' && summary) {
        // Résumé principal
        if (summary.content) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: 'Resume', bold: true, size: 28 })],
              heading: HeadingLevel.HEADING_2,
              spacing: { after: 200 }
            }),
            new Paragraph({
              children: [new TextRun({ text: summary.content, size: 22 })],
              spacing: { after: 400 }
            })
          );
        }

        const sections = typeof summary.sections === 'string' 
          ? JSON.parse(summary.sections) 
          : (summary.sections || {});

        // Points clés
        if (sections.keyPoints && sections.keyPoints.length > 0) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: 'Points cles', bold: true, size: 28 })],
              heading: HeadingLevel.HEADING_2,
              spacing: { after: 200 }
            })
          );
          sections.keyPoints.forEach((point, i) => {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: (i + 1) + '. ' + point, size: 22 })],
                spacing: { after: 100 }
              })
            );
          });
          children.push(new Paragraph({ spacing: { after: 200 } }));
        }

        // Décisions
        if (sections.decisions && sections.decisions.length > 0) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: 'Decisions', bold: true, size: 28 })],
              heading: HeadingLevel.HEADING_2,
              spacing: { after: 200 }
            })
          );
          sections.decisions.forEach(decision => {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: '- ' + decision, size: 22 })],
                spacing: { after: 100 }
              })
            );
          });
          children.push(new Paragraph({ spacing: { after: 200 } }));
        }

        // Actions
        if (sections.actionItems && sections.actionItems.length > 0) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: 'Actions a faire', bold: true, size: 28 })],
              heading: HeadingLevel.HEADING_2,
              spacing: { after: 200 }
            })
          );
          sections.actionItems.forEach(item => {
            const task = typeof item === 'string' ? item : item.task;
            const assignee = typeof item === 'object' ? item.assignee : null;
            let text = '[ ] ' + task;
            if (assignee) {
              text += ' (' + assignee + ')';
            }
            children.push(
              new Paragraph({
                children: [new TextRun({ text, size: 22 })],
                spacing: { after: 100 }
              })
            );
          });
          children.push(new Paragraph({ spacing: { after: 200 } }));
        }

        // Questions
        if (sections.questions && sections.questions.length > 0) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: 'Questions soulevees', bold: true, size: 28 })],
              heading: HeadingLevel.HEADING_2,
              spacing: { after: 200 }
            })
          );
          sections.questions.forEach(question => {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: '? ' + question, size: 22 })],
                spacing: { after: 100 }
              })
            );
          });
        }
      }

      // Pied de page
      children.push(
        new Paragraph({ spacing: { after: 400 } }),
        new Paragraph({
          children: [new TextRun({ 
            text: 'Genere par Memora le ' + new Date().toLocaleDateString('fr-CA'), 
            size: 18, 
            color: '999999' 
          })],
          alignment: AlignmentType.CENTER
        })
      );

      // Créer le document
      const doc = new Document({
        sections: [{
          properties: {},
          children: children
        }]
      });

      // Générer le buffer
      const buffer = await Packer.toBuffer(doc);

      // Nom du fichier
      const safeTitle = (meeting.title || 'reunion').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      const filename = safeTitle + '_' + type + '_' + new Date().toISOString().split('T')[0] + '.docx';

      // Envoyer
      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        .header('Content-Disposition', 'attachment; filename="' + filename + '"')
        .header('Content-Length', buffer.length)
        .send(buffer);

    } catch (error) {
      console.error('Erreur export DOCX:', error);
      return reply.status(500).send({ error: error.message || 'Erreur lors de l\'export DOCX' });
    }
  });

};
