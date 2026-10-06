// Fiche du contribuable : identité, et ce qu'il doit au service de l'agent pour la période en cours
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../contexte/Session';
import { lireContribuable, paiementsDuContribuable } from '../db/depots';
import { Badge, BadgeSynchro, Bouton, Carte, Ecran, LigneInfo, Message, TitreSection } from '../composants/Ui';
import { calculerMontant, dateHeure, descriptionTarif, gnf, libellePeriode, nomComplet, periodeCourante, valeurBase } from '../metier/calcul';
import { couleurs, styles } from '../theme';

export default function FicheContribuableEcran({ navigation, route }) {
  const { id, nouveau } = route.params;
  const { config } = useSession();
  const [c, setC] = useState(null);
  const [paiements, setPaiements] = useState([]);

  const charger = useCallback(async () => {
    setC(await lireContribuable(id));
    setPaiements(await paiementsDuContribuable(id));
  }, [id]);

  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  if (!c) return <Ecran><Text style={styles.texteDoux}>Chargement…</Text></Ecran>;

  const sigle = config?.service?.sigle;
  // Taxes concernées : celles cochées au recensement pour ce service, sinon toutes les taxes du service
  const cochees = c.complements?.[sigle]?.taxes_applicables;
  const toutesTaches = config?.taches || [];
  const taches = cochees?.length ? toutesTaches.filter((t) => cochees.includes(t.id)) : toutesTaches;
  const valides = paiements.filter((p) => p.statut === 'VALIDE');

  // Situation de chaque taxe du service pour la période en cours
  const situation = taches.map((t) => {
    const periode = periodeCourante(t.frequence);
    const paye = valides.find((p) => p.tache_id === t.id && p.periode === periode);
    const base = valeurBase(t, c, sigle);
    const montant = t.mode_calcul === 'TARIF_BASE' && base === null ? null : calculerMontant(t, { base });
    return { t, periode, paye, base, montant };
  });
  const totalDu = situation.filter((s) => !s.paye && s.montant).reduce((a, s) => a + s.montant, 0);

  return (
    <Ecran>
      {nouveau && <Message type="succes" texte="Fiche enregistrée sur le téléphone. Elle sera transmise automatiquement." />}

      {/* Uniquement les champs de la fiche de collecte du service de collecte */}
      <Carte style={{ gap: 8 }}>
        <View style={{ gap: 4 }}>
          <Text style={styles.titre}>{nomComplet(c)}</Text>
          <Text style={styles.texteDoux}>{c.numero || 'Numéro attribué à la synchronisation'}</Text>
          <BadgeSynchro etat={c.etat_synchro} />
        </View>
        {c.etat_synchro === 'ERREUR' && <Message type="erreur" texte={`Refusé par le serveur : ${c.erreur_synchro}`} />}
        <Text style={[styles.titreSection, { marginTop: 4 }]}>Identification et localisation</Text>
        <LigneInfo cle="Type de contribuable" valeur={c.type_contribuable === 'PERSONNE_PHYSIQUE' ? 'Personne physique' : 'Personne morale (entreprise)'} />
        <LigneInfo cle="Quartier / Marché" valeur={[c.quartier, c.nom_marche].filter(Boolean).join(' — ')} />
        <LigneInfo cle="Secteur" valeur={c.secteur} />
        <LigneInfo cle="Rue / Emprise" valeur={c.rue} />
        <LigneInfo cle="N° de concession / Boutique / Magasin / Kiosque" valeur={c.numero_porte} />
        <LigneInfo cle="Type d'habitat" valeur={c.type_habitat} />
        <LigneInfo cle="Nombre d'étages" valeur={c.nb_etages} />
        <LigneInfo cle="Activité F / NF" valeur={{ FORMEL: 'Formelle (F)', INFORMEL: 'Informelle (NF)' }[c.statut_fiscal]} />
        <LigneInfo cle="Numéro de téléphone" valeur={c.telephone} />
        <LigneInfo cle="Activité" valeur={c.activite_principale} />
        <LigneInfo cle="Taxes et redevances" valeur={(cochees || []).map((tid) => toutesTaches.find((t) => t.id === tid)?.libelle).filter(Boolean).join(' · ')} />
        <Text style={[styles.titreSection, { marginTop: 6 }]}>Bien et documents</Text>
        <LigneInfo cle="Type de bien" valeur={c.type_bien} />
        <LigneInfo cle="Usage principal du bien" valeur={c.usage_bien} />
        <LigneInfo cle="Documents fonciers" valeur={c.documents_fonciers} />
        <LigneInfo cle="Lien répondant / bien" valeur={c.lien_repondant_bien} />
        <Text style={[styles.titreSection, { marginTop: 6 }]}>Paiements et suivi</Text>
        <LigneInfo cle="Dernier paiement déclaré" valeur={[c.dernier_paiement_date, c.dernier_paiement_montant ? gnf(c.dernier_paiement_montant) : null].filter(Boolean).join(' — ')} />
        <Text style={[styles.titreSection, { marginTop: 6 }]}>Pièces, consentement et contrôle qualité</Text>
        <LigneInfo cle="Pièce" valeur={[c.piece_type, c.piece_numero].filter(Boolean).join(' — ')} />
        <LigneInfo cle="Consentement" valeur={{ OUI: 'Oui', NON: 'Non' }[c.consentement]} />
        <LigneInfo cle="Contrôle qualité" valeur={{ PIECE_VERIFIEE: 'Pièce vérifiée', DECLARATIF: 'Déclaratif, non vérifié' }[c.controle_qualite]} />
        <Bouton titre="Compléter / corriger la fiche" icone="create-outline" variante="secondaire" style={{ marginTop: 6 }}
          onPress={() => navigation.navigate('Formulaire', { id: c.id })} />
      </Carte>

      <TitreSection>Ce qu'il doit — {config?.service?.nom}</TitreSection>
      {!taches.length && <Message type="alerte" texte="Aucune taxe n'est paramétrée pour votre service. Synchronisez ou contactez votre chef de service." />}
      {situation.map(({ t, periode, paye, base, montant }) => (
        <Pressable key={t.id} disabled={!!paye}
          onPress={() => navigation.navigate('Encaissement', { contribuableId: c.id, tacheId: t.id })}
          style={({ pressed }) => [styles.carte, { gap: 6, opacity: pressed ? 0.85 : 1, borderColor: paye ? couleurs.bordure : couleurs.primaire }]}>
          <View style={styles.ligne}>
            <Text style={[styles.texte, { fontWeight: '700', flex: 1 }]}>{t.libelle}</Text>
            {paye ? <Badge texte="Payé" type="succes" /> : <Badge texte="À payer" type="alerte" />}
          </View>
          <Text style={styles.texteDoux}>{descriptionTarif(t)} · {libellePeriode(t.frequence, periode)}</Text>
          {paye ? (
            <Text style={styles.texteDoux}>Reçu {paye.numero_recu} — {gnf(paye.montant)}</Text>
          ) : (
            <View style={styles.ligne}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: couleurs.primaire, flex: 1 }}>
                {montant !== null && t.mode_calcul !== 'BAREME' ? gnf(montant) : t.mode_calcul === 'BAREME' ? 'Selon catégorie' : `À calculer (${t.base_libelle})`}
              </Text>
              {base !== null && t.mode_calcul === 'TARIF_BASE' && <Text style={styles.texteDoux}>base : {base} {t.base_libelle}</Text>}
              <Ionicons name="chevron-forward" size={20} color={couleurs.primaire} />
            </View>
          )}
        </Pressable>
      ))}
      {totalDu > 0 && <Text style={[styles.texteDoux, { textAlign: 'right' }]}>Total connu restant dû : {gnf(totalDu)}</Text>}

      <TitreSection>Historique des paiements au service</TitreSection>
      <Carte style={{ gap: 8 }}>
        {paiements.length ? paiements.map((p) => (
          <Pressable key={p.id} onPress={() => navigation.navigate('Recu', { id: p.id })} style={{ gap: 2, paddingVertical: 4 }}>
            <View style={styles.ligne}>
              <Text style={[styles.texte, { flex: 1, textDecorationLine: p.statut === 'ANNULE' ? 'line-through' : 'none' }]}>
                {taches.find((t) => t.id === p.tache_id)?.libelle || `Taxe ${p.tache_id}`}
              </Text>
              <Text style={[styles.texte, { fontWeight: '700' }]}>{gnf(p.montant)}</Text>
            </View>
            <View style={styles.ligne}>
              <Text style={[styles.texteDoux, { flex: 1 }]}>{p.numero_recu} · {dateHeure(p.date_paiement)}</Text>
              {p.statut === 'ANNULE' ? <Badge texte="Annulé" type="danger" /> : <BadgeSynchro etat={p.etat_synchro} />}
            </View>
          </Pressable>
        )) : <Text style={styles.texteDoux}>Aucun paiement enregistré pour ce service.</Text>}
      </Carte>
    </Ecran>
  );
}
