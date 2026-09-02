import React, { useState, useEffect, useRef } from 'react';
import { toast } from '../contexts/ToastContext';
import { Plus, X, Search, UserPlus, PackagePlus, Printer, Save, CheckCircle2, AlertTriangle, CheckSquare, Square, DollarSign, Users } from 'lucide-react';
import { useSalesTabs } from '../context/SalesTabsContext';
import { api } from '../services/api';
import { QuickClientModal } from '../components/common/QuickClientModal';
import { QuickArticleModal } from '../components/common/QuickArticleModal';
import { PaymentModal } from '../components/common/PaymentModal';
import { TicketPrint } from '../components/print/TicketPrint';
import { Modal } from '../components/common/Modal';
import { SmartSearchBar } from '../components/common/SmartSearchBar';

const Kbd = ({ children }) => (
  <kbd style={{
    display: 'inline-block',
    padding: '1px 5px',
    margin: '0 1px',
    background: 'var(--bg-surface)',
    border: '1px solid #334155',
    borderBottom: '2px solid #334155',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '0.7rem',
    color: 'var(--text-muted)'
  }}>
    {children}
  </kbd>
);

export const SalesScreen = () => {
  const { tabs, activeTabId, activeTab, setActiveTabId, addTab, closeTab, updateActiveTab, resetActiveTab } = useSalesTabs();

  // Client Passage (réservé pour ventes sans client identifié)
  const [passageClient, setPassageClient] = useState(null);

  // Search states
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const [articleSearch, setArticleSearch] = useState('');
  const [articleResults, setArticleResults] = useState([]);
  const [showArticleDropdown, setShowArticleDropdown] = useState(false);

  const [usersList, setUsersList] = useState([]);
  const [clientFocusedIndex, setClientFocusedIndex] = useState(-1);
  const [articleFocusedIndex, setArticleFocusedIndex] = useState(-1);

  useEffect(() => {
    api.getUsers().then(setUsersList).catch(() => setUsersList([]));
  }, []);

  // Modals state
  const [showQuickClientModal, setShowQuickClientModal] = useState(false);
  const [showQuickArticleModal, setShowQuickArticleModal] = useState(false);
  const [savedDocForPayment, setSavedDocForPayment] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printedDoc, setPrintedDoc] = useState(null);

  // error/success replaced by toast notifications
  const [loading, setLoading] = useState(false);

  const articleInputRef = useRef(null);
  const containerRef = useRef(null);

  // Load client passage on mount — set as default for devis/facture_rapide
  useEffect(() => {
    api.getPassageClient().then((p) => {
      setPassageClient(p);
      // Auto-select passage for devis and facture_rapide if no client yet
      if (!activeTab.client && activeTab.type_document !== 'bon_livraison') {
        updateActiveTab({ client: p });
      }
    }).catch(() => {});
  }, []);

  // When switching doc type to devis or facture_rapide, auto-select passage if no named client
  useEffect(() => {
    if (!passageClient) return;
    const isAnonymousType = activeTab.type_document !== 'bon_livraison';
    const hasNoClient = !activeTab.client;
    if (isAnonymousType && hasNoClient) {
      updateActiveTab({ client: passageClient });
    }
  }, [activeTab.type_document, passageClient]);

  // Client search — multi-mots intelligents (ex: "ben ahmed" trouve "Ahmed Ben")
  useEffect(() => {
    setClientFocusedIndex(-1);
    const q = clientSearch.trim();
    if (q.length >= 1) {
      // Fetch a broad list then filter client-side for multi-word support
      const words = q.toLowerCase().split(/\s+/);
      api.getClients(words[0]).then((all) => {
        const filtered = all.filter((c) => {
          const hay = [c.nom || '', c.prenom || '', c.telephone || '', c.matricule_fiscal || ''].join(' ').toLowerCase();
          return words.every(w => hay.includes(w));
        });
        setClientResults(filtered);
      }).catch(() => setClientResults([]));
      setShowClientDropdown(true);
    } else {
      setClientResults([]);
      setShowClientDropdown(false);
    }
  }, [clientSearch]);

  // Article search — multi-mots intelligents
  useEffect(() => {
    setArticleFocusedIndex(-1);
    const q = articleSearch.trim();
    if (q.length >= 1) {
      const words = q.toLowerCase().split(/\s+/);
      api.getArticles(words[0]).then((all) => {
        const filtered = all.filter((a) => {
          const hay = [a.nom || '', a.reference || '', a.description || '', a.code_barres || ''].join(' ').toLowerCase();
          return words.every(w => hay.includes(w));
        });
        setArticleResults(filtered);
      }).catch(() => setArticleResults([]));
      setShowArticleDropdown(true);
    } else {
      setArticleResults([]);
      setShowArticleDropdown(false);
    }
  }, [articleSearch]);

  // Select client
  const handleSelectClient = (clientObj) => {
    updateActiveTab({ client: clientObj });
    setClientSearch(`${clientObj.nom} ${clientObj.prenom || ''}`.trim());
    setShowClientDropdown(false);
  };

  // Select client passage (anonymous)
  const handleSelectPassage = () => {
    if (passageClient) {
      updateActiveTab({ client: passageClient });
      setClientSearch('Client Passage');
    }
  };

  const isPassageClient = activeTab.client && passageClient && activeTab.client.id_client === passageClient.id_client;

  // Sync clientSearch text with selected client
  useEffect(() => {
    if (isPassageClient) {
      setClientSearch('Client Passage');
    }
  }, [isPassageClient]);

  // Add article line to current tab
  const handleAddArticle = (art) => {
    const defaultQty = 1;
    const pu = parseFloat(art.prix_vente_ttc);
    // Pour devis: 0 livré. Pour BL/Facture: tout livré par défaut
    const defaultQtyLivree = activeTab.type_document !== 'devis' ? defaultQty : 0;

    const newLine = {
      id_article: art.id_article,
      article: art,
      quantite: defaultQty,
      quantite_livree: defaultQtyLivree,
      prix_unitaire_ttc: pu,
      remise_pourcentage: 0,
    };

    updateActiveTab((prev) => ({
      ...prev,
      lignes: [...prev.lignes, newLine]
    }));

    setArticleSearch('');
    setShowArticleDropdown(false);
    
    // Auto focus the quantity input of the last added item
    setTimeout(() => {
       const inputs = document.querySelectorAll('.qty-input');
       if (inputs.length > 0) {
         inputs[inputs.length - 1].select();
       }
    }, 50);
  };

  // Line changes
  const handleLineChange = (index, field, value) => {
    updateActiveTab((prev) => {
      const newLignes = [...prev.lignes];
      newLignes[index] = { ...newLignes[index], [field]: value };
      return { ...prev, lignes: newLignes };
    });
  };

  const handleRemoveLine = (index) => {
    updateActiveTab((prev) => ({
      ...prev,
      lignes: prev.lignes.filter((_, i) => i !== index)
    }));
  };

  // Toggle all items delivered / undelivered
  const handleToggleAllDelivered = (deliveredState) => {
    updateActiveTab((prev) => ({
      ...prev,
      lignes: prev.lignes.map((l) => ({
        ...l,
        quantite_livree: deliveredState ? (parseFloat(l.quantite) || 0) : 0
      }))
    }));
  };

  // Calculations
  const calculateTotals = () => {
    let ttcSansRemise = 0;
    let ttcFinal = 0;
    let weightedMaxRemiseSum = 0;

    (activeTab.lignes || []).forEach((l) => {
      const qty = parseFloat(l.quantite) || 0;
      const pu = parseFloat(l.prix_unitaire_ttc) || 0;
      const remisePct = parseFloat(l.remise_pourcentage) || 0;
      const maxRemiseArt = parseFloat(l.article?.remise_max_pourcentage) || 0;

      const lineSansRemise = qty * pu;
      const puApresRemise = pu * (1 - remisePct / 100);
      const lineFinal = qty * puApresRemise;

      ttcSansRemise += lineSansRemise;
      ttcFinal += lineFinal;
      weightedMaxRemiseSum += lineFinal * (maxRemiseArt / 100);
    });

    const totalRemiseVal = ttcSansRemise - ttcFinal;
    const globalRemisePct = ttcSansRemise > 0 ? (totalRemiseVal / ttcSansRemise) * 100 : 0;
    const maxTheoreticalPct = ttcFinal > 0 ? (weightedMaxRemiseSum / ttcFinal) * 100 : 0;

    const montantPaye = parseFloat(activeTab.montant_paye_initial) || 0;
    const montantRestant = Math.max(0, ttcFinal - montantPaye);

    return {
      ttcSansRemise,
      totalRemiseVal,
      ttcFinal,
      globalRemisePct,
      maxTheoreticalPct,
      montantPaye,
      montantRestant
    };
  };

  const totals = calculateTotals();

  // Save / Validate document
  const handleSaveDocument = async (statutAction = 'valide') => {


    if (!activeTab.type_document) {
      toast.error('⚠️ Veuillez sélectionner un type de document (Devis / BL / Ticket de Caisse).');
      return;
    }

    if (!activeTab.lignes || activeTab.lignes.length === 0) {
      toast.error('Veuillez ajouter au moins un article.');
      return;
    }

    // BL et Facture Rapide : le Client Passage est interdit
    if (activeTab.type_document === 'bon_livraison' && (isPassageClient || !activeTab.client)) {
      toast.error('⚠️ Un Bon de Livraison doit être associé à un client identifié. Veuillez sélectionner un client.');
      return;
    }

    if (!activeTab.vendeur_nom) {
      toast.error('⚠️ Veuillez sélectionner un vendeur.');
      return;
    }

    try {
      setLoading(true);

      // Use null for client passage so backend auto-resolves it
      const clientId = (isPassageClient || !activeTab.client) ? null : activeTab.client.id_client;

      const wantsWhatsapp = activeTab.send_whatsapp !== false && !!clientId;

      const payload = {
        type_document: activeTab.type_document,
        id_client: clientId,
        notes: activeTab.vendeur_nom ? `Vendeur: ${activeTab.vendeur_nom}. ${activeTab.notes || ''}` : activeTab.notes,
        lignes: activeTab.lignes.map((l) => ({
          id_article: l.id_article,
          quantite: parseFloat(l.quantite),
          quantite_livree: Math.min(parseFloat(l.quantite_livree) || 0, parseFloat(l.quantite) || 0),
          prix_unitaire_ttc: parseFloat(l.prix_unitaire_ttc),
          remise_pourcentage: parseFloat(l.remise_pourcentage) || 0
        })),
        send_whatsapp: false
      };

      const docCreated = await api.createDocument(payload);
      toast.success(`Document N° ${docCreated.numero} créé avec succès !`);

      // Store created document for immediate payment or print
      setPrintedDoc({ ...docCreated, vendeur_nom: activeTab.vendeur_nom });

      if (activeTab.type_document in { bon_livraison: 1, facture_rapide: 1 }) {
        // pending_whatsapp = true => PaymentModal will send combined doc+payment message
        setSavedDocForPayment({ ...docCreated, pending_whatsapp: wantsWhatsapp });
      }

      // Reset or prompt
      resetActiveTab();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (printedDoc) {
      setShowPrintModal(true);
    } else {
      toast.error("Veuillez d'abord valider ou enregistrer le document.");
    }
  };

  // Focus articles search after a return-to-search action (add article, Entrée en fin de ligne, changement d'onglet)
  const focusArticleSearch = () => {
    articleInputRef.current?.focus();
    articleInputRef.current?.select?.();
  };

  // Ré-focus automatique sur la recherche article à chaque changement d'onglet, pour enchaîner sans souris
  useEffect(() => {
    const t = setTimeout(() => articleInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [activeTabId]);

  // ── Navigation clavier à deux modes (façon tableur) ──────────────────────────
  // Mode "déplacement" (rien n'est réellement focus) : les flèches font glisser une
  // sélection en surbrillance (.roam-highlight) d'un champ/bouton au suivant.
  // Entrée sur le champ sélectionné : lui donne le vrai focus ("mode édition") — les
  // flèches redeviennent alors natives (texte, incrément de nombre, liste déroulante...).
  // Échap : quitte le champ (blur) et revient au mode déplacement, à la même position.
  const roamIndexRef = useRef(-1);
  const highlightedElRef = useRef(null);

  const getFocusableElements = () => {
    if (!containerRef.current) return [];
    const nodes = containerRef.current.querySelectorAll(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    return Array.from(nodes).filter((el) => el.offsetParent !== null);
  };

  const setRoamHighlight = (el) => {
    if (highlightedElRef.current && highlightedElRef.current !== el) {
      highlightedElRef.current.classList.remove('roam-highlight');
    }
    el?.classList.add('roam-highlight');
    highlightedElRef.current = el || null;
  };

  const clearRoamHighlight = () => {
    highlightedElRef.current?.classList.remove('roam-highlight');
    highlightedElRef.current = null;
  };

  // Garde roamIndexRef synchronisé avec tout focus réel (clic souris, Tab, F2, focus programmatique)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleFocusIn = (e) => {
      const focusables = getFocusableElements();
      const idx = focusables.indexOf(e.target);
      if (idx !== -1) {
        roamIndexRef.current = idx;
        clearRoamHighlight();
      }
    };
    container.addEventListener('focusin', handleFocusIn);
    return () => container.removeEventListener('focusin', handleFocusIn);
  }, []);

  // Raccourcis clavier globaux : F2, Ctrl+Entrée, flèches/Entrée/Échap
  useEffect(() => {
    const anyModalOpen = showQuickClientModal || showQuickArticleModal || !!savedDocForPayment || showPrintModal;

    const handleGlobalKeyDown = (e) => {
      if (anyModalOpen) return;

      if (e.key === 'F2') {
        e.preventDefault();
        focusArticleSearch();
        return;
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!loading) handleSaveDocument('valide');
        return;
      }

      const focusables = getFocusableElements();
      const active = document.activeElement;
      const isEditing = containerRef.current?.contains(active) && focusables.includes(active);

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (isEditing) return; // mode édition : laisser le champ gérer nativement ses flèches
        if (focusables.length === 0) return;

        e.preventDefault();
        const forward = e.key === 'ArrowDown' || e.key === 'ArrowRight';
        let idx = roamIndexRef.current;
        idx = idx === -1 ? 0 : Math.max(0, Math.min(focusables.length - 1, idx + (forward ? 1 : -1)));
        roamIndexRef.current = idx;
        const el = focusables[idx];
        setRoamHighlight(el);
        el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      } else if (e.key === 'Enter') {
        if (isEditing) return; // déjà en édition : laisser le champ gérer son propre Entrée
        const el = focusables[roamIndexRef.current];
        if (el) {
          e.preventDefault();
          el.focus();
          if ((el.tagName === 'INPUT') && (el.type === 'text' || el.type === 'number')) {
            el.select?.();
          }
        }
      } else if (e.key === 'Escape') {
        if (isEditing) {
          e.preventDefault();
          active.blur();
          setRoamHighlight(focusables[roamIndexRef.current]);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [loading, activeTab, showQuickClientModal, showQuickArticleModal, savedDocForPayment, showPrintModal]);

  // Entrée dans n'importe quel champ de ligne ramène le focus vers la recherche article
  const handleLineFieldEnter = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      focusArticleSearch();
    }
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* 1. Multi-Tab Bar (Browser-like tabs) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-primary)', padding: '0.5rem', borderRadius: '10px', overflowX: 'auto' }}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              role="button"
              tabIndex={0}
              aria-current={isActive ? 'true' : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveTabId(tab.id);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                background: isActive ? 'var(--bg-surface)' : 'transparent',
                border: isActive ? '1px solid var(--accent-primary)' : '1px solid transparent',
                color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: isActive ? '600' : '400',
                whiteSpace: 'nowrap'
              }}
            >
              <span>{tab.title}</span>
              {tab.isDirty && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fbbf24' }} />}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                onKeyDown={(e) => e.stopPropagation()}
                aria-label={`Fermer l'onglet ${tab.title}`}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}

        <button className="btn btn-outline btn-sm" onClick={() => addTab()} title="Nouvel Onglet Document">
          <Plus size={16} />
        </button>
      </div>

      {/* Barre d'aide raccourcis clavier — pour travailler sans souris */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1.2rem', padding: '0.3rem 0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        <span><Kbd>↑</Kbd><Kbd>↓</Kbd><Kbd>←</Kbd><Kbd>→</Kbd> Se déplacer (surbrillance)</span>
        <span><Kbd>Entrée</Kbd> Activer le champ sélectionné</span>
        <span><Kbd>Échap</Kbd> Quitter le champ, revenir au déplacement</span>
        <span><Kbd>F2</Kbd> Aller à la recherche article</span>
        <span><Kbd>Ctrl</Kbd>+<Kbd>Entrée</Kbd> Valider &amp; Enregistrer</span>
      </div>

      {/* 2. Top Header Form for Active Tab */}
      <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: '1rem', alignItems: 'end', position: 'relative', zIndex: 10 }}>
        {/* Document Type Buttons */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Type de Document</label>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              type="button"
              className={`btn btn-sm ${activeTab.type_document === 'devis' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => updateActiveTab({ type_document: 'devis' })}
            >
              Devis
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab.type_document === 'bon_livraison' ? 'btn-success' : 'btn-outline'}`}
              onClick={() => updateActiveTab({ type_document: 'bon_livraison' })}
            >
              BL
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab.type_document === 'facture_rapide' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => updateActiveTab({ type_document: 'facture_rapide' })}
            >
              Ticket de Caisse
            </button>
          </div>
        </div>

        {/* Client Search + Quick Add */}
        <div className="form-group" style={{ margin: 0, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label">
              Client
              {isPassageClient && (
                <span style={{ marginLeft: '0.5rem', background: 'rgba(251,191,36,0.2)', color: '#fbbf24', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #fbbf24' }}>
                  👤 Passage
                </span>
              )}
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleSelectPassage}
                title="Vente sans client identifié"
                style={{
                  background: isPassageClient ? 'rgba(251,191,36,0.2)' : 'none',
                  border: isPassageClient ? '1px solid #fbbf24' : 'none',
                  color: '#fbbf24',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  borderRadius: '4px',
                  padding: '0.1rem 0.4rem'
                }}
              >
                <Users size={12} /> Passage
              </button>
              <button
                type="button"
                onClick={() => setShowQuickClientModal(true)}
                style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <UserPlus size={12} /> + Nouveau Client
              </button>
            </div>
          </div>
          <input
            className="form-input"
            value={isPassageClient ? 'Client Passage' : (clientSearch || (activeTab.client ? `${activeTab.client.nom} ${activeTab.client.prenom || ''}`.trim() : ''))}
            onChange={(e) => {
              if (activeTab.client) {
                updateActiveTab({ client: null });
              }
              setClientSearch(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setClientFocusedIndex((prev) => Math.min(prev + 1, clientResults.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setClientFocusedIndex((prev) => Math.max(prev - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (clientFocusedIndex >= 0 && clientFocusedIndex < clientResults.length) {
                  handleSelectClient(clientResults[clientFocusedIndex]);
                } else if (clientResults.length > 0) {
                  handleSelectClient(clientResults[0]);
                }
              }
            }}
            placeholder="Rechercher client (nom, tél, MF)..."
            style={{
              fontStyle: 'normal',
              color: isPassageClient ? '#fbbf24' : (activeTab.client ? '#10b981' : 'inherit'),
              background: isPassageClient ? 'rgba(251,191,36,0.05)' : (activeTab.client ? 'rgba(16,185,129,0.05)' : undefined),
              border: isPassageClient ? '1px solid rgba(251,191,36,0.4)' : (activeTab.client ? '1px solid rgba(16,185,129,0.4)' : undefined),
            }}
          />

          {showClientDropdown && clientResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 100, maxHeight: '200px', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
              {clientResults.map((c, idx) => (
                <div
                  key={c.id_client}
                  onClick={() => handleSelectClient(c)}
                  style={{ 
                    padding: '0.5rem 0.75rem', 
                    cursor: 'pointer', 
                    borderBottom: '1px solid rgba(255,255,255,0.05)', 
                    fontSize: '0.85rem',
                    background: clientFocusedIndex === idx ? 'rgba(56, 189, 248, 0.1)' : 'transparent'
                  }}
                >
                  <strong style={{ color: 'var(--text-main)' }}>{c.nom} {c.prenom || ''}</strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>Tél: {c.telephone || 'N/A'} | Solde: {parseFloat(c.solde_compte).toFixed(3)} TND</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vendeur Name (Dropdown) */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Nom Vendeur <span style={{ color: '#ef4444' }}>*</span></label>
          <select
            className="form-input"
            value={activeTab.vendeur_nom || ''}
            onChange={(e) => updateActiveTab({ vendeur_nom: e.target.value })}
          >
            <option value="">Sélectionner un vendeur...</option>
            {usersList.map(u => (
              <option key={u.id_utilisateur} value={u.nom}>
                {u.nom} {u.prenom || ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Article Lookup & Table */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ position: 'relative', width: '60%' }}>
            <SmartSearchBar
              ref={articleInputRef}
              value={articleSearch}
              onChange={(v) => setArticleSearch(v)}
              onClear={() => { setArticleSearch(''); setShowArticleDropdown(false); }}
              placeholder="Ajouter un article (nom, réf ou description)... [Entrée]"
              results={articleResults.length > 0 ? [{
                category: 'Articles',
                items: articleResults.map((art, idx) => ({
                  key: art.id_article,
                  icon: '📦',
                  title: art.nom,
                  sub1: art.description
                    ? art.description.substring(0, 60) + (art.description.length > 60 ? '…' : '')
                    : (art.reference ? `Réf: ${art.reference}` : (art.code_barres ? `CB: ${art.code_barres}` : '')),
                  sub2: art.reference ? `Réf: ${art.reference} | Stock: ${parseFloat(art.stock_actuel)}` : `Stock: ${parseFloat(art.stock_actuel)}`,
                  badge: `${parseFloat(art.prix_vente_ttc).toFixed(3)} TND`,
                  badgeColor: parseFloat(art.stock_actuel) > 0 ? '#10b981' : '#ef4444',
                  onSelect: () => handleAddArticle(art)
                }))
              }] : (articleSearch.length > 0 ? [] : [])}
              loading={false}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-outline btn-sm" onClick={() => setShowQuickArticleModal(true)}>
              <PackagePlus size={14} /> + Créer Rapide
            </button>

            {/* Remise Globale */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '6px', padding: '0.2rem 0.6rem' }}>
              <label style={{ fontSize: '0.8rem', color: '#fbbf24', whiteSpace: 'nowrap' }}>Remise globale :</label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                className="form-input"
                style={{ width: '60px', padding: '0.2rem 0.35rem', textAlign: 'center', fontSize: '0.85rem' }}
                placeholder="0"
                value={activeTab.remiseGlobale || ''}
                onChange={(e) => updateActiveTab({ remiseGlobale: e.target.value })}
              />
              <span style={{ fontSize: '0.8rem', color: '#fbbf24' }}>%</span>
              <button
                className="btn btn-sm"
                style={{ padding: '0.2rem 0.5rem', background: '#fbbf24', color: '#0f172a', fontSize: '0.75rem', fontWeight: '700', borderRadius: '4px' }}
                onClick={() => {
                  const pct = parseFloat(activeTab.remiseGlobale) || 0;
                  if (pct < 0 || pct > 100) return;
                  updateActiveTab((prev) => ({
                    ...prev,
                    lignes: prev.lignes.map((l) => ({ ...l, remise_pourcentage: pct }))
                  }));
                }}
                title="Appliquer cette remise à toutes les lignes"
              >
                Appliquer
              </button>
            </div>

            <button className="btn btn-secondary btn-sm" onClick={() => handleToggleAllDelivered(false)}>
              <Square size={14} /> Tout marquer non livré
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleToggleAllDelivered(true)}>
              <CheckSquare size={14} /> Tout marquer livré
            </button>
          </div>
        </div>

        {/* Lines Table */}
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Article</th>
                <th style={{ width: '90px' }}>Quantité</th>
                <th style={{ width: '130px' }}>Qté Livrée</th>
                <th style={{ width: '120px' }}>P.U TTC (TND)</th>
                <th style={{ width: '100px' }}>Remise %</th>
                <th style={{ width: '120px' }}>P.U Après Remise</th>
                <th style={{ width: '120px' }}>Total Ligne TTC</th>
                <th style={{ width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {(!activeTab.lignes || activeTab.lignes.length === 0) ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Aucun article dans ce document. Utilisez le champ ci-dessus pour ajouter des articles.
                  </td>
                </tr>
              ) : (
                activeTab.lignes.map((l, index) => {
                  const qty = parseFloat(l.quantite) || 0;
                  const pu = parseFloat(l.prix_unitaire_ttc) || 0;
                  const remisePct = parseFloat(l.remise_pourcentage) || 0;
                  const maxRemiseArt = parseFloat(l.article?.remise_max_pourcentage) || 0;
                  const qtyLivree = parseFloat(l.quantite_livree) || 0;

                  const puApresRemise = pu * (1 - remisePct / 100);
                  const totalLine = qty * puApresRemise;
                  const exceedsMaxDiscount = remisePct > maxRemiseArt;
                  const isPartial = qtyLivree > 0 && qtyLivree < qty;
                  const isFullyDelivered = qtyLivree >= qty;

                  return (
                    <tr key={index}>
                      <td>
                        <strong style={{ color: 'var(--text-main)' }}>{l.article?.nom || `Art #${l.id_article}`}</strong>
                        {l.article?.reference && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Réf: {l.article.reference}</div>
                        )}
                      </td>

                      <td>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          className="form-input qty-input"
                          style={{ padding: '0.25rem 0.4rem', textAlign: 'center' }}
                          value={l.quantite}
                          onChange={(e) => {
                            const raw = e.target.value;
                            handleLineChange(index, 'quantite', raw);
                            const parsed = parseFloat(raw);
                            if (!isNaN(parsed)) {
                              handleLineChange(index, 'quantite_livree', parsed);
                            }
                          }}
                          onBlur={(e) => {
                            const parsed = parseFloat(e.target.value);
                            if (isNaN(parsed) || parsed < 1) {
                              handleLineChange(index, 'quantite', 1);
                              handleLineChange(index, 'quantite_livree', 1);
                            }
                          }}
                          onKeyDown={handleLineFieldEnter}
                        />
                      </td>

                      {/* Qté livrée avec indicateur visuel */}
                      <td>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max={qty}
                          className="form-input"
                          style={{
                            padding: '0.25rem 0.4rem',
                            textAlign: 'center',
                            width: '100%',
                            borderColor: isFullyDelivered ? '#10b981' : isPartial ? '#f59e0b' : undefined,
                          }}
                          value={l.quantite_livree}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const parsed = parseFloat(raw);
                            if (raw === '') {
                              handleLineChange(index, 'quantite_livree', raw);
                            } else {
                              handleLineChange(index, 'quantite_livree', Math.min(parsed, qty));
                            }
                          }}
                          onBlur={(e) => {
                            const parsed = parseFloat(e.target.value);
                            handleLineChange(index, 'quantite_livree', isNaN(parsed) ? 0 : Math.min(parsed, qty));
                          }}
                          onKeyDown={handleLineFieldEnter}
                        />
                        <div style={{ fontSize: '0.7rem', textAlign: 'center', marginTop: '0.2rem', color: isFullyDelivered ? '#34d399' : isPartial ? '#fbbf24' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {isFullyDelivered ? '✓ Livré' : isPartial ? `◑ ${qtyLivree}/${qty}` : '✗ Non livré'}
                        </div>
                      </td>

                      <td>
                        <input
                          type="number"
                          step="0.001"
                          className="form-input"
                          style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}
                          value={l.prix_unitaire_ttc}
                          onChange={(e) => handleLineChange(index, 'prix_unitaire_ttc', e.target.value)}
                          onKeyDown={handleLineFieldEnter}
                        />
                      </td>

                      <td>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="number"
                            step="1"
                            max="100"
                            className="form-input"
                            style={{
                              padding: '0.25rem 0.4rem',
                              textAlign: 'center',
                              borderColor: exceedsMaxDiscount ? '#f59e0b' : undefined
                            }}
                            value={l.remise_pourcentage}
                            onChange={(e) => handleLineChange(index, 'remise_pourcentage', e.target.value)}
                            onKeyDown={handleLineFieldEnter}
                          />
                          {exceedsMaxDiscount && (
                            <span
                              title={`⚠️ ${l.article?.nom || 'Cet article'} : remise appliquée ${remisePct}% > max autorisé ${maxRemiseArt}%`}
                              style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', color: '#f59e0b', fontSize: '0.75rem', cursor: 'help' }}
                            >
                              ⚠️
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: '500' }}>
                        {puApresRemise.toFixed(3)}
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#34d399' }}>
                        {totalLine.toFixed(3)}
                      </td>

                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => handleRemoveLine(index)} style={{ padding: '0.2rem' }}>
                          <X size={14} color="#f87171" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Bottom Summary & Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
        {/* Discount Indicator & Notes */}
        <div className="glass-card">
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Notes / Remarques Document</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={activeTab.notes || ''}
              onChange={(e) => updateActiveTab({ notes: e.target.value })}
              placeholder="Consignes particulières, mode de livraison..."
            />
          </div>

          {/* Avertissements détaillés par ligne dépassant le remise max */}
          {(() => {
            const lignesEnDepassement = (activeTab.lignes || []).filter((l) => {
              const remisePct = parseFloat(l.remise_pourcentage) || 0;
              const maxRemise = parseFloat(l.article?.remise_max_pourcentage) || 0;
              return remisePct > maxRemise && maxRemise > 0;
            });
            if (lignesEnDepassement.length === 0) return null;
            return (
              <div style={{ padding: '0.6rem 0.8rem', background: 'rgba(245,158,11,0.12)', border: '1px solid #f59e0b', borderRadius: '8px', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '700', color: '#fbbf24', marginBottom: '0.4rem' }}>
                  <AlertTriangle size={14} color="#f59e0b" />
                  <span>Dépassement de remise max sur {lignesEnDepassement.length} article{lignesEnDepassement.length > 1 ? 's' : ''} :</span>
                </div>
                {lignesEnDepassement.map((l, idx) => {
                  const artName = l.article?.nom || `Art #${l.id_article}`;
                  const artRef = l.article?.reference;
                  const remisePct = parseFloat(l.remise_pourcentage);
                  const maxRemise = parseFloat(l.article?.remise_max_pourcentage);
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', color: '#fbbf24' }}>
                      <span style={{ color: '#f59e0b' }}>▸</span>
                      <strong style={{ color: 'var(--text-main)' }}>{artName}</strong>
                      {artRef && <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>({artRef})</span>}
                      <span>: remise appliquée <strong style={{ color: '#f87171' }}>{remisePct}%</strong></span>
                      <span style={{ color: 'var(--text-muted)' }}>| max autorisé :</span>
                      <strong style={{ color: '#34d399' }}>{maxRemise}%</strong>
                    </div>
                  );
                })}
                {totals.globalRemisePct > 0 && (
                  <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(245,158,11,0.3)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    Remise globale appliquée : <strong style={{ color: '#fbbf24' }}>{totals.globalRemisePct.toFixed(1)}%</strong>
                    &nbsp;&mdash;&nbsp;Max théorique : <strong style={{ color: '#34d399' }}>{totals.maxTheoreticalPct.toFixed(1)}%</strong>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Summary Card & Save Actions */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>Total Brut TTC:</span>
              <span>{totals.ttcSansRemise.toFixed(3)} TND</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fbbf24' }}>
              <span>Remise Totale:</span>
              <span>-{totals.totalRemiseVal.toFixed(3)} TND</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', color: '#34d399' }}>
              <span>TOTAL FINAL TTC:</span>
              <span>{totals.ttcFinal.toFixed(3)} TND</span>
            </div>
          </div>

          {/* ── Slider Remise Proportionnelle ── */}
          {(() => {
            const lignes = activeTab.lignes || [];
            // Max global = le plus haut remise_max parmi tous les articles
            const maxGlobal = Math.max(
              ...lignes.map((l) => parseFloat(l.article?.remise_max_pourcentage) || 0),
              0
            );
            if (maxGlobal <= 0 || lignes.length === 0) return null;

            // Valeur actuelle du slider : remise effective pondérée
            const currentSliderVal = parseFloat(activeTab.remiseProportion ?? 0);

            const applyProportion = (val) => {
              const v = Math.min(Math.max(parseFloat(val) || 0, 0), maxGlobal);
              updateActiveTab((prev) => ({
                ...prev,
                remiseProportion: v,
                lignes: prev.lignes.map((l) => {
                  const max = parseFloat(l.article?.remise_max_pourcentage) || 0;
                  const pct = max > 0 ? Math.round((v * max) / maxGlobal) : 0;
                  return { ...l, remise_pourcentage: pct };
                }),
              }));
            };

            // Couleur selon niveau
            const ratio = maxGlobal > 0 ? currentSliderVal / maxGlobal : 0;
            const trackColor = ratio >= 1 ? '#34d399' : ratio >= 0.5 ? '#fbbf24' : '#60a5fa';

            return (
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                    Remise proportionnelle
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <input
                      type="number"
                      min="0"
                      max={maxGlobal}
                      step="0.5"
                      value={currentSliderVal}
                      onChange={(e) => applyProportion(e.target.value)}
                      style={{
                        width: '55px',
                        padding: '0.15rem 0.3rem',
                        textAlign: 'center',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: trackColor,
                        fontWeight: '700',
                        fontSize: '0.85rem',
                      }}
                    />
                    <span style={{ fontSize: '0.8rem', color: trackColor, fontWeight: '700' }}>
                      % / {maxGlobal}%
                    </span>
                  </div>
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min="0"
                  max={maxGlobal}
                  step="0.5"
                  value={currentSliderVal}
                  onChange={(e) => applyProportion(e.target.value)}
                  style={{ width: '100%', accentColor: trackColor, cursor: 'pointer' }}
                />

                {/* Légende proportions par article */}
                <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  {lignes.map((l, i) => {
                    const maxArt = parseFloat(l.article?.remise_max_pourcentage) || 0;
                    if (maxArt <= 0) return null;
                    const effectivePct = maxGlobal > 0 ? Math.round((currentSliderVal * maxArt) / maxGlobal) : 0;
                    const artName = l.article?.nom || `Art #${l.id_article}`;
                    const barWidth = maxArt > 0 ? `${(effectivePct / maxArt) * 100}%` : '0%';
                    return (
                      <div key={i} style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px' }}>
                          <span style={{ color: 'var(--text-main)', maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artName}</span>
                          <span style={{ color: effectivePct >= maxArt ? '#34d399' : trackColor }}>
                            {effectivePct}% / max {maxArt}%
                          </span>
                        </div>
                        <div style={{ height: '3px', background: 'var(--bg-surface)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: barWidth, background: effectivePct >= maxArt ? '#34d399' : trackColor, borderRadius: '2px', transition: 'width 0.15s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* WhatsApp Notification Checkbox */}
          {activeTab.type_document !== 'devis' && (
            <div style={{ marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input 
                  type="checkbox" 
                  checked={activeTab.send_whatsapp !== false} 
                  onChange={(e) => updateActiveTab({ send_whatsapp: e.target.checked })} 
                />
                Envoyer une notification WhatsApp au client
              </label>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => handleSaveDocument('brouillon')} disabled={loading}>
              <Save size={16} /> Brouillon
            </button>
            <button className="btn btn-success" style={{ flex: 1.5, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }} onClick={() => handleSaveDocument('valide')} disabled={loading}>
              <CheckCircle2 size={16} /> Valider & Enregistrer
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <QuickClientModal
        isOpen={showQuickClientModal}
        onClose={() => setShowQuickClientModal(false)}
        onClientCreated={handleSelectClient}
      />

      <QuickArticleModal
        isOpen={showQuickArticleModal}
        onClose={() => setShowQuickArticleModal(false)}
        onArticleCreated={handleAddArticle}
        initialName={articleSearch}
      />

      <PaymentModal
        isOpen={!!savedDocForPayment}
        onClose={() => {
          // Si WhatsApp était coché et que le client a un numéro, envoyer le message du document (sans paiement)
          if (savedDocForPayment?.pending_whatsapp && savedDocForPayment?.id_client) {
            api.sendWhatsappDocument(savedDocForPayment.id_document).catch(e => console.error(e));
          }
          setSavedDocForPayment(null);
          // "Payer plus tard" : le document est déjà créé, on imprime quand même le ticket
          setShowPrintModal(true);
        }}
        document={savedDocForPayment}
        forceWhatsapp={savedDocForPayment?.pending_whatsapp}
        onPaymentCompleted={(reglement, montantEncaisse, monnaieRendue) => {
          setSavedDocForPayment(null);
          // Mettre à jour printedDoc avec le vrai montant payé pour le ticket
          setPrintedDoc((prev) => ({
            ...prev,
            montant_paye: montantEncaisse,
            montant_restant: Math.max(0, parseFloat(prev?.montant_ttc_final || 0) - montantEncaisse),
            montant_encaisse: montantEncaisse,
            monnaie_rendue: monnaieRendue,
            mode_paiement: reglement?.mode_paiement,
          }));
          // Ouvrir directement le ticket d'impression
          setShowPrintModal(true);
        }}
      />

      {/* Receipt Print Preview Modal */}
      <Modal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Impression Ticket de Caisse"
        maxWidth="400px"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowPrintModal(false)}>Fermer</button>
            <button className="btn btn-primary" onClick={() => window.print()}>
              <Printer size={16} /> Imprimer
            </button>
          </>
        }
      >
        <TicketPrint document={printedDoc} client={activeTab.client} />
      </Modal>
    </div>
  );
};
