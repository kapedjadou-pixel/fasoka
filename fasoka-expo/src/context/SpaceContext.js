import React, { createContext, useContext, useState } from 'react';

const SpaceContext = createContext(null);

export function SpaceProvider({ children }) {
  const [maBoutique, setMaBoutique] = useState(null); // null tant que l'utilisateur n'a pas créé de boutique

  return (
    <SpaceContext.Provider value={{ maBoutique, setMaBoutique, aUneBoutique: maBoutique !== null }}>
      {children}
    </SpaceContext.Provider>
  );
}

export function useSpace() {
  return useContext(SpaceContext);
}
