import webbrowser
import urllib.parse
import logging
from decimal import Decimal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WhatsAppService:
    def _format_phone_number(self, phone: str) -> str:
        """Format the phone number to international format (no +, digits only for wa.me)."""
        if not phone:
            return ""
        
        # Remove any spaces, dashes, or parentheses
        cleaned = "".join(c for c in phone if c.isdigit() or c == "+")
        
        # Remove leading +
        cleaned = cleaned.lstrip("+")
        
        if not cleaned.startswith("216"):
            cleaned = f"216{cleaned}"
                
        return cleaned

    def send_text_message(self, phone: str, message: str) -> bool:
        """Send a plain text message via WhatsApp Web (opens browser tab with pre-filled message)."""
        formatted_phone = self._format_phone_number(phone)
        if not formatted_phone:
            logger.warning("Invalid phone number for WhatsApp message.")
            return False

        try:
            logger.info(f"Opening WhatsApp Web to send message to {formatted_phone}...")
            # Encode the message for URL
            encoded_message = urllib.parse.quote(message)
            url = f"https://wa.me/{formatted_phone}?text={encoded_message}"
            webbrowser.open(url)
            logger.info(f"WhatsApp Web opened for {formatted_phone}")
            return True
        except Exception as e:
            logger.error(f"Failed to open WhatsApp Web: {e}")
            return False

    def _balance_line(self, current_balance: Decimal) -> str:
        """Returns a human-readable line showing the client's account balance."""
        bal = float(current_balance)
        if bal < 0:
            return f">> Credit restant sur votre compte : {abs(bal):.3f} TND\n"
        elif bal > 0:
            return f">> Avance sur votre compte : {bal:.3f} TND\n"
        else:
            return f">> Votre compte est entierement solde.\n"

    def send_sale_notification(self, client, document, current_balance: Decimal):
        """Notification for a new sale/document (document only, no payment info)."""
        if not client.telephone:
            return

        nom_client = client.prenom + " " + client.nom if client.prenom else client.nom
        
        msg = f"Bonjour {nom_client},\n\n"
        msg += f"Votre document N° {document.numero} a ete enregistre.\n"
        msg += "-----------------\n"
        msg += "Detail des articles :\n"
        for ligne in (document.lignes or []):
            nom_art = ligne.article.nom if ligne.article else f"Article #{ligne.id_article}"
            qte = float(ligne.quantite)
            pu = float(ligne.prix_unitaire_ttc)
            remise = float(ligne.remise_pourcentage)
            total_ligne = qte * pu * (1 - remise / 100)
            if remise > 0:
                msg += f"  - {nom_art} x{qte:.0f} | {pu:.3f} TND (-{remise:.0f}%) = {total_ligne:.3f} TND\n"
            else:
                msg += f"  - {nom_art} x{qte:.0f} | {pu:.3f} TND = {total_ligne:.3f} TND\n"
        msg += "-----------------\n"
        msg += f"Total TTC : {float(document.montant_ttc_final):.3f} TND\n"
        if float(document.montant_restant) > 0:
            msg += f"Reste a payer sur ce document : {float(document.montant_restant):.3f} TND\n"
        else:
            msg += f"Ce document est entierement regle.\n"
        
        msg += "\n"
        msg += self._balance_line(current_balance)
        msg += "\nMerci de votre confiance."
        
        self.send_text_message(client.telephone, msg)

    def send_payment_notification(self, client, reglement, current_balance: Decimal, document=None):
        """Notification for a payment received, optionally with document details."""
        if not client.telephone:
            return

        nom_client = client.prenom + " " + client.nom if client.prenom else client.nom
        
        msg = f"Bonjour {nom_client},\n\n"
        
        # If a document is attached, show full sale details
        if document:
            msg += f"Votre document N° {document.numero} a ete enregistre.\n"
            msg += "-----------------\n"
            msg += "Detail des articles :\n"
            for ligne in (document.lignes or []):
                nom_art = ligne.article.nom if ligne.article else f"Article #{ligne.id_article}"
                qte = float(ligne.quantite)
                pu = float(ligne.prix_unitaire_ttc)
                remise = float(ligne.remise_pourcentage)
                total_ligne = qte * pu * (1 - remise / 100)
                if remise > 0:
                    msg += f"  - {nom_art} x{qte:.0f} | {pu:.3f} TND (-{remise:.0f}%) = {total_ligne:.3f} TND\n"
                else:
                    msg += f"  - {nom_art} x{qte:.0f} | {pu:.3f} TND = {total_ligne:.3f} TND\n"
            msg += "-----------------\n"
            msg += f"Total TTC        : {float(document.montant_ttc_final):.3f} TND\n"
            msg += f"Montant paye     : {float(reglement.montant):.3f} TND ({reglement.mode_paiement})\n"
            
        else:
            msg += f"Reglement N° {reglement.numero} enregistre.\n"
            msg += f"Montant paye : {float(reglement.montant):.3f} TND ({reglement.mode_paiement})\n"
        
        msg += "\n"
        msg += self._balance_line(current_balance)
        msg += "\nMerci de votre confiance."
        
        self.send_text_message(client.telephone, msg)

    def send_return_notification(self, client, retour, current_balance: Decimal):
        """Notification for a product return."""
        if not client.telephone:
            return

        nom_client = client.prenom + " " + client.nom if client.prenom else client.nom
        
        msg = f"Bonjour {nom_client},\n\n"
        msg += f"Votre bon de retour N° {retour.numero} a ete traite.\n"
        msg += f"Montant rembourse/deduit : {float(retour.montant_ttc):.3f} TND\n\n"
        msg += self._balance_line(current_balance)
        msg += "\nMerci."
        
        self.send_text_message(client.telephone, msg)

    def send_credit_reminder(self, client, relance, current_balance: Decimal):
        """Automatic credit reminder."""
        if not client.telephone or current_balance >= 0:
            return

        nom_client = client.prenom + " " + client.nom if client.prenom else client.nom
        
        msg = f"Bonjour {nom_client},\n\n"
        msg += f"Sauf erreur ou omission de notre part, votre compte client présente un solde débiteur (crédit) de {float(abs(current_balance)):.3f} TND.\n\n"
        msg += f"Nous vous prions de bien vouloir régulariser cette situation dans les meilleurs délais.\n\n"
        msg += "Si un règlement a été effectué entre-temps, veuillez ne pas tenir compte de ce message.\n\n"
        msg += "Merci de votre compréhension."
        
        self.send_text_message(client.telephone, msg)

whatsapp_service = WhatsAppService()
