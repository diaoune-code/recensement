// Fiche du contribuable : identité, et ce qu'il doit au service de l'agent pour la période en cours
import { useCallback, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../contexte/Session';
import { useSynchro } from '../contexte/Synchro';
import { appel } from '../api/client';
import { enregistrerPhotoTelechargee, lireContribuable, paiementsDuContribuable } from '../db/depots';
import { Badge, BadgeSynchro, Bouton, Carte, Ecran, LigneInfo, Message, TitreSection } from '../composants/Ui';
import { calculerMontant, dateHeure, descriptionTarif, gnf, libellePeriode, nomComplet, periodeCourante, valeurBase } from '../metier/calcul';
import { couleurs, styles } from '../theme';

export default function FicheContribuableEcran({ navigation, route }) {
  const { id, nouveau } = route.params;
  const { config, jeton } = useSession();
  const { serveurJoignable } = useSynchro();
  const [c, setC] = useState(null);
  const [paiements, setPaiements] = useState([]);

  const charger = useCallback(async () => {
    const fiche = await lireContribuable(id);
    setC(fiche);
    setPaiements(await paiementsDuContribuable(id));
    // Photo prise par un autre agent : téléchargée à la demande quand le réseau est là
    if (fiche?.a_photo && !fiche.photo && serveurJoignable) {
      try {
        const r = await appel(`/contribuables/${id}/photo`, { jeton, delai: 15000 });
        await enregistrerPhotoTelechargee(id, r.image_base64);
        setC({ ...fiche, photo: r.image_base64 });
      } catch { /* sans réseau : pas de photo, ce n'est pas bloquant */ }
    }
  }, [id, jeton, serveurJoignable]);

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

      <Carte style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {c.photo
            ? <Image source={{ uri: `data:image/jpeg;base64,${c.photo}` }} style={{ width: 72, height: 72, borderRadius: 8 }} />
            : <View style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: couleurs.fond, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person" size={34} color={couleurs.bordure} /></View>}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.titre}>{nomComplet(c)}</Text>
            {c.raison_sociale ? <Text style={styles.texteDoux}>{c.raison_sociale}</Text> : null}
            <Text style={styles.texteDoux}>{c.numero || 'Numéro attribué à la synchronisation'}</Text>
            <BadgeSynchro etat={c.etat_synchro} />
          </View>
        </View>
        {c.etat_synchro === 'ERREUR' && <Message type="erreur" texte={`Refusé par le serveur : ${c.erreur_synchro}`} />}
        <LigneInfo cle="Téléphone" valeur={c.telephone} />
        <LigneInfo cle="Quartier" valeur={[c.quartier, c.secteur].filter(Boolean).join(' — ')} />
        <LigneInfo cle="Marché / étal" valeur={[c.nom_marche, c.numero_etal].filter(Boolean).join(' — ')} />
        <LigneInfo cle="Concession" valeur={c.numero_porte} />
        <LigneInfo cle="Rue / emprise" valeur={[c.rue, c.sur_emprise === 'OUI' ? 'sur emprise' : null].filter(Boolean).join(' — ')} />
        <LigneInfo cle="Type d'habitat" valeur={[c.type_habitat, c.nb_etages ? `${c.nb_etages} étage(s)` : null].filter(Boolean).join(' — ')} />
        <LigneInfo cle="Activité" valeur={[c.activite_principale, { FORMEL: 'F', INFORMEL: 'NF' }[c.statut_fiscal]].filter(Boolean).join(' — ')} />
        <LigneInfo cle="Surface (m²)" valeur={c.surface_m2} />
        <LigneInfo cle="Étals" valeur={c.nb_etals} />
        <LigneInfo cle="Bien" valeur={[c.type_bien, c.usage_bien].filter(Boolean).join(' — ')} />
        <LigneInfo cle="Documents fonciers" valeur={c.documents_fonciers} />
        <LigneInfo cle="Lien avec le bien" valeur={c.lien_repondant_bien} />
        <LigneInfo cle="Dernier paiement déclaré" valeur={[c.dernier_paiement_date, c.dernier_paiement_montant ? gnf(c.dernier_paiement_montant) : null].filter(Boolean).join(' — ')} />
        <LigneInfo cle="Consentement" valeur={{ OUI: 'Oui', NON: 'Non' }[c.consentement]} />
        <LigneInfo cle="Contrôle qualité" valeur={{ PIECE_VERIFIEE: 'Pièce vérifiée', DECLARATIF: 'Déclaratif' }[c.controle_qualite]} />
        {Object.entries(c.complements?.[sigle] || {}).filter(([k]) => k !== 'taxes_applicables').map(([k, v]) => {
          const champ = config?.service?.champs?.find((x) => x.cle === k);
          return <LigneInfo key={k} cle={champ?.libelle || k} valeur={v} />;
        })}
        <Bouton titre="Compléter / corriger la fiche" icone="create-outline" variante="secondaire"
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
                {taches.find((t) => t.id === p.tache_id)?.libelle || `Tâche ${p.tache_id}`}
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
