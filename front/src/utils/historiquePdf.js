import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { formatCategoryLabel } from '../constants/filterOptions';

const PAGE_SIZE = { width: 595.28, height: 841.89 };
const MARGIN = 42;
const LINE_HEIGHT = 16;
const SECTION_GAP = 14;

function formatPeriodLabel(period) {
  if (!period) {
    return 'Periode non definie';
  }

  const [year, month] = String(period).slice(0, 7).split('-');
  if (!year || !month) {
    return period;
  }

  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function buildFileName(period, category) {
  const safePeriod = period || 'periode-auto';
  const safeCategory = category && category !== 'ALL' ? category.toLowerCase() : 'toutes-categories';
  return `historique-${safePeriod}-${safeCategory}.pdf`;
}

function wrapText(text, maxCharsPerLine = 90) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = '';

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length > maxCharsPerLine) {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length ? lines : [''];
}

function sumTrend(trend) {
  return trend.reduce((total, point) => total + Number(point.value || 0), 0);
}

async function loadLogoImage(pdfDoc) {
  try {
    const response = await fetch('/logo.png');
    if (!response.ok) {
      return null;
    }

    const buffer = await response.arrayBuffer();
    return pdfDoc.embedPng(buffer);
  } catch {
    return null;
  }
}

function drawPageHeader(page, titleFont, textFont, logoImage, pageNumber, periodLabel, categoryLabel) {
  page.drawRectangle({
    x: 0,
    y: PAGE_SIZE.height - 88,
    width: PAGE_SIZE.width,
    height: 88,
    color: rgb(0.06, 0.13, 0.29),
  });

  page.drawRectangle({
    x: 0,
    y: PAGE_SIZE.height - 94,
    width: PAGE_SIZE.width,
    height: 6,
    color: rgb(0.84, 0.68, 0.18),
  });

  if (logoImage) {
    page.drawImage(logoImage, {
      x: MARGIN,
      y: PAGE_SIZE.height - 72,
      width: 46,
      height: 46,
    });
  }

  page.drawText('ASECNA · Rapport mensuel de supervision', {
    x: MARGIN + 58,
    y: PAGE_SIZE.height - 40,
    size: 18,
    font: titleFont,
    color: rgb(0.96, 0.98, 1),
  });

  page.drawText(`Periode: ${periodLabel}`, {
    x: MARGIN + 58,
    y: PAGE_SIZE.height - 60,
    size: 10,
    font: textFont,
    color: rgb(0.83, 0.88, 0.96),
  });

  page.drawText(`Categorie: ${categoryLabel}`, {
    x: PAGE_SIZE.width - 190,
    y: PAGE_SIZE.height - 60,
    size: 10,
    font: textFont,
    color: rgb(0.83, 0.88, 0.96),
  });

  page.drawText(`Page ${pageNumber}`, {
    x: PAGE_SIZE.width - 86,
    y: PAGE_SIZE.height - 40,
    size: 10,
    font: titleFont,
    color: rgb(1, 1, 1),
  });
}

function drawPageFooter(page, textFont) {
  page.drawLine({
    start: { x: MARGIN, y: 30 },
    end: { x: PAGE_SIZE.width - MARGIN, y: 30 },
    thickness: 1,
    color: rgb(0.84, 0.88, 0.94),
  });

  page.drawText('Document genere automatiquement depuis le tableau de bord Historique.', {
    x: MARGIN,
    y: 16,
    size: 9,
    font: textFont,
    color: rgb(0.41, 0.46, 0.54),
  });
}

function drawMetricCard(page, x, y, width, title, value, titleFont, textFont) {
  page.drawRectangle({
    x,
    y,
    width,
    height: 62,
    color: rgb(0.95, 0.97, 1),
    borderColor: rgb(0.8, 0.85, 0.93),
    borderWidth: 1,
    borderRadius: 12,
  });

  page.drawText(title, {
    x: x + 12,
    y: y + 40,
    size: 10,
    font: textFont,
    color: rgb(0.35, 0.41, 0.49),
  });

  page.drawText(String(value), {
    x: x + 12,
    y: y + 18,
    size: 18,
    font: titleFont,
    color: rgb(0.07, 0.16, 0.35),
  });
}

