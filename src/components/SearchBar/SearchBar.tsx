// src/components/SearchBar/SearchBar.tsx

import { useState } from 'react';
import './SearchBar.css';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onFilterChange?: (filter: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onFilterChange }) => {
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    onSearch(value);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <div className="search-bar-container">
      <h2 className="search-title">Incidentes en el mapa</h2>
      <div className="search-controls">
        <div className="search-input-group">
          <input
            type="text"
            className="search-input"
            placeholder="Buscar ubicación..."
            value={query}
            onChange={handleSearch}
          />
          {query && (
            <button className="search-clear" onClick={handleClear}>✕</button>
          )}
          <button className="search-btn">🔍</button>
        </div>
        <button className="filter-btn">
          ⚙️ Filtros
        </button>
      </div>
    </div>
  );
};