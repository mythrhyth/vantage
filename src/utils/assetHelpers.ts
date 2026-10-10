/**
 * Helper utilities for asset classification, currency formatting, and parameter bounds.
 */

export function isEquityAsset(assetType?: string | null): boolean {
  if (!assetType) return true; // Default holdings without explicit assetType are treated as equity
  const upper = String(assetType).toUpperCase();
  return upper === 'STOCK' || upper === 'EQUITY' || upper === 'EQUITIES' || upper === 'EQ';
}

export function formatCrores(amount?: number | null, decimals: number = 1): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0 Cr';
  }
  const absoluteVal = Math.abs(amount);
  const formatted = absoluteVal.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (amount < 0) {
    return `-₹${formatted} Cr`;
  }
  return `₹${formatted} Cr`;
}

export function formatPercentage(val?: number | null, decimals: number = 1): string {
  if (val === null || val === undefined || isNaN(val)) {
    return '0%';
  }
  return `${val.toFixed(decimals)}%`;
}
