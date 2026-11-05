import type { Product } from '../types';

export interface CataloguePreview {
  validProducts: Product[];
  duplicates: number;
  blankSkus: number;
  invalidRows: number;
  errors: string[];
}

const isText = (value: unknown): value is string => typeof value === 'string';

export function previewCatalogueImport(input: unknown, existingProducts: Product[]): CataloguePreview {
  const rows = Array.isArray(input) ? input : [input];
  const existingSkus = new Set(existingProducts.map(product => product.sku.trim().toUpperCase()));
  const preview: CataloguePreview = { validProducts: [], duplicates: 0, blankSkus: 0, invalidRows: 0, errors: [] };

  rows.forEach((row, index) => {
    const number = index + 1;
    if (!row || typeof row !== 'object') {
      preview.invalidRows++;
      preview.errors.push(`Row ${number}: expected a product object.`);
      return;
    }
    const item = row as Record<string, unknown>;
    if (!isText(item.sku) || !item.sku.trim()) {
      preview.blankSkus++;
      preview.errors.push(`Row ${number}: SKU is blank.`);
      return;
    }
    const sku = item.sku.trim();
    if (existingSkus.has(sku.toUpperCase())) {
      preview.duplicates++;
      preview.errors.push(`Row ${number}: SKU ${sku} is already present in this batch or catalogue.`);
      return;
    }
    const textFields = ['name', 'collection', 'category', 'description', 'dimensions', 'materials', 'imageUrl'];
    if (textFields.some(field => !isText(item[field])) || !isText(item.name) || !item.name.trim()
      || typeof item.referencePrice !== 'number' || !Number.isFinite(item.referencePrice) || item.referencePrice < 0
      || typeof item.isActive !== 'boolean') {
      preview.invalidRows++;
      preview.errors.push(`Row ${number}: required product details have invalid types or values.`);
      return;
    }
    existingSkus.add(sku.toUpperCase());
    preview.validProducts.push({
      id: `prod-${crypto.randomUUID()}`,
      sku,
      name: item.name.trim(),
      collection: item.collection as string,
      category: item.category as string,
      description: item.description as string,
      dimensions: item.dimensions as string,
      materials: item.materials as string,
      imageUrl: item.imageUrl as string,
      referencePrice: item.referencePrice,
      isActive: item.isActive,
    });
  });

  return preview;
}