function drawMonthlyTrendChart(page, trend, x, y, width, height, titleFont, textFont) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(0.97, 0.98, 1),
    borderColor: rgb(0.84, 0.88, 0.94),
    borderWidth: 1,
    borderRadius: 14,
  });

  page.drawText('Evolution des pannes sur le mois', {
    x: x + 14,
    y: y + height - 20,
    size: 12,
    font: titleFont,
    color: rgb(0.08, 0.23, 0.53),
  });

  if (!trend?.length) {
    page.drawText('Aucune donnee de tendance disponible.', {
      x: x + 14,
      y: y + height / 2,
      size: 10,
      font: textFont,
      color: rgb(0.45, 0.49, 0.57),
    });
    return;
  }

  const chartLeft = x + 34;
  const chartBottom = y + 24;
  const chartWidth = width - 54;
  const chartHeight = height - 54;
  const maxValue = Math.max(10, ...trend.map((point) => Number(point.value || 0)));
  const points = trend.map((point, index) => ({
    label: point.label,
    value: Number(point.value || 0),
    x: chartLeft + (index / Math.max(trend.length - 1, 1)) * chartWidth,
    y: chartBottom + (Number(point.value || 0) / maxValue) * chartHeight,
  }));

  [0, 0.25, 0.5, 0.75, 1].forEach((ratio) => {
    const yPos = chartBottom + ratio * chartHeight;
    const tickValue = Math.round(ratio * maxValue);
    page.drawLine({
      start: { x: chartLeft, y: yPos },
      end: { x: chartLeft + chartWidth, y: yPos },
      thickness: 0.7,
      color: rgb(0.86, 0.89, 0.94),
    });
    page.drawText(String(tickValue), {
      x: x + 6,
      y: yPos - 3,
      size: 8,
      font: textFont,
      color: rgb(0.45, 0.49, 0.57),
    });
  });

  for (let index = 1; index < points.length; index += 1) {
    page.drawLine({
      start: { x: points[index - 1].x, y: points[index - 1].y },
      end: { x: points[index].x, y: points[index].y },
      thickness: 1.8,
      color: rgb(0.34, 0.46, 0.87),
    });
  }

  points.forEach((point, index) => {
    page.drawCircle({
      x: point.x,
      y: point.y,
      size: 2.8,
      color: rgb(0.13, 0.29, 0.74),
      borderColor: rgb(0.82, 0.88, 1),
      borderWidth: 1.2,
    });

    if (index % Math.max(Math.ceil(points.length / 8), 1) === 0 || index === points.length - 1) {
      page.drawText(String(point.label), {
        x: point.x - 6,
        y: chartBottom - 14,
        size: 8,
        font: textFont,
        color: rgb(0.45, 0.49, 0.57),
      });
    }
  });
}

