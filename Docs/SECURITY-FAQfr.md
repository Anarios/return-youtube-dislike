Lisez ceci dans d'autres langues : [English](SECURITY-FAQ.md), [русский](SECURITY-FAQru.md), [Nederlands](SECURITY_FAQnl.md), [Türkçe](SECURITY-FAQtr.md), [українська](SECURITY-FAQuk.md), [Polski](SECURITY-FAQpl.md), [Deutsch](SECURITY-FAQde.md), [العربية](SECURITY-FAQar.md), [Bahasa Indonesia](SECURITY-FAQid.md), [中文](SECURITY-FAQcn.md), [български](SECURITY-FAQbg.md), [Tiếng Việt](SECURITY-FAQvi.md), [Slovenščina](SECURITY-FAQsl.md)

# Sécurité

### Est-ce que vous traquez l'historique des vidéos que je visionne ?

L'extension envoie à l'API de Return YouTube Dislike l'identifiant de la vidéo en cours et, lorsqu'il est disponible,
le nombre de mentions « J'aime » affiché. Le service utilise ces données pour fournir et améliorer l'estimation du
nombre de dislikes. Lors d'une requête, le serveur reçoit aussi des métadonnées de la
[couche de communication](https://fr.wikipedia.org/wiki/Mod%C3%A8le_OSI#Caract%C3%A9risation_r%C3%A9sum%C3%A9e_des_couches)
comme votre adresse IP publique, ainsi que l'heure de la requête. L'extension n'envoie ni le nom de votre compte YouTube,
ni les commentaires YouTube, ni les données privées de YouTube, ni le
contenu de pages sans rapport. Elle ne conserve pas de liste locale distincte des vidéos visionnées. Dans Firefox,
l'identifiant de la vidéo et le nombre de mentions « J'aime » ne sont envoyés qu'avec votre autorisation pour chacun.

### Pouvez-vous m'identifier de manière unique si je dislike ?

La première fois que vous votez ou réagissez à un commentaire RYD, l'extension crée un identifiant aléatoire
persistant pour prévenir les abus lors du vote. L'extension n'envoie pas cet identifiant quand vous ouvrez une vidéo
ou lisez des commentaires. Il ne provient pas de votre compte Google ou YouTube et n'y est pas associé. Mozilla
classe les identifiants persistants parmi les données personnelles. Cet identifiant permet au service d'associer
les votes à la même installation de l'extension.

### Quelles sont les informations dont vous disposez, exactement ?

Les requêtes concernant le nombre de dislikes incluent l'identifiant de la vidéo et, lorsqu'il est disponible, le
nombre de mentions « J'aime » affiché. L'inscription utilise un identifiant d'installation aléatoire. Le service
enregistre les votes envoyés avec cet identifiant, celui de la vidéo, le vote choisi et l'heure. Les réactions aux
commentaires RYD utilisent le même identifiant d'installation, celui du commentaire et la réaction choisie. Les votes
et les réactions peuvent également indiquer l'extension ou le script utilisateur utilisé, sa version et, lorsqu'elle
est disponible, la position de lecture en secondes entières au moment du clic. Si vous retirez une réaction, le
service marque l'enregistrement correspondant comme supprimé. Vos commentaires et réponses sur RYD sont publics sous
votre pseudonyme RYD.

### Comment mon IP est-elle stockée ?

Le service enregistre votre adresse IP ainsi que, lorsqu'elle est disponible, la chaîne d'identification du navigateur
envoyée avec la requête (user-agent). Il conserve ces données avec les inscriptions finalisées, les votes, les
commentaires et réponses publiés et les réactions aux commentaires RYD. Le service utilise les adresses IP pour
prévenir les abus et produire des analyses agrégées. Il ne les vend pas et ne les utilise pas à des fins publicitaires.

### J'ai entendu des discussions sur OAuth, et l'accès à mon compte YouTube !

Cette fonctionnalité sera facultative et fera l'objet d'une demande d'adhésion. Si vous êtes un créateur YouTube et que vous souhaitez partager vos statistiques de dislikes avec nous, vous pouvez le faire. La façon dont [OAuth](https://fr.wikipedia.org/wiki/OAuth) a été structuré, c'est en fait très sûr. Vous pouvez révoquer l'accès à votre compte à tout moment et nous donner des autorisations très spécifiques. Nous ne demanderons pas d'autorisations qui ne sont pas nécessaires. Nous ne vous demanderons que l'autorisation de consulter les statistiques de vos vidéos.

### Comment puis-je faire confiance à ce compte de dislikes ?

Nous avons mis en place des mesures pour prévenir les attaques de robots et nous allons continuer à travailler pour améliorer l'efficacité du système de prévention des robots : cela nous aidera à faire en sorte que le nombre de dislikes soit une bonne représentation du nombre réel. Bien entendu, il ne sera jamais précis à 100 %, c'est donc à vous de décider si vous lui faites confiance ou non.

### Pourquoi ne pas partager le code du backend ?

Nous la partagerons à un moment donné - mais il n'y a pas vraiment de raison de la partager pour le moment. Cela donne un faux sentiment de sécurité, car dans un système zero-trust, nous pourrions tout aussi bien publier une version et en déployer une autre. Il y a de nombreuses raisons de garder le code caché, notamment pour lutter contre le spam. Cacher/dissimuler le code de traitement du spam est une pratique assez standard.
