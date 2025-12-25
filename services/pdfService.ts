
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { CostCategory, MonthlyFlow, ItemisedCashflow, SensitivityRow, ReportModel, LineItem, GstTreatment, MilestoneLink, TaxConfiguration, SiteDNA } from "../types";
import { Site, FeasibilityScenario } from "../types-v2";
import { SensitivityCell } from "./sensitivityService";
import { FinanceEngine } from "./financeEngine";
import { DEFAULT_TAX_SCALES } from '../constants';

// --- THEME CONSTANTS ---
const COLORS = {
  primary: "#1e293b", // Slate 800
  secondary: "#334155", // Slate 700
  accent: "#4f46e5", // Indigo 600
  lightGray: "#f1f5f9", // Slate 100
  border: "#cbd5e1", // Slate 300
  white: "#ffffff",
  text: "#0f172a"
};

const FONTS = {
  header: "helvetica",
  body: "helvetica",
  mono: "courier"
};

const formatCurrency = (val: number) => {
  if (Math.abs(val) < 0.01) return "-";
  const absVal = Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return val < 0 ? `(${absVal})` : `${absVal}`;
};

const formatPct = (val: number | null) => {
    if (val === null) return "N/A";
    return `${val.toFixed(2)}%`;
};

const getBase64ImageFromUrl = async (imageUrl: string): Promise<string | null> => {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Failed to load image for PDF", error);
    return null;
  }
};

export class PdfService {
  private doc: jsPDF;
  private currentY: number = 0;
  
  constructor() {
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  }

  // --- PUBLIC ORCHESTRATOR ---
  public static async generateBoardReport(
    site: Site,
    scenario: FeasibilityScenario,
    report: ReportModel,
    siteDNA: SiteDNA,
    sensitivityMatrix: SensitivityCell[][],
    riskTables?: Record<string, SensitivityRow[]>
  ) {
    const builder = new PdfService();
    
    // 1. Cover Page
    await builder.addCoverPage(site, scenario);
    
    // 2. Executive Summary
    builder.addNewPage("portrait");
    builder.addFeasibilitySummary(site, scenario, report, sensitivityMatrix);
    builder.addPageFooter(2, site.name);

    // 3. Asset Fact Sheet
    builder.addNewPage("portrait");
    await builder.addAssetFactSheet(site);
    builder.addPageFooter(3, site.name);

    // 4. Valuer's P&L
    builder.addNewPage("portrait");
    builder.addValuersPnL(scenario, report, site); 
    builder.addPageFooter(4, site.name);

    // 5. Sensitivity Analysis
    builder.addNewPage("portrait");
    builder.addSensitivityAnalysis(sensitivityMatrix, scenario);
    builder.addPageFooter(5, site.name);

    // 6. Risk Report
    if (riskTables) {
      builder.addNewPage("portrait");
      builder.addRiskReport(riskTables, site.name);
      builder.addPageFooter(6, site.name);
    }

    // 7. Itemised Cashflow (Landscape)
    builder.addItemisedCashflow(report.cashflow.itemised, site.name, 7);

    // Save
    const filename = `Investment_Memo_${site.code}_${new Date().toISOString().split('T')[0]}.pdf`;
    builder.doc.save(filename);
  }

  private addNewPage(orientation: 'portrait' | 'landscape') {
    this.doc.addPage("a4", orientation);
    this.currentY = 0;
  }

  private addPageHeader(title: string, subtitle: string, landscape: boolean) {
    const pageWidth = landscape ? 297 : 210;
    this.doc.setFillColor(COLORS.primary);
    this.doc.rect(0, 0, pageWidth, 20, "F");
    this.doc.setFont(FONTS.header, "bold");
    this.doc.setFontSize(14);
    this.doc.setTextColor(COLORS.white);
    this.doc.text(title.toUpperCase(), 15, 13);
    this.doc.setFontSize(10);
    this.doc.setFont(FONTS.header, "normal");
    this.doc.text(subtitle, pageWidth - 15, 13, { align: "right" });
    this.currentY = 30;
  }

