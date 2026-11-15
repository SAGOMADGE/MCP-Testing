type Props = {
  searchQuery: string;
  selectedCategory: string;
  maxPrice: string;
  categories: string[];
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
};

export default function CatalogFilters({
  searchQuery,
  selectedCategory,
  maxPrice,
  categories,
  onSearchChange,
  onCategoryChange,
  onMaxPriceChange,
}: Props) {
  return (
    <div className="shop-panel shop-filters">
      <label className="shop-field">
        Поиск товаров
        <input
          type="text"
          placeholder="Поиск товаров..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="shop-input"
        />
      </label>
      <label className="shop-field">
        Категория
        <select
          className="shop-input"
          value={selectedCategory}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          <option value="all">Все категории</option>

          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>
      <label className="shop-field">
        Цена до ($)
        <input
          type="number"
          min="0"
          placeholder="Цена до ($)"
          value={maxPrice}
          onChange={(event) => onMaxPriceChange(event.target.value)}
          className="shop-input"
        />
      </label>
    </div>
  );
}
