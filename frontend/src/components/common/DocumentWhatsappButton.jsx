import React, { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { toast } from '../../contexts/ToastContext';
import { api } from '../../services/api';

const canSendWhatsapp = (client, passageClientId) => {
  if (!client) return false;
  if (passageClientId && client.id_client === passageClientId) return false;
  if (client.nom === 'Client Passage') return false;
  return Boolean(client.telephone && String(client.telephone).trim());
};

const whatsappDisabledTitle = (client, passageClientId) => {
  if (!client) return 'Client inconnu';
  if (passageClientId && client.id_client === passageClientId) return 'Client Passage — pas de WhatsApp';
  if (client.nom === 'Client Passage') return 'Client Passage — pas de WhatsApp';
  if (!client.telephone || !String(client.telephone).trim()) return 'Ce client n\'a pas de numéro de téléphone';
  return 'Envoyer le document + rappel crédit par WhatsApp';
};

export const DocumentWhatsappButton = ({ document, client, passageClientId = null, size = 14 }) => {
  const [sending, setSending] = useState(false);
  const enabled = canSendWhatsapp(client, passageClientId);

  const handleClick = async (e) => {
    e.stopPropagation();
    if (!document?.id_document || !enabled || sending) return;

    try {
      setSending(true);
      const res = await api.sendWhatsappDocument(document.id_document);
      if (res.url) {
        window.open(res.url, '_blank', 'noopener,noreferrer');
      }
      toast.success('WhatsApp va s\'ouvrir avec le détail du document et le solde crédit.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      title={whatsappDisabledTitle(client, passageClientId)}
      onClick={handleClick}
      disabled={!enabled || sending}
      style={{
        color: enabled ? '#25D366' : 'var(--text-muted)',
        borderColor: enabled ? '#25D366' : undefined,
        opacity: enabled ? 1 : 0.45,
      }}
    >
      <MessageCircle size={size} />
      {sending ? '…' : ''}
    </button>
  );
};