  private addPageFooter(pageNum: number, projectName: string, landscape = false) {
    const pageWidth = landscape ? 297 : 210;
    const pageHeight = landscape ? 210 : 297;
    this.doc.setDrawColor(COLORS.border);
    this.doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);
    this.doc.setFontSize(8);
    this.doc.setTextColor(100);
    this.doc.text("SH Connect | Commercial in Confidence", 15, pageHeight - 10);
    this.doc.text(`Page ${pageNum}`, pageWidth - 15, pageHeight - 10, { align: "right" });
  }

  private async addCoverPage(site: Site, scenario: FeasibilityScenario) {
    const pageWidth = 210;
    const pageHeight = 297;
    if (site.thumbnail) {
        try {
            const imgData = await getBase64ImageFromUrl(site.thumbnail);
            if (imgData) {
                this.doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, 140, undefined, 'FAST');
            }
        } catch (e) { }
    } else {
        this.doc.setFillColor(COLORS.primary);
        this.doc.rect(0, 0, pageWidth, 140, 'F');
    }
    this.currentY = 160;
    this.doc.setTextColor(COLORS.primary);
    this.doc.setFont(FONTS.header, "bold");
    this.doc.setFontSize(28);
    const titleLines = this.doc.splitTextToSize(site.name.toUpperCase(), 170);
    this.doc.text(titleLines, 20, this.currentY);
    this.currentY += (12 * titleLines.length) + 5;
    this.doc.setFont(FONTS.header, "normal");
    this.doc.setFontSize(14);
    this.doc.setTextColor(COLORS.secondary);
    this.doc.text(site.identity.address, 20, this.currentY);
    this.currentY += 15;
    this.doc.setDrawColor(COLORS.accent);
    this.doc.setLineWidth(1);
    this.doc.line(20, this.currentY, 100, this.currentY);
    this.currentY += 15;
    this.doc.setFontSize(18);
    this.doc.setTextColor(COLORS.text);
    this.doc.text("Investment Memorandum", 20, this.currentY);
    this.currentY += 8;
    this.doc.setFontSize(12);
    this.doc.setTextColor(COLORS.secondary);
    this.doc.text(`Scenario: ${scenario.name}`, 20, this.currentY);
    this.doc.setFontSize(10);
    this.doc.setTextColor(150);
    this.doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, pageHeight - 30);
    this.doc.text("Prepared by SH Connect", 20, pageHeight - 25);
    this.doc.text("Commercial in Confidence", pageWidth - 20, pageHeight - 25, { align: 'right' });
  }

  private addFeasibilitySummary(site: Site, scenario: FeasibilityScenario, report: ReportModel, sensitivityMatrix: SensitivityCell[][]) {
      this.addPageHeader("Development Summary", "Key Performance Indicators", false);
      const leftX = 20;
      const rightX = 110;
      let y = this.currentY;
      const metrics = report.metrics;

      const drawDottedRow = (label: string, value: string, xPos: number, width: number, isBold = false) => {
          this.doc.setFont(FONTS.body, isBold ? "bold" : "normal");
          this.doc.setFontSize(10);
          this.doc.setTextColor(COLORS.text);
          this.doc.text(label, xPos, y);
          const labelWidth = this.doc.getTextWidth(label);
          const valueWidth = this.doc.getTextWidth(value);
          const dotStart = xPos + labelWidth + 2;
          const dotEnd = xPos + width - valueWidth - 2;
          if (dotEnd > dotStart) {
              this.doc.setDrawColor(200, 200, 200);
              this.doc.setLineWidth(0.3);
              this.doc.line(dotStart, y - 1, dotEnd, y - 1);
          }
          this.doc.text(value, xPos + width, y, { align: 'right' });
          y += 7;
      };

      this.doc.setFont(FONTS.header, "bold");
      this.doc.setFontSize(12);
      this.doc.text("Project Returns", leftX, y);
      y += 8;
      drawDottedRow("Total Development Cost (Ex GST)", formatCurrency(metrics.totalCostNet), leftX, 80);
      drawDottedRow("Gross Realisation (Ex GST)", formatCurrency(metrics.netRealisation), leftX, 80);
      drawDottedRow("Net Development Profit", formatCurrency(metrics.netProfit), leftX, 80, true);
      y += 4;
      drawDottedRow("Development Margin (MDC)", formatPct(metrics.devMarginPct), leftX, 80, true);
      drawDottedRow("Margin on Equity (MoE)", formatPct(metrics.marginOnEquity), leftX, 80, true);
      drawDottedRow("Internal Rate of Return (p.a.)", formatPct(metrics.equityIRR), leftX, 80, true);
      y += 4;
      drawDottedRow("Margin Before Interest", formatCurrency(metrics.marginBeforeInterest), leftX, 80);

      y = this.currentY;
      this.doc.setFont(FONTS.header, "bold");
      this.doc.setFontSize(12);
      this.doc.text("Capital Analysis", rightX, y);
      y += 8;
      drawDottedRow("Peak Debt Exposure", formatCurrency(metrics.peakDebtAmount), rightX, 80);
      drawDottedRow("Peak Debt Date", metrics.peakDebtDate, rightX, 80);
      drawDottedRow("Equity Contribution", formatCurrency(metrics.peakEquity), rightX, 80);
      y += 4;
      drawDottedRow("GST Collected (Sales)", formatCurrency(metrics.gstCollected), rightX, 80);
      drawDottedRow("GST Input Credits (Costs)", formatCurrency(metrics.gstInputCredits), rightX, 80);
      drawDottedRow("Net GST Payable", formatCurrency(metrics.netGstPayable), rightX, 80);

      this.currentY = y + 10;

      // Risk Box
      let isRisk = sensitivityMatrix && sensitivityMatrix.length > 4 && sensitivityMatrix[4][3] && sensitivityMatrix[4][3].margin < 0;
      if (isRisk) {
          this.doc.setDrawColor(220, 38, 38);
          this.doc.setLineWidth(0.5);
          this.doc.setFillColor(254, 242, 242);
          this.doc.rect(20, this.currentY, 170, 12, 'FD');
          this.doc.setTextColor(185, 28, 28);
          this.doc.setFont(FONTS.header, "bold");
          this.doc.setFontSize(10);
          this.doc.text("HIGH RISK ALERT:", 25, this.currentY + 7);
          this.doc.setFont(FONTS.body, "normal");
          this.doc.text("Project becomes loss-making with <5% cost overrun.", 60, this.currentY + 7);
          this.currentY += 20;
      } else {
          this.currentY += 5;
      }

      // GST Box
      this.doc.setDrawColor(COLORS.border);
      this.doc.setFillColor(255, 255, 255);
      this.doc.rect(20, this.currentY, 170, 45); 
      this.doc.setFont(FONTS.header, "bold");
      this.doc.setFontSize(10);
      this.doc.setTextColor(COLORS.secondary);
      this.doc.text("GST Reconciliation", 25, this.currentY + 6);
      
      let tempY = y;
      y = this.currentY + 12;
      const recX = 25;
      const recW = 75;
      drawDottedRow("Total Gross Costs", formatCurrency(report.reconciliation.totalCostGross), recX, recW);
      drawDottedRow("Less: Input Tax Credits", formatCurrency(report.reconciliation.gstInputCredits), recX, recW);
      drawDottedRow("Total Net Costs", formatCurrency(report.reconciliation.totalCostNet), recX, recW, true);
      
      y = this.currentY + 12; 
      const col2X = 110;
      drawDottedRow("Total Gross Sales", formatCurrency(report.reconciliation.grossRealisation), col2X, recW);
      drawDottedRow("Less: GST Payable", formatCurrency(report.reconciliation.gstPayable), col2X, recW);
      drawDottedRow("Net Realisation", formatCurrency(report.reconciliation.netRealisation), col2X, recW, true);

      // FIX: CRITICAL Y RESET to prevent overlapping Project Context
      this.currentY = this.currentY + 50; 
      
      this.doc.setTextColor(COLORS.text);
      this.doc.setFont(FONTS.header, "bold");
      this.doc.setFontSize(12);
      this.doc.text("Project Context", leftX, this.currentY);
      this.currentY += 8;
      this.doc.setFont(FONTS.body, "normal");
      this.doc.setFontSize(10);
      const desc = scenario.settings.description || "No description provided.";
      const lines = this.doc.splitTextToSize(desc, 170);
      this.doc.text(lines, leftX, this.currentY);
  }

  private async addAssetFactSheet(site: Site) {
      this.addPageHeader("Asset Particulars", "Site & Stakeholder Register", false);
      const leftX = 20;
      const rightX = 110;
      let y = this.currentY;
      if (site.thumbnail) {
          try {
              const imgData = await getBase64ImageFromUrl(site.thumbnail);
              if (imgData) {
                  this.doc.addImage(imgData, 'JPEG', leftX, y, 80, 60, undefined, 'FAST');
                  this.doc.rect(leftX, y, 80, 60);
              }
          } catch (e) {
              this.doc.rect(leftX, y, 80, 60);
              this.doc.text("Image Unavailable", leftX + 25, y + 30);
          }
      } else {
          this.doc.rect(leftX, y, 80, 60);
          this.doc.text("No Image", leftX + 30, y + 30);
      }

      const dna = site.identity;
      const partRows = [
          ["Address", dna.address],
          ["Land Area", `${dna.landArea.toLocaleString()} sqm`],
          ["Local Council", dna.lga],
          ["Zoning", `${dna.zoning} ${dna.zoningCode ? `(${dna.zoningCode})` : ''}`],
          ["Title / Folio", dna.titleReference || "TBC"],
          ["Permit Status", site.planning.permitStatus || "Not Started"],
          ["Jurisdiction", dna.state]
      ];

      autoTable(this.doc, {
          startY: y,
          margin: { left: rightX },
          head: [['Item', 'Detail']],
          body: partRows,
          theme: 'grid',
          styles: { fontSize: 9, cellPadding: 2, font: FONTS.body },
          headStyles: { fillColor: COLORS.secondary, textColor: 255, fontStyle: 'bold' },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } }
      });

      this.currentY = y + 70;
      this.doc.setFont(FONTS.header, "bold");
      this.doc.setFontSize(11);
      this.doc.setTextColor(COLORS.text);
      this.doc.text("Project Stakeholders", leftX, this.currentY);
      this.currentY += 4;
      const stakeholders = site.stakeholders && site.stakeholders.length > 0 
          ? site.stakeholders 
          : [{ role: 'Agent', name: site.acquisition.agent?.name || '-', company: site.acquisition.agent?.company || '-', email: '' }];

      autoTable(this.doc, {
          startY: this.currentY,
          head: [['Role', 'Name', 'Company', 'Contact']],
          body: stakeholders.map(s => [s.role, s.name, s.company, s.email || '-']),
          theme: 'striped',
          styles: { fontSize: 9, cellPadding: 3, font: FONTS.body },
          headStyles: { fillColor: COLORS.primary }
      });
  }

  private addValuersPnL(scenario: FeasibilityScenario, report: ReportModel, site: Site) {
    this.addPageHeader("Financial Analysis", "Profit & Loss Statement", false);
    const metrics = report.metrics;
    const detailedItems = report.itemSummaries || [];
    const rows: any[] = [];
    const addRow = (label: string, detail: string | null, subtotal: string | null, style: 'header'|'item'|'total'|'spacer' = 'item', indent = false) => {
        rows.push({ label, detail, subtotal, style, indent });
    };

    addRow("GROSS REALISATION", null, null, 'header');
    addRow("Gross Sales Revenue", formatCurrency(metrics.grossRealisation), null);
    addRow("Less: GST Liability", formatCurrency(metrics.gstOnSales * -1), null);
    addRow("NET REALISATION", null, formatCurrency(metrics.netRealisation), 'total');
    addRow("", null, null, 'spacer');

    addRow("DEVELOPMENT COSTS (NET EX GST)", null, null, 'header');
    const processCategory = (cat: CostCategory, label: string) => {
        const catItems = detailedItems.filter(i => i.category === cat);
        if (catItems.length === 0) return;
        addRow(label, null, null, 'header');
        catItems.forEach(i => {
            addRow(i.description, formatCurrency(i.netAmount), null, 'item', true);
        });
        const catSum = catItems.reduce((acc, i) => acc + i.netAmount, 0);
        addRow(`Total ${label}`, null, formatCurrency(catSum), 'total');
        addRow("", null, null, 'spacer');
    };
    processCategory(CostCategory.LAND, "Land & Acquisition");
    processCategory(CostCategory.CONSTRUCTION, "Construction");
    processCategory(CostCategory.CONSULTANTS, "Consultants");
    processCategory(CostCategory.STATUTORY, "Statutory & General");
    processCategory(CostCategory.SELLING, "Selling & Marketing");
    processCategory(CostCategory.MISCELLANEOUS, "Miscellaneous");

    addRow("Finance Costs", null, null, 'header');
    addRow("Interest & Line Fees", null, formatCurrency(metrics.totalFinanceCost), 'total');
    addRow("", null, null, 'spacer');
    addRow("TOTAL DEVELOPMENT COSTS", null, formatCurrency(metrics.totalCostNet), 'header'); 
    addRow("", null, null, 'spacer');
    addRow("NET DEVELOPMENT PROFIT", null, formatCurrency(metrics.netProfit), 'header');
    addRow("DEVELOPMENT MARGIN", null, formatPct(metrics.devMarginPct), 'total');

    autoTable(this.doc, {
        startY: this.currentY,
        head: [['Item', 'Amount', 'Subtotal']],
        body: rows.map(r => [r.label, r.detail, r.subtotal]),
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1.2, font: FONTS.body },
        columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 40, halign: 'right', font: FONTS.mono }, 2: { cellWidth: 40, halign: 'right', font: FONTS.mono, fontStyle: 'bold' } },
        didParseCell: (data) => {
            const rowInfo = rows[data.row.index];
            if (data.section === 'head') { data.cell.styles.fillColor = COLORS.primary; data.cell.styles.textColor = 255; }
            if (data.section === 'body') {
                if (rowInfo.style === 'header') { data.cell.styles.fillColor = COLORS.lightGray; data.cell.styles.fontStyle = 'bold'; }
                else if (rowInfo.style === 'item') { if (data.column.index === 0) data.cell.styles.cellPadding = { top: 1, bottom: 1, left: rowInfo.indent ? 8 : 2, right: 1 }; }
                else if (rowInfo.style === 'total' && data.column.index === 2) { data.cell.styles.lineWidth = { top: 0.1, bottom: 0, left: 0, right: 0 }; }
            }
        }
    });
    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
  }

  private addSensitivityAnalysis(matrix: SensitivityCell[][], scenario: FeasibilityScenario) {
    this.addPageHeader("Risk Analysis", "Sensitivity Matrix (Cost vs Revenue)", false);
    const steps = [-15, -10, -5, 0, 5, 10, 15];
    const headerRow = ['Cost \\ Rev', ...steps.map(s => s > 0 ? `+${s}%` : `${s}%`)];
    const body = matrix.map((row, i) => {
        const yLabel = steps[i] > 0 ? `+${steps[i]}%` : `${steps[i]}%`;
        return [yLabel, ...row.map(cell => cell.margin.toFixed(2) + '%')];
    });
    this.doc.setFontSize(10);
    this.doc.text("Table displays Development Margin (%)", 20, this.currentY);
    this.currentY += 5;
    autoTable(this.doc, {
        startY: this.currentY,
        head: [headerRow],
        body: body,
        theme: 'grid',
        headStyles: { fillColor: COLORS.primary, halign: 'center' },
        columnStyles: { 0: { fontStyle: 'bold', fillColor: COLORS.lightGray, halign: 'center' } },
        styles: { halign: 'center', cellPadding: 3, fontSize: 8 },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index > 0) {
                const val = parseFloat(data.cell.raw as string);
                if (val < 0) { data.cell.styles.fillColor = "#fecaca"; data.cell.styles.textColor = "#991b1b"; }
                else if (val >= 20) { data.cell.styles.fillColor = "#bbf7d0"; data.cell.styles.textColor = "#166534"; }
            }
        }
    });
  }

  private addRiskReport(riskTables: Record<string, SensitivityRow[]>, projectName: string) {
    this.addPageHeader("Risk & Sensitivity Report", "Variable Impact Analysis", false);
    const renderTable = (title: string, data: SensitivityRow[], inputHeader: string) => {
        if (this.currentY > 230) { this.doc.addPage(); this.addPageHeader("Risk & Sensitivity Report (Cont.)", "Variable Impact Analysis", false); }
        this.doc.setFont(FONTS.header, "bold");
        this.doc.setFontSize(11);
        this.doc.text(title, 20, this.currentY);
        this.currentY += 3;
        autoTable(this.doc, {
            startY: this.currentY,
            head: [['Variance', inputHeader, 'Total Dev Cost', 'Net Profit', 'Margin', 'IRR']],
            body: data.map(row => [row.varianceLabel, formatCurrency(row.variableValue), formatCurrency(row.devCost), formatCurrency(row.netProfit), formatPct(row.margin), formatPct(row.irr)]),
            theme: 'striped',
            styles: { fontSize: 8, cellPadding: 2, halign: 'right', font: FONTS.mono },
            columnStyles: { 0: { halign: 'left', fontStyle: 'bold', font: FONTS.body } },
            headStyles: { fillColor: COLORS.secondary, halign: 'center' }
        });
        this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
    };
    renderTable("1. Land Price Sensitivity", riskTables['land'], "Land Price");
    renderTable("2. Construction Cost Sensitivity", riskTables['cost'], "Construction Total");
  }

  private addItemisedCashflow(data: ItemisedCashflow, projectName: string, startPageNum: number) {
    const monthsPerPage = 8; // FIX: Reduced from 12 for better spacing
    const totalMonths = data.headers.length;
    const totalPagesHorizontal = Math.ceil(totalMonths / monthsPerPage);
    let currentPageNum = startPageNum;

    for (let i = 0; i < totalPagesHorizontal; i++) {
        this.doc.addPage("a4", "landscape");
        const startIdx = i * monthsPerPage;
        const endIdx = Math.min(startIdx + monthsPerPage, totalMonths);
        const currentHeaders = data.headers.slice(startIdx, endIdx);

        this.addPageHeader("Cashflow Forecast", `Months ${startIdx + 1} - ${endIdx} of ${totalMonths}`, true);

        const tableHeaders = [['Item', ...currentHeaders, 'Total']];
        const tableBody: any[] = [];

        data.categories.forEach(cat => {
            tableBody.push([{ content: cat.name.toUpperCase(), colSpan: currentHeaders.length + 2, styles: { fillColor: [241, 245, 249], fontStyle: 'bold' } }]);
            cat.rows.forEach(row => {
                const slice = row.values.slice(startIdx, endIdx);
                // FIX: Ensure values show as "-" if zero instead of "="
                const formattedSlice = slice.map(v => Math.abs(v) < 1 ? "-" : Math.round(v).toLocaleString());
                tableBody.push([row.label, ...formattedSlice, formatCurrency(row.total)]);
            });
        });

        autoTable(this.doc, {
            startY: 30,
            head: tableHeaders,
            body: tableBody,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 2, font: "courier", overflow: 'linebreak' },
            headStyles: { fillColor: [30, 41, 59], halign: 'center' },
            columnStyles: {
                0: { cellWidth: 45, font: "helvetica", fontStyle: 'bold' },
                [currentHeaders.length + 1]: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }
            },
            didParseCell: (data) => {
                if (data.column.index > 0 && data.column.index <= currentHeaders.length) {
                    data.cell.styles.halign = 'right';
                }
            }
        });
        
        this.addPageFooter(currentPageNum++, projectName, true);
    }
  }
}
