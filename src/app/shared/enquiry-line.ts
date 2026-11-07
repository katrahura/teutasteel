import { Product, ProductDimension } from '../models/product.model';
import { QuoteItem } from './quote-list.service';
import { environment } from '../../environments/environment';

export function reviewLine(item: QuoteItem, product: Product): QuoteItem {
  // A historical shared-price row did not identify which pattern the buyer wanted.
  if (item.code !== product.code && /^R\d+(?:-R\d+)+$/i.test(item.code)) return {...item, reviewStatus: 'unavailable'};
  const rows = product.dimensions || [];
  const id = item.dimensionId ?? (item.variantKey?.startsWith('id:') ? Number(item.variantKey.slice(3)) : null);
  const keys = ['height', 'width', 'length', 'thickness', 'weight'] as const;
  const matches = id != null ? rows.filter(d => d.id === id) : rows.filter(d => {
    if (!item.dimensions) return rows.length === 1;
    return keys.every(k => Number(d[k] || 0) === Number(item.dimensions?.[k] || 0));
  });
  if (matches.length !== 1) return {...item, reviewStatus: 'unavailable'};
  const d = matches[0];
  const price = Number(d.price);
  const dimensions = {height: d.height, width: d.width, length: d.length, thickness: d.thickness, weight: d.weight};
  const next: QuoteItem = {...item, code: product.code, dimensionId: d.id,
    variantKey: d.id != null ? `id:${d.id}` : item.variantKey,
    dimensions, measurementUnit: [111,113].includes(product.category_id || 0) ? 'mm' : item.measurementUnit || null, unitPrice: Number.isFinite(price) && price > 0 ? price : null,
    priceUnit: d.price_unit || null, currency: d.currency || '',
    productUrl: `${environment.siteUrl}/products?product=${product.id}`, reviewStatus: undefined};
  const changed = item.code !== next.code || item.unitPrice !== next.unitPrice ||
    item.priceUnit !== next.priceUnit || (item.currency || '').toUpperCase() !== (next.currency || '').toUpperCase() ||
    keys.some(k => Number(item.dimensions?.[k] || 0) !== Number(dimensions[k] || 0));
  return {...next, previousUnitPrice: changed ? item.unitPrice : item.previousUnitPrice, previousPriceUnit: changed ? item.priceUnit : item.previousPriceUnit, reviewStatus: changed ? 'changed' : undefined};
}

export function isFractionalUnit(unit?: string | null): boolean { return unit === 'metre' || unit === 'kilogram'; }
