import React, { createContext, useContext, useState } from 'react';

const SalesTabsContext = createContext(null);

const createNewEmptyTab = (id, number = 1) => ({
  id,
  title: `Nouveau Document #${number}`,
  type_document: null,
  client: null,
  vendeur_nom: '',
  notes: '',
  remiseGlobale: '',        // % remise globale rapide (champ texte)
  remiseProportion: 0,      // valeur du slider de remise proportionnelle (0 à maxGlobal)
  lignes: [],
  montant_paye_initial: '0.000',
  isDirty: false
});

export const SalesTabsProvider = ({ children }) => {
  const [tabs, setTabs] = useState([createNewEmptyTab('tab_1', 1)]);
  const [activeTabId, setActiveTabId] = useState('tab_1');
  const [tabCounter, setTabCounter] = useState(1);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const addTab = (type = null) => {
    const nextCount = tabCounter + 1;
    const newId = `tab_${Date.now()}`;
    const newTab = {
      ...createNewEmptyTab(newId, nextCount),
      type_document: type
    };
    setTabCounter(nextCount);
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const closeTab = (tabId) => {
    if (tabs.length === 1) {
      // Re-initialize single remaining tab
      const resetTab = createNewEmptyTab('tab_1', 1);
      setTabs([resetTab]);
      setActiveTabId('tab_1');
      setTabCounter(1);
      return;
    }

    const targetTab = tabs.find((t) => t.id === tabId);
    if (targetTab && targetTab.isDirty) {
      if (!window.confirm(`Le document "${targetTab.title}" contient des modifications non enregistrées. Voulez-vous vraiment le fermer ?`)) {
        return;
      }
    }

    const filtered = tabs.filter((t) => t.id !== tabId);
    setTabs(filtered);
    if (activeTabId === tabId) {
      setActiveTabId(filtered[filtered.length - 1].id);
    }
  };

  const updateActiveTab = (updater) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === activeTabId) {
          const updated = typeof updater === 'function' ? updater(t) : { ...t, ...updater };
          return { ...updated, isDirty: true };
        }
        return t;
      })
    );
  };

  const resetActiveTab = () => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === activeTabId) {
          return createNewEmptyTab(t.id, tabCounter);
        }
        return t;
      })
    );
  };

  return (
    <SalesTabsContext.Provider
      value={{
        tabs,
        activeTabId,
        activeTab,
        setActiveTabId,
        addTab,
        closeTab,
        updateActiveTab,
        resetActiveTab
      }}
    >
      {children}
    </SalesTabsContext.Provider>
  );
};

export const useSalesTabs = () => {
  const context = useContext(SalesTabsContext);
  if (!context) {
    throw new Error('useSalesTabs must be used within a SalesTabsProvider');
  }
  return context;
};
