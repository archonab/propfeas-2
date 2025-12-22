
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Site, FeasibilityScenario, CostCategory, SiteDNA, MonthlyFlow, ItemisedCashflow, SensitivityRow } from "../types";
import { FinanceEngine } from "./financeEngine";
import { SensitivityCell, SensitivityService } from "./sensitivityService";

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

const formatPct = (val: number) => `${val.toFixed(2)}%`;

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
    stats: any, // We will use this if passed, but prefer recalc for safety
    cashflow: MonthlyFlow[],
    siteDNA: SiteDNA,
    sensitivityMatrix: SensitivityCell[][],
    riskTables?: Record<string, SensitivityRow[]>
  ) {
    const builder = new PdfService();
    const itemisedData = FinanceEngine.generateItemisedCashflowData(scenario, siteDNA);
    
    // Recalculate robust metrics for the report
    const metrics = FinanceEngine.calculateProjectMetrics(cashflow, scenario.settings);

    // 1. Cover Page (Portrait)
    await builder.addCoverPage(site, scenario);
    
    // 2. Executive Summary (Feastudy Style)
    builder.addNewPage("portrait");
    builder.addFeasibilitySummary(site, scenario, metrics);
    builder.addPageFooter(2, site.name);

    // 3. Valuer's P&L (Portrait)
    builder.addNewPage("portrait");
    builder.addValuersPnL(scenario, siteDNA, metrics); // Pass metrics
    builder.addPageFooter(3, site.name);

    // 4. Sensitivity Analysis (Portrait)
    builder.addNewPage("portrait");
    builder.addSensitivityAnalysis(sensitivityMatrix, scenario);
    builder.addPageFooter(4, site.name);

    // 5. Risk Report (New)
    if (riskTables) {
      builder.addNewPage("portrait");
      builder.addRiskReport(riskTables, site.name);
      builder.addPageFooter(5, site.name);
    }

    // 6. Itemised Cashflow (Landscape - Smart Pagination)
    // Starts at Page 6
    builder.addItemisedCashflow(itemisedData, site.name, 6);

    // Save
    const filename = `Investment_Memo_${site.code}_${new Date().toISOString().split('T')[0]}.pdf`;
    builder.doc.save(filename);
  }

  private addNewPage(orientation: 'portrait' | 'landscape') {
    this.doc.addPage("a4", orientation);
    this.currentY = 0;
  }

  // --- COMPONENT: FEASTUDY SUMMARY PAGE ---
  private addFeasibilitySummary(site: Site, scenario: FeasibilityScenario, metrics: any) {
      this.addPageHeader("Development Summary", "Key Performance Indicators", false);

      const leftX = 20;
      const rightX = 110;
      let y = this.currentY;

      // Helper to draw dotted line row
      // "Label ..................... $Value"
      const drawDottedRow = (label: string, value: string, xPos: number, width: number, isBold = false) => {
          this.doc.setFont(FONTS.body, isBold ? "bold" : "normal");
          this.doc.setFontSize(10);
          this.doc.setTextColor(COLORS.text);
          
          this.doc.text(label, xPos, y);
          
          const labelWidth = this.doc.getTextWidth(label);
          const valueWidth = this.doc.getTextWidth(value);
          
          // Draw dots
          const dotStart = xPos + labelWidth + 2;
          const dotEnd = xPos + width - valueWidth - 2;
          
          if (dotEnd > dotStart) {
              this.doc.setDrawColor(200, 200, 200);
              this.doc.setLineWidth(0.3);
              this.doc.line(dotStart, y - 1, dotEnd, y - 1); // approximate baseline
              // Actually dotted line in jsPDF is trickier, let's just use a line or manual dots
              // this.doc.text(".".repeat(30), dotStart, y); // primitive
          }

          this.doc.text(value, xPos + width, y, { align: 'right' });
          y += 7;
      };

      // LEFT COLUMN: PROJECT RETURNS
      this.doc.setFont(FONTS.header, "bold");
      this.doc.setFontSize(12);
      this.doc.text("Project Returns", leftX, y);
      y += 8;

      drawDottedRow("Total Development Cost", formatCurrency(metrics.totalDevelopmentCost), leftX, 80);
      drawDottedRow("Gross Realisation", formatCurrency(metrics.grossRevenue), leftX, 80);
      drawDottedRow("Net Development Profit", formatCurrency(metrics.netProfit), leftX, 80, true);
      y += 4;
      drawDottedRow("Development Margin (MDC)", formatPct(metrics.devMarginPct), leftX, 80, true);
      drawDottedRow("Margin on Equity (MoE)", formatPct(metrics.marginOnEquity), leftX, 80, true);
      drawDottedRow("Internal Rate of Return", formatPct(metrics.equityIRR), leftX, 80, true);
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
      drawDottedRow("GST Collected", formatCurrency(metrics.gstCollected), rightX, 80);
      drawDottedRow("GST Input Credits", formatCurrency(metrics.gstInputCredits), rightX, 80);
      drawDottedRow("Net GST Payable", formatCurrency(metrics.netGstPayable), rightX, 80);

      this.currentY = y + 20;

      // Project Description Box
      this.doc.setFont(FONTS.header, "bold");
      this.doc.text("Project Context", leftX, this.currentY);
      this.currentY += 6;
      this.doc.setFont(FONTS.body, "normal");
      this.doc.setFontSize(10);
      
      const desc = scenario.settings.description || "No description provided.";
      const lines = this.doc.splitTextToSize(desc, 170);
      this.doc.text(lines, leftX, this.currentY);
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
                // Overlay Gradient (simulated with alpha rect)
                this.doc.setFillColor(0, 0, 0);
                // this.doc.rect(0, 0, pageWidth, 140, 'F'); // Too heavy without proper alpha support in standard jspdf, skipping for clean look
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
    this.doc.text(site.dna.address, 20, this.currentY);

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
    this.doc.text("Prepared by DevFeas Pro", 20, pageHeight - 25);
    this.doc.text("Commercial in Confidence", pageWidth - 20, pageHeight - 25, { align: 'right' });
  }

  // --- COMPONENT: ASSET DNA (Fact Sheet) ---
  private addAssetFactSheet(site: Site, scenario: FeasibilityScenario, stats: any) {
    // Kept as legacy support, but addFeasibilitySummary is now primary page 2.
    // We can merge this or keep it. Let's keep it but skip header if already rendered.
  }

  // --- COMPONENT: VALUER'S P&L ---
  private addValuersPnL(scenario: FeasibilityScenario, siteDNA: SiteDNA, metrics: any) {
    this.addPageHeader("Financial Analysis", "Profit & Loss Statement", false);

    const reportStats = FinanceEngine.calculateReportStats(scenario, siteDNA);
    const rows: any[] = [];

    // Helper to format rows for autoTable
    const addRow = (label: string, detail: string | null, subtotal: string | null, style: 'header'|'item'|'total'|'spacer' = 'item') => {
        rows.push({ label, detail, subtotal, style });
    };

    // 1. Revenue
    addRow("GROSS REALISATION", null, null, 'header');
    addRow("Gross Sales Revenue", formatCurrency(reportStats.totalRevenueGross), null);
    addRow("Less: GST Liability", formatCurrency(reportStats.gstCollected * -1), null);
    addRow("NET REALISATION", null, formatCurrency(reportStats.netRealisation), 'total');
    addRow("", null, null, 'spacer');

    // 2. Costs
    addRow("DEVELOPMENT COSTS", null, null, 'header');
    
    // Helper to process cost categories
    const addCategory = (name: string, catId: CostCategory) => {
        const items = scenario.costs.filter(c => c.category === catId);
        if (items.length === 0) return;
        
        addRow(name, null, null, 'header');
        
        // Sum construction for % calc context if needed
        const constructionSum = scenario.costs.filter(c => c.category === CostCategory.CONSTRUCTION).reduce((a,b)=>a+b.amount,0);
        const revenueSum = reportStats.totalRevenueGross;

        let catTotal = 0;
        items.forEach(item => {
            const val = FinanceEngine.calculateLineItemTotal(item, scenario.settings, siteDNA, constructionSum, revenueSum);
            catTotal += val;
            addRow(item.description, formatCurrency(val), null, 'item');
        });
        addRow(`Total ${name}`, null, formatCurrency(catTotal), 'total');
        addRow("", null, null, 'spacer');
    };

    addCategory("Acquisition Costs", CostCategory.LAND);
    addCategory("Construction Costs", CostCategory.CONSTRUCTION);
    addCategory("Professional Fees", CostCategory.CONSULTANTS);
    addCategory("Statutory & Authorities", CostCategory.STATUTORY);
    addCategory("Selling & Marketing", CostCategory.SELLING);
    addCategory("Finance Costs", CostCategory.FINANCE); // Items if any manually added

    // Calculated Finance (Interest)
    addRow("Finance Costs (Calculated)", null, null, 'header');
    addRow("Interest & Line Fees", null, formatCurrency(metrics.totalFinanceCost), 'total');
    addRow("", null, null, 'spacer');

    // Bottom Line
    // metrics.totalDevelopmentCost is Net. To match Valuer P&L usually we show Gross Costs? 
    // Standard practice is Net Costs + GST = Gross. Or Net Costs.
    // The previous logic used `stats.totalOut`.
    // Let's use the explicit calculated finance cost + other costs.
    addRow("TOTAL DEVELOPMENT COSTS", null, formatCurrency(metrics.totalDevelopmentCost + metrics.gstInputCredits), 'header'); // Gross for P&L
    addRow("", null, null, 'spacer');
    addRow("NET DEVELOPMENT PROFIT", null, formatCurrency(metrics.netProfit), 'header');
    addRow("DEVELOPMENT MARGIN", null, formatPct(metrics.devMarginPct), 'total');

    // Render Table
    autoTable(this.doc, {
        startY: this.currentY,
        head: [['Item', 'Amount', 'Subtotal']],
        body: rows.map(r => [r.label, r.detail, r.subtotal]),
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 1.5, font: FONTS.body },
        columnStyles: {
            0: { cellWidth: 110 },
            1: { cellWidth: 40, halign: 'right', font: FONTS.mono },
            2: { cellWidth: 40, halign: 'right', font: FONTS.mono, fontStyle: 'bold' }
        },
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
                    if (data.column.index === 0) data.cell.styles.cellPadding = { top: 1, bottom: 1, left: 8, right: 1 };
                } else if (rowInfo.style === 'total') {
                    if (data.column.index === 2) {
                        // Top Border for totals
                        data.cell.styles.lineWidth = { top: 0.1, bottom: 0, left: 0, right: 0 };
                    }
                }
            }
        }
    });
  }

  // --- COMPONENT: SENSITIVITY ANALYSIS ---
  private addSensitivityAnalysis(matrix: SensitivityCell[][], scenario: FeasibilityScenario) {
    this.addPageHeader("Risk Analysis", "Sensitivity Matrix (Cost vs Revenue)", false);

    // Get axis steps from service logic (Assuming -10% to +10% standard for this visual)
    // We recreate labels based on standard steps
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
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index > 0) {
                const val = parseFloat(data.cell.raw as string);
                data.cell.styles.fontStyle = 'bold';
                if (val < 0) {
                    data.cell.styles.fillColor = "#fecaca"; // Red 200
                    data.cell.styles.textColor = "#991b1b"; // Red 800
                } else if (val < 10) {
                    data.cell.styles.fillColor = "#fde68a"; // Amber 200
                    data.cell.styles.textColor = "#92400e"; // Amber 800
                } else if (val >= 20) {
                    data.cell.styles.fillColor = "#bbf7d0"; // Green 200
                    data.cell.styles.textColor = "#166534"; // Green 800
                }
            }
        }
    });
  }

  // --- COMPONENT: RISK REPORT (Detailed Vertical Sensitivity) ---
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
                // Format input value based on type? Assuming $ usually, but Time is Months, Rate is %
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
            didParseCell: (data) => {
                const rowData = data.row.raw as any; // Access raw data to check values
                
                // Highlight Base Case Row
                const rowIndex = data.row.index;
                const isBaseCase = data.table.body[rowIndex].raw[0] === 'Base Case';
                
                if (data.section === 'body') {
                    if (isBaseCase) {
                        data.cell.styles.fillColor = "#e0f2fe"; // Light Blue
                        data.cell.styles.fontStyle = 'bold';
                    }

                    // Conditional Formatting for Margin (Col 4) & IRR (Col 5)
                    // Note: Column index depends on visible columns. Here 4=Margin, 5=IRR.
                    if (data.column.index === 4) { // Margin
                        const val = parseFloat(data.cell.raw as string);
                        if (val < 15) data.cell.styles.textColor = "#dc2626"; // Red
                        if (val > 20) data.cell.styles.textColor = "#166534"; // Green
                    }
                    if (data.column.index === 5) { // IRR
                        const val = parseFloat(data.cell.raw as string);
                        if (val < 15) data.cell.styles.textColor = "#dc2626";
                        if (val > 20) data.cell.styles.textColor = "#166534";
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

        // Process Categories
        data.categories.forEach(cat => {
            // Skip empty categories to save space? Optional. 
            // We'll keep them for consistency with board packs.
            
            // Header Row
            tableBody.push({ 0: cat.name.toUpperCase(), type: 'header' });

            // Items
            cat.rows.forEach(row => {
                const slice = row.values.slice(startIdx, endIdx);
                const rowTotal = row.total; // Total for whole project, or page? Usually whole project in last col.
                // Let's show Page Total for now as it makes more sense in chunks, OR project total.
                // Standard practice: Project Total usually at very end.
                // Let's just sum the slice for "Period Total"
                const sliceSum = slice.reduce((a,b)=>a+b, 0);
                
                // Only add row if it has data in this period or generally
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
            styles: { fontSize: 7, cellPadding: 1.5, halign: 'right', font: FONTS.mono },
            columnStyles: { 0: { halign: 'left', cellWidth: 50, font: FONTS.body } },
            headStyles: { fillColor: COLORS.primary, textColor: 255, halign: 'center', fontStyle: 'bold' },
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
    this.doc.text("DevFeas Pro | Commercial in Confidence", 15, pageHeight - 10);
    this.doc.text(`Page ${pageNum}`, pageWidth - 15, pageHeight - 10, { align: "right" });
  }
}
