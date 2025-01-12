Lisez ceci dans d'autres langues : [English](SECURITY-FAQ.md), [русский](SECURITY-FAQru.md), [Nederlands](SECURITY_FAQnl.md), [Türkçe](SECURITY-FAQtr.md), [українська](SECURITY-FAQuk.md), [Polski](SECURITY-FAQpl.md), [Deutsch](SECURITY-FAQde.md)

# Sécurité

### Est-ce que vous traquez l'historique des vidéos que je visionne ?

Non. Le code de l'extension est public et vous pouvez le voir par vous-même. La seule information envoyée est l'ID de la vidéo, qui est nécessaire pour récupérer le nombre de dislikes des vidéos. Aucun en-tête (headers) supplémentaire n'est envoyé. Sur la [couche de communication](https://fr.wikipedia.org/wiki/Mod%C3%A8le_OSI#Caract%C3%A9risation_r%C3%A9sum%C3%A9e_des_couches), votre adresse IP publique sera exposée au serveur, ainsi que l'heure à laquelle la demande a été faite. Toutefois, aucun de ces éléments ne permet de vous identifier de manière unique. Dans un environnement où vous ne pouvez avoir confiance en personne (zero-trust environment), le mieux que l'on puisse obtenir est une IP dynamique. Qui, aujourd'hui est la vôtre, demain est celle de votre voisin. Si vous êtes vraiment inquiet que votre IP soit tracée, vous utilisez probablement déjà un VPN.

### Pouvez-vous m'identifier de manière unique si je dislike ?

Oui. Lorsque vous dislikez une vidéo, nous créons pour vous un identifiant unique généré de manière aléatoire et non lié à votre compte Google. Cette mesure vise à empêcher les robots. Mais il n'y a aucun moyen de lier cet identifiant aléatoire à vous ou à votre compte YouTube personnel.

### Quelles sont les informations dont vous disposez, exactement ?

Juste l'ID de la vidéo. Pas vos commentaires, pas votre nom d'utilisateur, pas les personnes avec qui vous avez partagé la vidéo, pas de métadonnées supplémentaires. Rien. Juste l'ID de la vidéo.

### Comment mon IP est-elle stockée ?

Le backend conserve les adresses IP non hachées uniquement dans la mémoire volatile (RAM). Ces adresses ne sont pas stockées sur un disque dur et ne sont donc pas enregistrées. Nous hachons les adresses IP et stockons ça à la place. Ceci est fait pour empêcher le vandalisme de la base de données.

### J'ai entendu des discussions sur OAuth, et l'accès à mon compte YouTube !

Cette fonctionnalité sera facultative et fera l'objet d'une demande d'adhésion. Si vous êtes un créateur YouTube et que vous souhaitez partager vos statistiques de dislikes avec nous, vous pouvez le faire. La façon dont [OAuth](https://fr.wikipedia.org/wiki/OAuth) a été structuré, c'est en fait très sûr. Vous pouvez révoquer l'accès à votre compte à tout moment et nous donner des autorisations très spécifiques. Nous ne demanderons pas d'autorisations qui ne sont pas nécessaires. Nous ne vous demanderons que l'autorisation de consulter les statistiques de vos vidéos.

### Comment puis-je faire confiance à ce compte de dislikes ?

Nous avons mis en place des mesures pour prévenir les attaques de robots et nous allons continuer à travailler pour améliorer l'efficacité du système de prévention des robots : cela nous aidera à faire en sorte que le nombre de dislikes soit une bonne représentation du nombre réel. Bien entendu, il ne sera jamais précis à 100 %, c'est donc à vous de décider si vous lui faites confiance ou non.

### Pourquoi ne pas partager le code du backend ?

Nous la partagerons à un moment donné - mais il n'y a pas vraiment de raison de la partager pour le moment. Cela donne un faux sentiment de sécurité, car dans un système zero-trust, nous pourrions tout aussi bien publier une version et en déployer une autre. Il y a de nombreuses raisons de garder le code caché, notamment pour lutter contre le spam. Cacher/dissimuler le code de traitement du spam est une pratique assez standard.
