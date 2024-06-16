Lisez ceci dans d'autres langues : [English](FAQ.md), [русский](FAQru.md), [Nederlands](FAQnl.md), [Türkçe](FAQtr.md), [українська](FAQuk.md), [Polski](FAQpl.md), [Deutsch](FAQde.md)

# Foire Aux Questions

## Avant de poser une question sur GitHub ou Discord, veuillez vous référer à ceci.

### **1. Où cette extension obtient-elle les données ?**

Une combinaison d'API de Google et de données scrapées.

Nous sauvegardons toutes les données disponibles dans notre base de données pour qu'elles soient disponibles après que Google ait supprimé le compteur de dislikes dans son API.

### **2. Le nombre de dislikes sur les vidéos n'est pas mis à jour**

Actuellement, les dislike sont mis en cache et ne sont pas mis à jour très fréquemment. Une fois tous les 2-3 jours, pas plus souvent.

Oui, ce n'est pas idéal, mais c'est ce que c'est. Nous travaillons à améliorer la fréquence des mises à jour.

### **3. Comment cela fonctionne-t-il ?**

L'extension collecte l'ID de la vidéo que vous regardez, récupère les dislikes (et d'autres champs comme les vues, les likes etc.) en utilisant notre API, si c'est la première fois que la vidéo a été récupérée par notre API, elle utilisera l'API YouTube pour obtenir les données, puis stocke les données dans une base de données pour la mise en cache (mise en cache pendant environ 2-3 jours) et à des fins d'archivage et vous les renvoie. L'extension vous affiche ensuite les dislikes.

### **4. Que se passera-t-il lorsque l'API YouTube ne renverra plus le nombre de dislikes ?**

Le backend utilisera une combinaison de statistiques du nombre de dislikes archivées, d'estimations extrapolées à partir des données d'extension des utilisateurs et d'estimations basées sur les ratios vues/likes pour les vidéos dont les dislikes n'ont pas été archivées et pour les archives dont le nombre de dislikes est obsolète.

## Je suis préoccupé par la sécurité / la confidentialité

Voir [cette page](SECURITY-FAQfr.md) pour plus d'informations.
