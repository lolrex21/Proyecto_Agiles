// src/components/Header/Header.tsx

import './Header.css';

interface HeaderProps {
  userName: string;
  userZone: string;
}

export const Header: React.FC<HeaderProps> = ({ userName, userZone }) => {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-left">
          <h1 className="header-logo">UTA CampusSeguro</h1>
          <div className="header-user-info">
            <span className="user-name">{userName}</span>
            <span className="user-zone">{userZone}</span>
          </div>
        </div>
        <div className="header-right">
          <button className="header-btn">Perfil</button>
          <button className="header-btn logout">Salir</button>
        </div>
      </div>
    </header>
  );
};