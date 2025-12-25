
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
  if (val === 0) return "-";
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
    siteDNA: SiteDNA, // Kept for interface compatibility but we rely on Site object mainly
    sensitivityMatrix: SensitivityCell[][],
    riskTables?: Record<string, SensitivityRow[]>
  ) {
    const builder = new PdfService();
    
    // 1. Cover Page (Portrait)
    await builder.addCoverPage(site, scenario);
    
    // 2. Executive Summary (Feastudy Style)
    builder.addNewPage("portrait");
    builder.addFeasibilitySummary(site, scenario, report, sensitivityMatrix);
    builder.addPageFooter(2, site.name);

    // 3. Asset Fact Sheet (New)
    builder.addNewPage("portrait");
    await builder.addAssetFactSheet(site);
    builder.addPageFooter(3, site.name);

    // 4. Valuer's P&L (Portrait)
    builder.addNewPage("portrait");
    builder.addValuersPnL(scenario, report, site); 
    builder.addPageFooter(4, site.name);

    // 5. Sensitivity Analysis (Portrait)
    builder.addNewPage("portrait");
    builder.addSensitivityAnalysis(sensitivityMatrix, scenario);
    builder.addPageFooter(5, site.name);

    // 6. Risk Report
    if (riskTables) {
      builder.addNewPage("portrait");
      builder.addRiskReport(riskTables, site.name);
      builder.addPageFooter(6, site.name);
    }

    // 7. Itemised Cashflow (Landscape - Smart Pagination)
    // Starts at Page 7
    builder.addItemisedCashflow(report.cashflow.itemised, site.name, 7);

    // Save
    const filename = `Investment_Memo_${site.code}_${new Date().toISOString().split('T')[0]}.pdf`;
    builder.doc.save(filename);
  }

  private addNewPage(orientation: 'portrait' | 'landscape') {
    this.doc.addPage("a4", orientation);
    this.currentY = 0;
  }

  // --- COMPONENT: FEASTUDY SUMMARY PAGE ---
  private addFeasibilitySummary(site: Site, scenario: FeasibilityScenario, report: ReportModel, sensitivityMatrix: SensitivityCell[][]) {
      this.addPageHeader("Development Summary", "Key Performance Indicators", false);

      const leftX = 20;
      const rightX = 110;
      let y = this.currentY;
      const metrics = report.metrics;

      // Helper to draw dotted line row
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

      // LEFT COLUMN: PROJECT RETURNS
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

      // RIGHT COLUMN: EQUITY & DEBT
      y = this.currentY; // Reset Y
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

      // RISK ALERT BOX
      let isRisk = false;
      if (sensitivityMatrix && sensitivityMatrix.length > 4 && sensitivityMatrix[4][3]) {
          if (sensitivityMatrix[4][3].margin < 0) isRisk = true;
      }

      if (isRisk) {
          this.doc.setDrawColor(220, 38, 38); // Red
          this.doc.setLineWidth(0.5);
          this.doc.setFillColor(254, 242, 242); // Red 50
          this.doc.rect(20, this.currentY, 170, 12, 'FD');
          
          this.doc.setTextColor(185, 28, 28); // Red 700
          this.doc.setFont(FONTS.header, "bold");
          this.doc.setFontSize(10);
          this.doc.text("HIGH RISK ALERT:", 25, this.currentY + 7);
          
          this.doc.setFont(FONTS.body, "normal");
          this.doc.text("Project becomes loss-making with <5% cost overrun.", 60, this.currentY + 7);
          
          this.currentY += 20;
      } else {
          this.currentY += 5;
      }

      // GST RECONCILIATION BOX
      this.doc.setDrawColor(COLORS.border);
      this.doc.setFillColor(255, 255, 255);
      this.doc.rect(20, this.currentY, 170, 45); // Adjust height
      
      this.doc.setFont(FONTS.header, "bold");
      this.doc.setFontSize(10);
      this.doc.setTextColor(COLORS.secondary);
      this.doc.text("GST Reconciliation", 25, this.currentY + 6);
      
      let recY = this.currentY + 12;
      const recX = 25;
      const recW = 75;
      
      // Col 1: Costs
      this.doc.setFontSize(8);
      drawDottedRow("Total Gross Costs", formatCurrency(report.reconciliation.totalCostGross), recX, recW);
      recY = this.currentY; // Capture Y incremented by helper
      this.currentY -= 7; // Reset slightly for next call
      drawDottedRow("Less: Input Tax Credits", formatCurrency(report.reconciliation.gstInputCredits), recX, recW);
      this.doc.setFont(FONTS.body, "bold");
      drawDottedRow("Total Net Costs", formatCurrency(report.reconciliation.totalCostNet), recX, recW, true);
      
      // Col 2: Sales
      this.currentY = recY - 14; // Reset to top
      const col2X = 110;
      this.doc.setFont(FONTS.body, "normal");
      drawDottedRow("Total Gross Sales", formatCurrency(report.reconciliation.grossRealisation), col2X, recW);
      drawDottedRow("Less: GST Payable", formatCurrency(report.reconciliation.gstPayable), col2X, recW);
      this.doc.setFont(FONTS.body, "bold");
      drawDottedRow("Net Realisation", formatCurrency(report.reconciliation.netRealisation), col2X, recW, true);

      this.currentY = recY + 5; 
      
      // Project Description Box
      this.doc.setTextColor(COLORS.text);
      this.doc.setFont(FONTS.header, "bold");
      this.doc.setFontSize(12);
      this.doc.text("Project Context", leftX, this.currentY);
      this.currentY += 6;
      this.doc.setFont(FONTS.body, "normal");
      this.doc.setFontSize(10);
      
      const desc = scenario.settings.description || "No description provided.";
      const lines = this.doc.splitTextToSize(desc, 170);
      this.doc.text(lines, leftX, this.currentY);
  }

  // --- COMPONENT: ASSET FACT SHEET (Page 2) ---
  private async addAssetFactSheet(site: Site) {
      this.addPageHeader("Asset Particulars", "Site & Stakeholder Register", false);
      
      const leftX = 20;
      const rightX = 110;
      let y = this.currentY;

      // 1. Map / Image (Top Left)
      this.doc.setDrawColor(COLORS.border);
      if (site.thumbnail) {
          try {
              const imgData = await getBase64ImageFromUrl(site.thumbnail);
              if (imgData) {
                  this.doc.addImage(imgData, 'JPEG', leftX, y, 80, 60, undefined, 'FAST');
                  this.doc.rect(leftX, y, 80, 60); // Border
              }
          } catch (e) {
              this.doc.rect(leftX, y, 80, 60);
              this.doc.text("Image Unavailable", leftX + 25, y + 30);
          }
      } else {
          this.doc.rect(leftX, y, 80, 60);
          this.doc.text("No Image", leftX + 30, y + 30);
      }

      // 2. Site Particulars Table (Top Right)
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
          startY: y - 2, // Align top
          margin: { left: rightX },
          head: [['Item', 'Detail']],
          body: partRows,
          theme: 'grid',
          styles: { fontSize: 9, cellPadding: 2, font: FONTS.body },
          headStyles: { fillColor: COLORS.secondary, textColor: 255, fontStyle: 'bold' },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } },
          showHead: 'everyPage' // Prevent orphan headers
      });

      this.currentY = y + 70;

      // 3. Stakeholder Register (Bottom)
      this.doc.setFont(FONTS.header, "bold");
      this.doc.setFontSize(11);
      this.doc.setTextColor(COLORS.text);
      this.doc.text("Project Stakeholders", leftX, this.currentY);
      this.currentY += 4;

      const stakeholders = site.stakeholders && site.stakeholders.length > 0 
          ? site.stakeholders 
          : [ // Default rows if empty for layout
              { role: 'Agent', name: site.acquisition.agent?.name || '-', company: site.acquisition.agent?.company || '-', email: '' },
              { role: 'Vendor', name: site.acquisition.vendor.name || '-', company: site.acquisition.vendor.company || '-', email: '' }
          ];

      autoTable(this.doc, {
          startY: this.currentY,
          head: [['Role', 'Name', 'Company', 'Contact']],
          body: stakeholders.map(s => [s.role, s.name, s.company, s.email || '-']),
          theme: 'striped',
          styles: { fontSize: 9, cellPadding: 3, font: FONTS.body },
          headStyles: { fillColor: COLORS.primary },
          columnStyles: { 0: { fontStyle: 'bold' } },
          showHead: 'everyPage'
      });
  }

  // --- COMPONENT: COVER PAGE ---
  private async addCoverPage(site: Site, scenario: FeasibilityScenario) {
    const pageWidth = 210;
    const pageHeight = 297;

    // 1. Hero Image Top Half
    if (site.thumbnail) {
        try {
            const imgData = await getBase64ImageFromUrl(site.thumbnail);
            if (imgData) {
                this.doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, 140, undefined, 'FAST');
            }
        } catch (e) { /* Fallback */ }
    } else {
        // Fallback color block
        this.doc.setFillColor(COLORS.primary);
        this.doc.rect(0, 0, pageWidth, 140, 'F');
    }

    this.currentY = 160;

    // 2. Title Section
    this.doc.setTextColor(COLORS.primary);
    this.doc.setFont(FONTS.header, "bold");
    this.doc.setFontSize(28);
    // Split title if too long
    const titleLines = this.doc.splitTextToSize(site.name.toUpperCase(), 170);
    this.doc.text(titleLines, 20, this.currentY);
    
    this.currentY += (12 * titleLines.length) + 5;
    
    this.doc.setFont(FONTS.header, "normal");
    this.doc.setFontSize(14);
    this.doc.setTextColor(COLORS.secondary);
    this.doc.text(site.identity.address, 20, this.currentY);

    this.currentY += 15;
    
    // Line separator
    this.doc.setDrawColor(COLORS.accent);
    this.doc.setLineWidth(1);
    this.doc.line(20, this.currentY, 100, this.currentY);

    // 3. Scenario Tag
    this.currentY += 15;
    this.doc.setFontSize(18);
    this.doc.setTextColor(COLORS.text);
    this.doc.text("Investment Memorandum", 20, this.currentY);
    
    this.currentY += 8;
    this.doc.setFontSize(12);
    this.doc.setTextColor(COLORS.secondary);
    this.doc.text(`Scenario: ${scenario.name}`, 20, this.currentY);

    // 4. Footer Info
    this.doc.setFontSize(10);
    this.doc.setTextColor(150);
    this.doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, pageHeight - 30);
    this.doc.text("Prepared by SH Connect", 20, pageHeight - 25);
    this.doc.text("Commercial in Confidence", pageWidth - 20, pageHeight - 25, { align: 'right' });
  }

  // --- COMPONENT: VALUER'S P&L ---
  private addValuersPnL(scenario: FeasibilityScenario, report: ReportModel, site: Site) {
    this.addPageHeader("Financial Analysis", "Profit & Loss Statement", false);

    const metrics = report.metrics;
    
    // Use pre-calculated Item Summaries from the Report Model
    // These contain strict NET amounts inclusive of escalation logic
    const detailedItems = report.itemSummaries || [];

    // 2. Prepare Table Data
    const rows: any[] = [];
    const addRow = (label: string, detail: string | null, subtotal: string | null, style: 'header'|'item'|'total'|'spacer' = 'item', indent = false) => {
        rows.push({ label, detail, subtotal, style, indent });
    };

    // --- REVENUE SECTION ---
    addRow("GROSS REALISATION", null, null, 'header');
    addRow("Gross Sales Revenue", formatCurrency(metrics.grossRealisation), null);
    addRow("Less: GST Liability", formatCurrency(metrics.gstOnSales * -1), null);
    addRow("NET REALISATION", null, formatCurrency(metrics.netRealisation), 'total');
    addRow("", null, null, 'spacer');

    // --- COSTS SECTION ---
    addRow("DEVELOPMENT COSTS (NET EX GST)", null, null, 'header');

    // Helper to process a category
    const processCategory = (cat: CostCategory, label: string) => {
        const catItems = detailedItems.filter(i => i.category === cat);
        if (catItems.length === 0) return;

        addRow(label, null, null, 'header');
        let catSum = 0;
        
        catItems.forEach(i => {
            addRow(i.description, formatCurrency(i.netAmount), null, 'item', true);
            catSum += i.netAmount;
        });
        
        addRow(`Total ${label}`, null, formatCurrency(catSum), 'total');
        addRow("", null, null, 'spacer');
    };

    processCategory(CostCategory.LAND, "Land & Acquisition");
    processCategory(CostCategory.CONSTRUCTION, "Construction");
    processCategory(CostCategory.CONSULTANTS, "Consultants");
    processCategory(CostCategory.STATUTORY, "Statutory & General");
    processCategory(CostCategory.SELLING, "Selling & Marketing");
    processCategory(CostCategory.MISCELLANEOUS, "Miscellaneous");

    // Finance (High Level from Metrics)
    addRow("Finance Costs", null, null, 'header');
    addRow("Interest & Line Fees", null, formatCurrency(metrics.totalFinanceCost), 'total');
    addRow("", null, null, 'spacer');

    // Bottom Line
    addRow("TOTAL DEVELOPMENT COSTS", null, formatCurrency(metrics.totalCostNet), 'header'); 
    addRow("", null, null, 'spacer');
    addRow("NET DEVELOPMENT PROFIT", null, formatCurrency(metrics.netProfit), 'header');
    addRow("DEVELOPMENT MARGIN", null, formatPct(metrics.devMarginPct), 'total');

    // Render Main P&L Table
    autoTable(this.doc, {
        startY: this.currentY,
        head: [['Item', 'Amount', 'Subtotal']],
        body: rows.map(r => [r.label, r.detail, r.subtotal]),
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1.2, font: FONTS.body },
        columnStyles: {
            0: { cellWidth: 110 },
            1: { cellWidth: 40, halign: 'right', font: FONTS.mono },
            2: { cellWidth: 40, halign: 'right', font: FONTS.mono, fontStyle: 'bold' }
        },
        showHead: 'everyPage',
        didParseCell: (data) => {
            const rowInfo = rows[data.row.index];
            if (data.section === 'head') {
                data.cell.styles.fillColor = COLORS.primary;
                data.cell.styles.textColor = 255;
                data.cell.styles.fontStyle = 'bold';
            }
            if (data.section === 'body') {
                if (rowInfo.style === 'header') {
                    data.cell.styles.fillColor = COLORS.lightGray;
                    data.cell.styles.fontStyle = 'bold';
                    if (rowInfo.label.includes("NET DEVELOPMENT PROFIT")) {
                        data.cell.styles.textColor = COLORS.accent;
                    }
                } else if (rowInfo.style === 'item') {
                    if (data.column.index === 0) {
                        data.cell.styles.cellPadding = { top: 1, bottom: 1, left: rowInfo.indent ? 8 : 2, right: 1 };
                    }
                } else if (rowInfo.style === 'total') {
                    if (data.column.index === 2) {
                        data.cell.styles.lineWidth = { top: 0.1, bottom: 0, left: 0, right: 0 };
                    }
                }
            }
        }
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;

    // --- BASIS & RECONCILIATION BOX ---
    // Ensure we don't break page
    if (this.currentY > 250) this.doc.addPage();

    this.doc.setDrawColor(COLORS.border);
    this.doc.setFillColor(250, 250, 250);
    this.doc.rect(20, this.currentY, 170, 30); // Box background

    this.doc.setFont(FONTS.header, "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(COLORS.secondary);
    this.doc.text("Basis of Presentation: Net (Ex GST)", 25, this.currentY + 6);

    // Mini Table for GST Rec
    const startTableY = this.currentY + 10;
    
    // Headers
    this.doc.setFontSize(8);
    this.doc.text("Metric", 25, startTableY);
    this.doc.text("Gross (Inc GST)", 80, startTableY, { align: 'right' });
    this.doc.text("GST Component", 120, startTableY, { align: 'right' });
    this.doc.text("Net (Ex GST)", 160, startTableY, { align: 'right' });
    
    this.doc.line(25, startTableY + 2, 185, startTableY + 2); // Header Line

    const drawRecRow = (label: string, gross: number, gst: number, net: number, yPos: number) => {
        this.doc.setFont(FONTS.body, "normal");
        this.doc.text(label, 25, yPos);
        this.doc.setFont(FONTS.mono, "normal");
        this.doc.text(formatCurrency(gross), 80, yPos, { align: 'right' });
        this.doc.text(formatCurrency(gst), 120, yPos, { align: 'right' });
        this.doc.setFont(FONTS.mono, "bold");
        this.doc.text(formatCurrency(net), 160, yPos, { align: 'right' });
    };

    drawRecRow("Total Revenue", metrics.grossRealisation, metrics.gstOnSales, metrics.netRealisation, startTableY + 7);
    drawRecRow("Total Costs", metrics.totalCostGross, metrics.gstInputCredits, metrics.totalCostNet, startTableY + 13);
    
    // Net Position
    this.doc.setFont(FONTS.body, "bold");
    this.doc.text("Net Position", 25, startTableY + 19);
    // Gross Profit
    this.doc.setFont(FONTS.mono, "normal");
    this.doc.text(formatCurrency(metrics.grossRealisation - metrics.totalCostGross), 80, startTableY + 19, { align: 'right' });
    // Net GST Payable
    this.doc.text(formatCurrency(metrics.netGstPayable), 120, startTableY + 19, { align: 'right' });
    // Net Profit
    this.doc.text(formatCurrency(metrics.netProfit), 160, startTableY + 19, { align: 'right' });

    this.currentY += 35;
  }

  // --- COMPONENT: SENSITIVITY ANALYSIS ---
  private addSensitivityAnalysis(matrix: SensitivityCell[][], scenario: FeasibilityScenario) {
    this.addPageHeader("Risk Analysis", "Sensitivity Matrix (Cost vs Revenue)", false);

    // Get axis steps
    const steps = [-15, -10, -5, 0, 5, 10, 15];
    const headerRow = ['Cost \\ Rev', ...steps.map(s => s > 0 ? `+${s}%` : `${s}%`)];

    // Build Body
    const body = matrix.map((row, i) => {
        const yLabel = steps[i] > 0 ? `+${steps[i]}%` : `${steps[i]}%`;
        const cells = row.map(cell => cell.margin.toFixed(2) + '%');
        return [yLabel, ...cells];
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
        styles: { halign: 'center', cellPadding: 4, fontSize: 10 },
        showHead: 'everyPage',
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index > 0) {
                const val = parseFloat(data.cell.raw as string);
                data.cell.styles.fontStyle = 'bold';
                if (val < 0) {
                    data.cell.styles.fillColor = "#fecaca"; 
                    data.cell.styles.textColor = "#991b1b"; 
                } else if (val < 10) {
                    data.cell.styles.fillColor = "#fde68a"; 
                    data.cell.styles.textColor = "#92400e"; 
                } else if (val >= 20) {
                    data.cell.styles.fillColor = "#bbf7d0"; 
                    data.cell.styles.textColor = "#166534"; 
                }
            }
        }
    });
  }

  // --- COMPONENT: RISK REPORT ---
  private addRiskReport(riskTables: Record<string, SensitivityRow[]>, projectName: string) {
    this.addPageHeader("Risk & Sensitivity Report", "Variable Impact Analysis", false);

    const renderTable = (title: string, data: SensitivityRow[], inputHeader: string) => {
        if (this.currentY > 230) {
            this.doc.addPage();
            this.addPageHeader("Risk & Sensitivity Report (Cont.)", "Variable Impact Analysis", false);
        }

        this.doc.setFont(FONTS.header, "bold");
        this.doc.setFontSize(11);
        this.doc.setTextColor(COLORS.text);
        this.doc.text(title, 20, this.currentY);
        this.currentY += 3;

        autoTable(this.doc, {
            startY: this.currentY,
            head: [['Variance', inputHeader, 'Total Dev Cost', 'Net Profit', 'Margin', 'IRR']],
            body: data.map(row => [
                row.varianceLabel,
                inputHeader.includes('Month') ? row.variableValue + ' Mo' : 
                inputHeader.includes('Rate') ? row.variableValue.toFixed(2) + '%' : 
                formatCurrency(row.variableValue),
                formatCurrency(row.devCost),
                formatCurrency(row.netProfit),
                formatPct(row.margin),
                formatPct(row.irr)
            ]),
            theme: 'striped',
            styles: { fontSize: 9, cellPadding: 2, halign: 'right', font: FONTS.mono },
            columnStyles: { 
                0: { halign: 'left', fontStyle: 'bold', font: FONTS.body },
                1: { fontStyle: 'bold' }
            },
            headStyles: { fillColor: COLORS.secondary, halign: 'center' },
            showHead: 'everyPage',
            didParseCell: (data) => {
                const rowIndex = data.row.index;
                const isBaseCase = data.table.body[rowIndex].raw[0] === 'Base Case';
                
                if (data.section === 'body') {
                    if (isBaseCase) {
                        data.cell.styles.fillColor = "#e0f2fe"; 
                        data.cell.styles.fontStyle = 'bold';
                    }
                    if (data.column.index === 4) { 
                        const val = parseFloat(data.cell.raw as string);
                        if (val < 15) data.cell.styles.textColor = "#dc2626";
                        if (val > 20) data.cell.styles.textColor = "#166534";
                    }
                    if (data.column.index === 5) { 
                        // IRR can be N/A
                        const raw = data.cell.raw as string;
                        if (raw === "N/A") {
                             data.cell.styles.textColor = "#9ca3af";
                        } else {
                            const val = parseFloat(raw);
                            if (val < 15) data.cell.styles.textColor = "#dc2626";
                            if (val > 20) data.cell.styles.textColor = "#166534";
                        }
                    }
                }
            }
        });

        this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
    };

    renderTable("1. Land Price Sensitivity", riskTables['land'], "Land Price");
    renderTable("2. Construction Cost Sensitivity", riskTables['cost'], "Construction Total");
    renderTable("3. Sales Revenue Sensitivity", riskTables['revenue'], "Gross Revenue");
    renderTable("4. Time Sensitivity (Delays)", riskTables['duration'], "Project Duration");
    renderTable("5. Interest Rate Sensitivity", riskTables['interest'], "Senior Rate");
  }

  // --- COMPONENT: ITEMISED CASHFLOW (Landscape) ---
  private addItemisedCashflow(data: ItemisedCashflow, projectName: string, startPageNum: number) {
    const monthsPerPage = 12; 
    const totalMonths = data.headers.length;
    const totalPagesHorizontal = Math.ceil(totalMonths / monthsPerPage);
    let currentPageNum = startPageNum;

    for (let i = 0; i < totalPagesHorizontal; i++) {
        // Landscape Page
        this.doc.addPage("a4", "landscape");
        const pageWidth = 297; 
        
        // Custom Landscape Header
        this.addPageHeader("Cashflow Forecast", `Period: Month ${i * monthsPerPage + 1} - ${Math.min((i + 1) * monthsPerPage, totalMonths)}`, true);

        // Slice Data
        const startIdx = i * monthsPerPage;
        const endIdx = Math.min(startIdx + monthsPerPage, totalMonths);
        const currentHeaders = data.headers.slice(startIdx, endIdx);

        // Build Table
        const tableBody: any[] = [];
        const columns = [
            { header: 'Item', dataKey: '0' },
            ...currentHeaders.map((h, idx) => ({ header: h, dataKey: (idx + 1).toString() })),
            { header: 'Total', dataKey: (currentHeaders.length + 1).toString() }
        ];

        // Dynamic Column Styles to prevent stretching
        const colStyles: any = {
            0: { cellWidth: 50, halign: 'left', font: FONTS.body }, // Item Label
            [currentHeaders.length + 1]: { cellWidth: 20, fontStyle: 'bold' } // Total
        };
        // Fix monthly columns width
        for(let k=1; k <= currentHeaders.length; k++) {
            colStyles[k] = { cellWidth: 16, halign: 'right' };
        }

        // Process Categories
        data.categories.forEach(cat => {
            tableBody.push({ 0: cat.name.toUpperCase(), type: 'header' });

            // Items
            cat.rows.forEach(row => {
                const slice = row.values.slice(startIdx, endIdx);
                const sliceSum = slice.reduce((a,b)=>a+b, 0);
                
                if (row.total !== 0) {
                    const rowObj: any = { 0: row.label, type: 'item' };
                    slice.forEach((v, k) => rowObj[k+1] = v === 0 ? '-' : Math.round(v).toLocaleString());
                    rowObj[currentHeaders.length + 1] = formatCurrency(sliceSum);
                    tableBody.push(rowObj);
                }
            });

            // Subtotal
            const subSlice = cat.monthlyTotals.slice(startIdx, endIdx);
            const subSum = subSlice.reduce((a,b)=>a+b,0);
            const subRow: any = { 0: `Total ${cat.name}`, type: 'subtotal' };
            subSlice.forEach((v, k) => subRow[k+1] = formatCurrency(v));
            subRow[currentHeaders.length + 1] = formatCurrency(subSum);
            tableBody.push(subRow);
        });

        // Net Flow
        const netSlice = data.netCashflow.slice(startIdx, endIdx);
        const netSum = netSlice.reduce((a,b)=>a+b,0);
        const netRow: any = { 0: "NET MONTHLY CASHFLOW", type: 'net' };
        netSlice.forEach((v, k) => netRow[k+1] = formatCurrency(v));
        netRow[currentHeaders.length + 1] = formatCurrency(netSum);
        tableBody.push(netRow);

        autoTable(this.doc, {
            startY: this.currentY,
            columns: columns,
            body: tableBody,
            theme: 'plain',
            tableWidth: 'wrap', // Strict width control
            styles: { fontSize: 7, cellPadding: 1.5, halign: 'right', font: FONTS.mono },
            columnStyles: colStyles,
            headStyles: { fillColor: COLORS.primary, textColor: 255, halign: 'center', fontStyle: 'bold' },
            showHead: 'everyPage',
            didParseCell: (data) => {
                if (data.section === 'body') {
                    const type = data.row.raw.type;
                    if (type === 'header') {
                        data.cell.styles.fillColor = COLORS.lightGray;
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.halign = 'left';
                    } else if (type === 'item') {
                        if (data.column.index === 0) data.cell.styles.cellPadding = { top:1, bottom:1, left:5, right:1 };
                    } else if (type === 'subtotal') {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.lineWidth = { top: 0.1, bottom: 0, left:0, right:0 };
                    } else if (type === 'net') {
                        data.cell.styles.fillColor = COLORS.primary;
                        data.cell.styles.textColor = 255;
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        });

        this.addPageFooter(currentPageNum, projectName, true);
        currentPageNum++;
    }
  }

  // --- HELPERS ---
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
}
