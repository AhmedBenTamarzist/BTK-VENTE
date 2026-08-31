const API_BASE_URL = '/api/v1';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Session expirée, veuillez vous reconnecter.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.detail || 'Une erreur est survenue lors de la requête.';
    throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
  }

  return data;
}

export const api = {
  // Auth
  login: async (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Email ou mot de passe incorrect');
    }
    return response.json();
  },
  getMe: () => request('/auth/me'),

  // Enterprise
  getEnterprise: () => request('/enterprise/'),
  updateEnterprise: (data) => request('/enterprise/', { method: 'PUT', body: JSON.stringify(data) }),

  // Users
  getUsers: () => request('/users/'),
  createUser: (data) => request('/users/', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Clients
  getClients: (search = '', actifOnly = true) => request(`/clients/?search=${encodeURIComponent(search)}&actif_only=${actifOnly}`),
  getClient: (id) => request(`/clients/${id}`),
  createClient: (data) => request('/clients/', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id, data) => request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getArticlesAchetesClient: (idClient) => request(`/clients/${idClient}/articles-achetes`),
  getHistoriqueArticleClient: (idClient, idArticle) => request(`/clients/${idClient}/historique-article/${idArticle}`),

  // Fournisseurs
  getFournisseurs: (search = '') => request(`/fournisseurs/?search=${encodeURIComponent(search)}`),
  getFournisseur: (id) => request(`/fournisseurs/${id}`),
  createFournisseur: (data) => request('/fournisseurs/', { method: 'POST', body: JSON.stringify(data) }),
  updateFournisseur: (id, data) => request(`/fournisseurs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Categories
  getCategories: () => request('/categories/'),
  createCategory: (data) => request('/categories/', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id, data) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Articles & Stock
  getArticles: (search = '', idCategorie = '', lowStockOnly = false) => {
    let url = `/articles/?search=${encodeURIComponent(search)}`;
    if (idCategorie) url += `&id_categorie=${idCategorie}`;
    if (lowStockOnly) url += `&low_stock_only=true`;
    return request(url);
  },
  getArticle: (id) => request(`/articles/${id}`),
  createArticle: (data) => request('/articles/', { method: 'POST', body: JSON.stringify(data) }),
  updateArticle: (id, data) => request(`/articles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adjustStock: (id, delta, reason = '') => request(`/articles/${id}/adjust-stock?delta=${delta}&reason=${encodeURIComponent(reason)}`, { method: 'POST' }),
  getPriceHistory: (id) => request(`/articles/${id}/price-history`),
  getBestSupplierPrice: (id) => request(`/articles/${id}/best-supplier-price`),

  // Achats Fournisseur
  getAchats: (fournisseurId = '', statutPaiement = '') => {
    let url = '/achats/?';
    if (fournisseurId) url += `fournisseur_id=${fournisseurId}&`;
    if (statutPaiement) url += `statut_paiement=${statutPaiement}&`;
    return request(url);
  },
  getAchat: (id) => request(`/achats/${id}`),
  createAchat: (data) => request('/achats/', { method: 'POST', body: JSON.stringify(data) }),
  updateAchat: (id, data) => request(`/achats/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  addPaiementAchat: (id, data) => request(`/achats/${id}/paiements`, { method: 'POST', body: JSON.stringify(data) }),
  updateLignesAchat: (id, lignes) => request(`/achats/${id}/lignes`, { method: 'PUT', body: JSON.stringify({ lignes }) }),

  // Documents de Vente (Devis / BL / Facture Rapide)
  getDocuments: (typeDoc = '', idClient = '', statut = '', statutLivraison = '', nonFacturesOnly = false) => {
    let url = '/documents/?';
    if (typeDoc) url += `type_document=${typeDoc}&`;
    if (idClient) url += `id_client=${idClient}&`;
    if (statut) url += `statut=${statut}&`;
    if (statutLivraison) url += `statut_livraison=${statutLivraison}&`;
    if (nonFacturesOnly) url += `non_factures_only=true&`;
    return request(url);
  },
  getDocumentsByClient: (idClient) => request(`/documents/?id_client=${idClient}`),
  getDocument: (id) => request(`/documents/${id}`),
  createDocument: (data) => request('/documents/', { method: 'POST', body: JSON.stringify(data) }),
  updateDocument: (id, data) => request(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deliverDocument: (id, data) => request(`/documents/${id}/deliver`, { method: 'POST', body: JSON.stringify(data) }),
  convertDevisToBl: (id) => request(`/documents/${id}/convert-to-bl`, { method: 'POST' }),
  convertDevisToFacture: (id) => request(`/documents/${id}/convert-to-facture`, { method: 'POST' }),
  sendWhatsappDocument: (id) => request(`/documents/${id}/send-whatsapp`, { method: 'POST' }),
  deliverDocumentItems: (id, data) => request(`/documents/${id}/deliver`, { method: 'POST', body: JSON.stringify(data) }),

  // Client Passage (client anonyme)
  getPassageClient: () => request('/clients/passage'),

  // Bons de Retour
  getRetours: (idClient = '') => request(`/retours/${idClient ? `?id_client=${idClient}` : ''}`),
  getRetour: (id) => request(`/retours/${id}`),
  createRetour: (data) => request('/retours/', { method: 'POST', body: JSON.stringify(data) }),
  deleteRetour: (id) => request(`/retours/${id}`, { method: 'DELETE' }),

  // Facturation Groupée Fiscale
  getFacturations: (idClient = '', statut = '') => {
    let url = '/facturations/?';
    if (idClient) url += `id_client=${idClient}&`;
    if (statut) url += `statut=${statut}&`;
    return request(url);
  },
  getFacturation: (id) => request(`/facturations/${id}`),
  createFacturation: (data) => request('/facturations/', { method: 'POST', body: JSON.stringify(data) }),
  updateFacturation: (id, data) => request(`/facturations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFacturation: (id) => request(`/facturations/${id}`, { method: 'DELETE' }),
  getFacturationBls: (id) => request(`/facturations/${id}/bls`),
  getFacturationRetours: (id) => request(`/facturations/${id}/retours`),

  // Règlements
  getClientPayments: (idClient = '') => request(`/reglements/clients${idClient ? `?id_client=${idClient}` : ''}`),
  createClientPayment: (data) => request('/reglements/clients', { method: 'POST', body: JSON.stringify(data) }),
  getSupplierPayments: (idFournisseur = '') => request(`/reglements/fournisseurs${idFournisseur ? `?id_fournisseur=${idFournisseur}` : ''}`),
  createSupplierPayment: (data) => request('/reglements/fournisseurs', { method: 'POST', body: JSON.stringify(data) }),
  updateClientChequeStatus: (id, statutCheque) => request(`/reglements/clients/${id}/statut-cheque`, { method: 'PUT', body: JSON.stringify({ statut_cheque: statutCheque }) }),
  updateSupplierChequeStatus: (id, statutCheque) => request(`/reglements/fournisseurs/${id}/statut-cheque`, { method: 'PUT', body: JSON.stringify({ statut_cheque: statutCheque }) }),

  // Relances Crédit
  getRelances: (idClient = '', statut = '') => {
    let url = '/relances/?';
    if (idClient) url += `id_client=${idClient}&`;
    if (statut) url += `statut=${statut}&`;
    return request(url);
  },
  createRelance: (data) => request('/relances/', { method: 'POST', body: JSON.stringify(data) }),
  updateRelance: (id, data) => request(`/relances/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  sendWhatsappRelance: (id, data = {}) => request(`/relances/${id}/send-whatsapp`, { method: 'POST', body: JSON.stringify(data) }),

  // Logs
  getLogs: (tableConcernee = '', idUtilisateur = '', limit = 100) => {
    let url = `/logs/?limit=${limit}&`;
    if (tableConcernee) url += `table_concernee=${tableConcernee}&`;
    if (idUtilisateur) url += `id_utilisateur=${idUtilisateur}&`;
    return request(url);
  }
};
