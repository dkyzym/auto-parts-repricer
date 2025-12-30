/**
 * Класс для расчета цен.
 * Реализует специфическую логику округления по диапазонам.
 */
export class PriceCalculator {
  // Наценка по умолчанию 6%
  private static MARKUP_BASE = 1.06;

  static calculateSuggestions(currentPrice: number): number[] {
    const rawPrice = currentPrice * this.MARKUP_BASE;
    let options: number[] = [];

    // Диапазон 1: Цена < 50
    if (rawPrice < 50) {
      options = [
        Math.ceil(rawPrice), // A: Округлить до целого
        Math.ceil(rawPrice / 5) * 5, // B: Округлить до 5
        Math.ceil(rawPrice / 10) * 10, // C: Округлить до 10
      ];
    }
    // Диапазон 2: 50 - 200
    else if (rawPrice >= 50 && rawPrice < 200) {
      options = [
        Math.ceil(rawPrice / 5) * 5,
        Math.ceil(rawPrice / 10) * 10,
        Math.ceil(rawPrice / 50) * 50,
      ];
    }
    // Диапазон 3: 200 - 1000
    else if (rawPrice >= 200 && rawPrice < 1000) {
      const optA = Math.ceil(rawPrice / 10) * 10;
      const optB = Math.ceil(rawPrice / 50) * 50;
      let optC = Math.ceil(rawPrice / 100) * 100;

      // Спецправило: если кратно 500, вычитаем 10 (маркетинговый ход)
      if (optC % 500 === 0) optC -= 10;

      options = [optA, optB, optC];
    }
    // Диапазон 4: >= 1000
    else {
      const optA = Math.ceil(rawPrice / 50) * 50;

      // Вариант B: Заканчивается на 90.
      // Формула сдвигает число и ищет следующий ...90
      const optB = Math.ceil((rawPrice - 90) / 100) * 100 + 90;

      const optC = Math.ceil(rawPrice / 100) * 100;

      options = [optA, optB, optC];
    }

    // Удаляем дубликаты и сортируем по возрастанию
    return Array.from(new Set(options)).sort((a, b) => a - b);
  }
}