export async function exportHistoriqueSummaryPdf({
  period,
  category,
  summary,
  details,
}) {
  const pdfDoc = await PDFDocument.create();
  const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const textFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const logoImage = await loadLogoImage(pdfDoc);
  const periodLabel = formatPeriodLabel(period);
  const categoryLabel = formatCategoryLabel(category);
  const pages = [];

  const createPage = () => {
    const page = pdfDoc.addPage([PAGE_SIZE.width, PAGE_SIZE.height]);
    pages.push(page);
    drawPageHeader(page, titleFont, textFont, logoImage, pages.length, periodLabel, categoryLabel);
    drawPageFooter(page, textFont);
    return page;
  };

  let page = createPage();
  let cursorY = PAGE_SIZE.height - 120;

  const ensureSpace = (requiredHeight = LINE_HEIGHT) => {
    if (cursorY - requiredHeight < 56) {
      page = createPage();
      cursorY = PAGE_SIZE.height - 120;
    }
  };

  const drawTextLine = (text, options = {}) => {
    const {
      font = textFont,
      size = 11,
      color = rgb(0.11, 0.15, 0.24),
      indent = 0,
    } = options;
    ensureSpace(LINE_HEIGHT);
    page.drawText(text, {
      x: MARGIN + indent,
      y: cursorY,
      size,
      font,
      color,
    });
    cursorY -= LINE_HEIGHT;
  };

  const drawParagraph = (text, options = {}) => {
    wrapText(text, options.maxCharsPerLine || 90).forEach((line) => {
      drawTextLine(line, options);
    });
  };

  const drawSectionTitle = (text) => {
    ensureSpace(LINE_HEIGHT + SECTION_GAP);
    cursorY -= 4;
    page.drawText(text, {
      x: MARGIN,
      y: cursorY,
      size: 13,
      font: titleFont,
      color: rgb(0.08, 0.23, 0.53),
    });
    cursorY -= SECTION_GAP;
  };

  const drawBulletList = (items, emptyMessage) => {
    if (!items?.length) {
      drawTextLine(emptyMessage, { color: rgb(0.4, 0.45, 0.52) });
      return;
    }

    items.forEach((item) => {
      const lines = wrapText(String(item), 82);
      lines.forEach((line, index) => {
        drawTextLine(index === 0 ? `- ${line}` : line, { indent: index === 0 ? 0 : 12 });
      });
    });
  };

  const monthlyTrend = summary?.trend || [];
  const totalPannes = sumTrend(monthlyTrend);
  const topEquipments = summary?.pannesParEquipement || [];
  const categoryBreakdown = summary?.categoryBreakdown || [];
  const recentDetails = Array.isArray(details) ? details.slice(0, 12) : [];
  const lastIncident = summary?.dernierIncident || recentDetails[0] || null;
  const daysWithIncidents = monthlyTrend.filter((point) => Number(point.value || 0) > 0).length;
  const peakValue = monthlyTrend.length
    ? Math.max(...monthlyTrend.map((point) => Number(point.value || 0)))
    : 0;

  page.drawText('Resume mensuel des pannes', {
    x: MARGIN,
    y: cursorY,
    size: 20,
    font: titleFont,
    color: rgb(0.07, 0.16, 0.35),
  });
  cursorY -= 18;

  drawParagraph(
    "Rapport structure genere depuis la page Historique. Il synthetise les tendances, la criticite des equipements et les incidents recents pour la periode selectionnee.",
    { color: rgb(0.33, 0.39, 0.48), maxCharsPerLine: 88 },
  );

  cursorY -= 8;
  const cardWidth = (PAGE_SIZE.width - MARGIN * 2 - 24) / 3;
  drawMetricCard(page, MARGIN, cursorY - 62, cardWidth, 'Total des pannes', totalPannes, titleFont, textFont);
  drawMetricCard(
    page,
    MARGIN + cardWidth + 12,
    cursorY - 62,
    cardWidth,
    'Jours avec incidents',
    daysWithIncidents,
    titleFont,
    textFont,
  );
  drawMetricCard(
    page,
    MARGIN + (cardWidth + 12) * 2,
    cursorY - 62,
    cardWidth,
    'Pic journalier',
    peakValue,
    titleFont,
    textFont,
  );
  cursorY -= 78;

  ensureSpace(220);
  drawMonthlyTrendChart(page, monthlyTrend, MARGIN, cursorY - 210, PAGE_SIZE.width - MARGIN * 2, 210, titleFont, textFont);
  cursorY -= 228;

  drawSectionTitle('Top equipements');
  drawBulletList(
    topEquipments.map((item, index) => `${index + 1}. ${item.equipement} - ${item.pannes} panne(s)`),
    'Aucun equipement critique disponible pour cette periode.',
  );

  cursorY -= 6;
  drawSectionTitle('Repartition par categorie');
  drawBulletList(
    categoryBreakdown.map(
      (item) => `${item.label} - ${item.count} panne(s) (${item.value}% du total)`,
    ),
    'Aucune repartition disponible.',
  );

  cursorY -= 6;
  drawSectionTitle('Dernier incident connu');
  if (lastIncident) {
    drawParagraph(
      `${lastIncident.date || 'Date non renseignee'} ${lastIncident.heure || ''} - ${
        lastIncident.equipement || 'Equipement non renseigne'
      }`,
      { font: titleFont, maxCharsPerLine: 78 },
    );
    drawParagraph(
      `Categorie : ${lastIncident.categorie || 'Non renseignee'} | Statut/Commentaire : ${
        lastIncident.commentaires || 'Non renseigne'
      }`,
      { maxCharsPerLine: 82 },
    );
  } else {
    drawTextLine('Aucun incident recent disponible.', { color: rgb(0.4, 0.45, 0.52) });
  }

  cursorY -= 8;
  drawSectionTitle('Historique recent');
  if (!recentDetails.length) {
    drawTextLine("Aucune ligne d'historique disponible pour cette periode.", {
      color: rgb(0.4, 0.45, 0.52),
    });
  } else {
    recentDetails.forEach((item, index) => {
      ensureSpace(52);
      page.drawRectangle({
        x: MARGIN,
        y: cursorY - 34,
        width: PAGE_SIZE.width - MARGIN * 2,
        height: 40,
        color: rgb(0.97, 0.98, 1),
        borderColor: rgb(0.88, 0.9, 0.95),
        borderWidth: 1,
        borderRadius: 10,
      });
      drawParagraph(
        `${index + 1}. ${item.date || 'Date inconnue'} ${item.heure || ''} - ${
          item.equipement || 'Equipement non renseigne'
        }`,
        { font: titleFont, maxCharsPerLine: 80, indent: 10 },
      );
      drawParagraph(
        `Categorie : ${item.categorie || 'Non renseignee'} | Commentaire : ${
          item.commentaires || 'Non renseigne'
        }`,
        { indent: 10, maxCharsPerLine: 78, color: rgb(0.32, 0.37, 0.46) },
      );
      cursorY -= 6;
    });
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = buildFileName(period, category);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
