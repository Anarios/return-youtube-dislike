import { fr } from "vuetify/src/locale";

export default {
  ...fr,
  home: {
    name: "Accueil",
    title: "Return YouTube Dislike",
    subtitle:
      "Une extension de navigateur et une API qui vous montre les dislike sur Youtube",
    ukraine: "Soutenir l'Ukraine",
    sponsors: "Sponsors",
  },
  install: {
    name: "Installer",
    title: "Choisissez votre Plateforme",
    subtitle: "Disponible pour Firefox et tous les navigateurs Chromium",
    title2: "Autres platesformes",
    subtitle2:
      "Si votre navigateur n'est pas encore pris en charge, essayez ce UserScript",
    title3: "Implémentations par des tiers",
    subtitle3:
      "Aucune responsabilité de notre part, à utiliser à vos risques et périls.",
  },
  api: {
    name: "API",
    title: "Bienvenue sur la documentation officiel de RYD !",
    subtitle: "Pour commencer, sélectionnez une section dans le menu.",
    rights: {
      title: "Droits d'utilisation",
      subtitle:
        "L'utilisation par des tiers de cette API ouverte est autorisée avec les restrictions suivantes : ",
      bullet1: "Attribution: ",
      bullet1text:
        "Ce projet doit être clairement nommé avec un lien vers soit vers GitHub soit vers returnyoutubedislike.com",
      bullet2: "Limites des requêtes",
      bullet2text:
        "Il y a des limites de requêtes par client en place qui sont de 100 requêtes par minute et 10 000 par jour. Nous renverrons un code d'erreur 429 indiquant que votre application devrait se calmer.",
    },
    url: {
      title: "Information sur l'URL",
      subtitle: "L'API est accesible via l'URL de base suivante : ",
    },
    endpoints: {
      title: "Endpoints disponibles",
      subtitle: "La liste des endpoints disponibles est accesible ici : ",
    },
    fetching: {
      title: "Tutoriel de base sur la récupération des données",
      subtitle:
        "Exemple pour obtenir les likes d'une vidéo YouTube avec un ID donné : ",
      title2: "Example de requête : ",
      url: "URL de la requête : ",
      method: "Mode de requête : ",
      headers: "En-têtes (headers) : ",
      response: "Réponse : ",
      error1:
        "Si aucune vidéo YouTube n'a cet ID, le code d'erreur 404 \"Not Found\" sera retourné",
      error2:
        'Un ID YouTube invalide renverra le code d\'erreur *400* "Bad Request"',
    },
  },
  help: {
    name: "Aide",
    title: "Dépannage",
    bullet1:
      "Assurez-vous que la dernière version de l'extension est installée, ",
    bullet11: "à l'heure actuelle",
    bullet2:
      "Essayez de supprimer l'extension et de la réinstaller, puis redémarrez le navigateur (toutes les fenêtres actives, pas seulement un onglet).",
    bullet3: "Assurez-vous que ce lien s'ouvre : ",
    bullet31: "vous devriez voir du texte brut : ",
    bullet4:
      "Si rien de ce qui précède ne vous aide, signalez votre problème sur",
    bullet41: "ou sur notre",
    bullet4a:
      "Indiquez-nous votre système d'exploitation ansi que le nom et la version de votre navigateur",
    bullet4b:
      "Faites une capture d'écran de la page présentant le problème (par exemple, la page de la vidéo youtube) avec la console ouverte (appuyez sur ",
    bullet4b1: ") - exemple de capture d'écran ci-dessous.",
    bullet4c:
      "Faites une capture d'écran de la page des extensions de votre navigateur avec les extension installée.",
    bullet4c1:
      "Pour voir les extensions, mettez ceci dans la barre d'adresse : ",
    firefox: "pour Firefox",
    chrome: "pour Chromium (Chrome, Edge, Brave, Opera, Vivaldi...)",
  },
  faq: {
    name: "FAQ",
    title: "Foire Aux Questions",
    subtitle:
      "Vous avez encore des questions ? N'hésitez pas à rejoindre notre Discord (en anglais) !",
    bullet1: "Où l'extension obtient-elle ses données ?",
    bullet1text:
      "Une combinaison de données archivées datant d'avant la fermeture de l'API officielle de YouTube pour les dislikes, et d'extrapolation du comportement des utilisateurs.",
    bullet2: "Pourquoi le nombre de dislike n'est-il pas mis à jour ?",
    bullet2text:
      "Actuellement, les dislike des vidéos sont mis en cache et ne sont pas mis à jour très fréquemment. La mise à jour varie en fonction de la popularité de la vidéo, mais peut prendre entre quelques heures et quelques jours.",
    bullet3: "Comment cela fonctionne-t-il ?",
    bullet3text:
      "L'extension collecte l'ID de la vidéo que vous regardez, récupère les dislike (et d'autres champs comme les vues, les likes, etc.) en utilisant notre API. L'extension affiche ensuite le nombre de dislike et le ratio sur la page. Si vous liker ou disliker une vidéo, cela est enregistré et envoyé à la base de données afin qu'un nombre précis de dislikes puisse être extrapolé.",
    bullet4: "Puis-je partager mon compte de dislike avec vous ?",
    bullet4text:
      "Prochainement. Nous envisageons d'utiliser Oauth ou une autre API en lecture seule avec un champ d'application limité afin que les créateurs puissent partager leurs compteurs de dislikes de manière vérifiable.",
    bullet5:
      "Quelles sont les données que vous collectez et comment sont-elles traitées ?",
    bullet5text:
      "L'extension ne collecte que les données strictement nécessaires à son bon fonctionnement, comme l'adresse IP ou l'ID de la vidéo que vous regardez. Aucune de vos données ne sera jamais vendue à des tiers. Si vous souhaitez en savoir plus sur la manière dont nous gérons la sécurité et la confidentialité, consultez notre <a href=\"https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/SECURITY-FAQfr.md\">FAQ sur la sécurité</a>.",
    bullet6: "Comment fonctionne l'API / le Backend ?",
    bullet6text:
      "Le backend utilise des données archivées de l'époque où l'API Youtube renvoyait encore le nombre de dislike, il utilise aussi le nombre de like/dislike des utilisateurs de l'extension et une extrapolation. Dans un avenir proche, nous allons permettre aux créateurs de contenu de soumettre leurs nombres de dislike facilement et en toute sécurité et nous allons ajouter les données archivées d'ArchiveTeam (4,56 milliards de vidéos) à notre base de données actuelle. Vous pouvez également visionner une vidéo sur le sujet.",
    bullet7:
      'Pourquoi le compteur de dislike affiche-t-il "Désactivé par le créateur" ?',
    bullet7text:
      'Parfois, une vidéo récemment publiée peut afficher "Désactivé par le créateur" même si le créateur ne l\'a pas désactivé. Cela est dû à la façon dont nous détectons si les dislikes sont désactivés, cela devrait disparaître dans quelques heures ou en likant ou en dislikant la vidéo et en rafraîchissant la page (avec un peu de chance).',
  },
  donate: {
    name: "Donner",
    subtitle:
      "Vous pouvez soutenir nos efforts pour que l'internet reste libre en faisant un don !",
  },
  links: {
    name: "Liens",
    title: "Liens du Projet",
    subtitle: "Liens vers le projet et ses développeurs",
    contact: "Contactez-moi",
    translators: "Traducteurs",
    coolProjects: "Projets Cools",
    sponsorBlockDescription:
      "Ignorer les publicités intégrées (sponso) dans la vidéo",
    filmotDescription: "Rechercher des vidéos YouTube par sous-titres",
  },
};
