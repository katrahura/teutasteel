import { Product, ProductDimension, ProductTranslation } from './product.model';

describe('product models', () => {
  it('accepts a product shape without dimensions or translations', () => {
    const minimal: Product = {
      code: 'DS-001',
      cut_type: 1,
      is_active: true,
      new_product: false,
      dimensions: [],
      translations: [],
    };
    expect(minimal.code).toBe('DS-001');
  });

  it('accepts dimensions with an optional price timeline', () => {
    const dimension: ProductDimension = {
      height: 2000,
      width: 1000,
      price: 42.5,
      currency: 'EUR',
      price_history: [
        { price: 40, currency: 'EUR', start_date: '2025-01-01' },
      ],
    };
    expect(dimension.price_history?.[0].price).toBe(40);
  });

  it('accepts translations keyed by language', () => {
    const translation: ProductTranslation = {
      language: 'al',
      slug: 'flete-celiku',
      description: 'Përshkrim',
      content: 'Përmbajtje',
    };
    expect(translation.language).toBe('al');
  });
});
