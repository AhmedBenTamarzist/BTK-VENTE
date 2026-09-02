import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import { TicketPrint } from '../components/print/TicketPrint';
import { Printer } from 'lucide-react';

export const PrintView = () => {
  const { id } = useParams();
  const [document, setDocument] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        setLoading(true);
        const doc = await api.getDocument(id);
        setDocument(doc);
        if (doc.id_client) {
          const c = await api.getClient(doc.id_client);
          setClient(c);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [id]);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement du document pour impression...</div>;
  if (!document) return <div style={{ padding: '2rem', textAlign: 'center', color: '#f87171' }}>Document introuvable.</div>;

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="no-print" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
        <button className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={18} /> Imprimer le Ticket
        </button>
      </div>

      <div style={{ background: 'white', color: 'black', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}>
        <TicketPrint document={document} client={client} />
      </div>
    </div>
  );
};
