
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { FeasibilitySettings, LineItem, RevenueItem, CostCategory } from './types';
import { FinanceEngine } from './services/financeEngine';

// Define styles for the professional PDF report
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#334155',
  },
  header: {
    marginBottom: 20,
    borderBottom: 2,
    borderBottomColor: '#2563eb',
    paddingBottom: 10,
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  projectLocation: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  reportType: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2563eb',
    marginTop: 10,
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 15,
  },
  sectionHeader: {
    backgroundColor: '#f1f5f9',
    padding: 5,
    fontWeight: 'bold',
    fontSize: 10,
    textTransform: 'uppercase',
    color: '#1e293b',
    borderBottom: 1,
    borderBottomColor: '#cbd5e1',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  rowLabel: {
    flex: 3,
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 5,
    fontWeight: 'bold',
    borderTopWidth: 1,
    borderTopColor: '#94a3b8',
    marginTop: 2,
  },
  grandTotalRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 5,
    fontWeight: 'bold',
    backgroundColor: '#1e293b',
    color: '#ffffff',
    marginTop: 5,
  },
  marginGrid: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  marginItem: {
    width: '48%',
    padding: 10,
    border: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
  },
  marginLabel: {
    fontSize: 8,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  marginValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563eb',
  }
});

interface Props {
  settings: FeasibilitySettings;
  costs: LineItem[];
  revenues: RevenueItem[];
  stats: {
    profit: number;
    margin: number;
    irr: number;
    npv: number;
    totalOut: number;
    totalIn: number;
    constructionTotal: number;
    interestTotal: number;
  };
}

const formatCurrency = (val: number) => {
  const isNeg = val < 0;
  const absVal = Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return isNeg ? `(${absVal})` : `${absVal}`;
};

export const FeasibilityReportPDF: React.FC<Props> = ({ settings, costs, revenues, stats }) => {
  const equity = settings.equityContribution || (stats.totalOut * 0.25); // Default to 25% if not set
  const roe = (stats.profit / equity) * 100;

  // Group costs by category for the report
  const getCategoryTotal = (cat: CostCategory) => {
    return costs
      .filter(c => c.category === cat)
      .reduce((acc, curr) => acc + FinanceEngine.calculateLineItemTotal(curr, settings, stats.constructionTotal, stats.totalIn), 0);
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.projectTitle}>{settings.projectName}</Text>
          <Text style={styles.projectLocation}>{settings.location} | Baseline Scenario</Text>
          <Text style={styles.reportType}>Categorised Profit & Loss Summary</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Gross Realisation</Text>
          {revenues.map(rev => (
            <View key={rev.id} style={styles.row}>
              <Text style={styles.rowLabel}>{rev.description} ({rev.units} Units)</Text>
              <Text style={styles.rowValue}>{formatCurrency(rev.units * rev.pricePerUnit)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.rowLabel}>Total Gross Realisation</Text>
            <Text style={styles.rowValue}>{formatCurrency(stats.totalIn)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Development Costs</Text>
          
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Land Acquisition & Purchasing</Text>
            <Text style={styles.rowValue}>{formatCurrency(getCategoryTotal(CostCategory.LAND))}</Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Construction Costs</Text>
            <Text style={styles.rowValue}>{formatCurrency(getCategoryTotal(CostCategory.CONSTRUCTION))}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Professional Consultants' Fees</Text>
            <Text style={styles.rowValue}>{formatCurrency(getCategoryTotal(CostCategory.CONSULTANTS))}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Statutory & Planning Fees</Text>
            <Text style={styles.rowValue}>{formatCurrency(getCategoryTotal(CostCategory.STATUTORY))}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Marketing & Selling Costs</Text>
            <Text style={styles.rowValue}>{formatCurrency(getCategoryTotal(CostCategory.SELLING))}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Financing Costs (Inc. Interest)</Text>
            <Text style={styles.rowValue}>{formatCurrency(getCategoryTotal(CostCategory.FINANCE) + stats.interestTotal)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Miscellaneous & Contingency</Text>
            <Text style={styles.rowValue}>{formatCurrency(getCategoryTotal(CostCategory.MISCELLANEOUS))}</Text>
          </View>

          <View style={styles.grandTotalRow}>
            <Text style={styles.rowLabel}>Total Development Cost (TDC)</Text>
            <Text style={styles.rowValue}>{formatCurrency(stats.totalOut)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Project Performance Summary</Text>
          <View style={[styles.grandTotalRow, { backgroundColor: stats.profit >= 0 ? '#065f46' : '#991b1b' }]}>
            <Text style={styles.rowLabel}>Net Development Profit</Text>
            <Text style={styles.rowValue}>{formatCurrency(stats.profit)}</Text>
          </View>
        </View>

        <View style={styles.marginGrid}>
          <View style={styles.marginItem}>
            <Text style={styles.marginLabel}>Development Margin (Profit / TDC)</Text>
            <Text style={styles.marginValue}>{stats.margin.toFixed(2)}%</Text>
          </View>
          <View style={styles.marginItem}>
            <Text style={styles.marginLabel}>Return on Equity (ROE)</Text>
            <Text style={styles.marginValue}>{roe.toFixed(2)}%</Text>
          </View>
          <View style={styles.marginItem}>
            <Text style={styles.marginLabel}>Internal Rate of Return (IRR)</Text>
            <Text style={styles.marginValue}>{stats.irr.toFixed(2)}%</Text>
          </View>
          <View style={styles.marginItem}>
            <Text style={styles.marginLabel}>Net Present Value (NPV)</Text>
            <Text style={styles.marginValue}>{formatCurrency(stats.npv)}</Text>
          </View>
        </View>

        <View style={{ marginTop: 'auto', borderTop: 1, borderTopColor: '#e2e8f0', paddingTop: 10 }}>
          <Text style={{ fontSize: 7, color: '#94a3b8', textAlign: 'center' }}>
            Generated by DevFeas Pro - Confidential Property Feasibility Report | {new Date().toLocaleDateString()}
          </Text>
        </View>
      </Page>
    </Document>
  );
};
