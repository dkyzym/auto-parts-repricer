// --- Интерфейсы данных ---

export interface Product {
  sku: string;
  name: string;
  stock: number;
  costPrice: number;
  currentPrice: number;
  salesQty: number;
  abcMargin: 'A' | 'B' | 'C' | 'N';
  marginTotal: number;
  sourceStatus: string;
  new_price: number | null;
  status: 'pending' | 'approved' | 'deferred' | 'exported';
  manual_flag: boolean;
  daily_loss?: number;
  batch_id?: number;
}

export interface ApiResponse {
  data: Product[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

// --- Логика калькулятора цен ---

export class PriceCalculator {
  private static MARKUP_BASE = 1.06;

  static calculateSuggestions(currentPrice: number): number[] {
    const rawPrice = currentPrice * this.MARKUP_BASE;
    let options: number[] = [];

    if (rawPrice < 50) {
      options = [
        Math.ceil(rawPrice),
        Math.ceil(rawPrice / 5) * 5,
        Math.ceil(rawPrice / 10) * 10,
      ];
    } else if (rawPrice >= 50 && rawPrice < 200) {
      options = [
        Math.ceil(rawPrice / 5) * 5,
        Math.ceil(rawPrice / 10) * 10,
        Math.ceil(rawPrice / 50) * 50,
      ];
    } else if (rawPrice >= 200 && rawPrice < 1000) {
      const optA = Math.ceil(rawPrice / 10) * 10;
      const optB = Math.ceil(rawPrice / 50) * 50;
      let optC = Math.ceil(rawPrice / 100) * 100;
      if (optC % 500 === 0) optC -= 10;
      options = [optA, optB, optC];
    } else {
      const optA = Math.ceil(rawPrice / 50) * 50;
      const optB = Math.ceil((rawPrice - 90) / 100) * 100 + 90;
      const optC = Math.ceil(rawPrice / 100) * 100;
      options = [optA, optB, optC];
    }
    // Сортируем и убираем дубликаты
    return Array.from(new Set(options)).sort((a, b) => a - b);
  }
}
