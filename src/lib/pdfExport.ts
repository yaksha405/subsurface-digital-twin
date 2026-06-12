import jsPDF from 'jspdf';

export async function exportPDF(
  screenshotFn: (() => string | null) | null,
  params: {
    gasThreshold: number;
    confidenceFilter: number;
    layers: Record<string, boolean>;
  }
) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;

  // Header
  pdf.setFillColor(10, 10, 15);
  pdf.rect(0, 0, pageWidth, 40, 'F');
  pdf.setTextColor(255, 230, 0);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DIGITAL TWIN CONTROL CABIN', 15, 18);
  pdf.setFontSize(10);
  pdf.setTextColor(160, 160, 176);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Safety Inspection Report - Safety Supervision Audit', 15, 26);
  pdf.text(new Date().toLocaleString(), 15, 33);

  // Capture screenshot
  let screenshot = null;
  if (screenshotFn) {
    screenshot = screenshotFn();
  }

  if (screenshot) {
    try {
      const imgWidth = pageWidth - 30;
      const imgHeight = imgWidth * 0.6;
      pdf.addImage(screenshot, 'PNG', 15, 48, imgWidth, imgHeight);
    } catch (e) {
      console.error('Failed to add screenshot to PDF', e);
    }
  }

  // Parameters section
  let y = 130;
  pdf.setTextColor(224, 224, 232);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PARAMETER SNAPSHOT', 15, y);
  y += 8;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(160, 160, 176);

  const paramLines = [
    `Gas Alert Threshold:       ${params.gasThreshold.toFixed(1)} %`,
    `Confidence Filter:         ${params.confidenceFilter} %`,
    `Mesh Layer:                ${params.layers.mesh ? 'ON' : 'OFF'}`,
    `Point Cloud Layer:         ${params.layers.pointCloud ? 'ON' : 'OFF'}`,
    `Gas Heatmap Layer:         ${params.layers.gasHeatmap ? 'ON' : 'OFF'}`,
    `Temperature Heatmap Layer: ${params.layers.tempHeatmap ? 'ON' : 'OFF'}`,
    `Export Timestamp:          ${new Date().toISOString()}`,
  ];

  for (const line of paramLines) {
    pdf.text(line, 15, y);
    y += 6;
  }

  // SHA-256 hash
  y += 10;
  pdf.setTextColor(255, 230, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('DATA INTEGRITY HASH (SHA-256):', 15, y);
  y += 6;

  const hashData = JSON.stringify({
    ...params,
    timestamp: Date.now(),
    screenshot: !!screenshot,
  });
  const hash = await computeSHA256(hashData);

  pdf.setTextColor(160, 160, 176);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  // Split hash into lines
  for (let i = 0; i < hash.length; i += 34) {
    pdf.text(hash.substring(i, i + 34), 15, y);
    y += 5;
  }

  // Disclaimer
  y += 15;
  pdf.setFillColor(255, 51, 51);
  pdf.rect(0, pageHeight - 35, pageWidth, 35, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  const disclaimer =
    'DISCLAIMER: This system is based on limited-condition perception fusion. All 3D modeling and parameter predictions are for engineering reference ONLY. NEVER use as the sole safety basis for underground operations.';
  const splitDisclaimer = pdf.splitTextToSize(disclaimer, pageWidth - 20);
  pdf.text(splitDisclaimer, 10, pageHeight - 25);

  pdf.save(`digital-twin-report-${Date.now()}.pdf`);
}

async function computeSHA256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
