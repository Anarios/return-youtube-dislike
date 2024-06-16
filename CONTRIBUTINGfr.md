Lisez ceci dans d'autres langues : [English](CONTRIBUTING.md), [русский](CONTRIBUTINGru.md), Nederlands](CONTRIBUTINGnl.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Polski](CONTRIBUTINGpl.md), [Deutsch](CONTRIBUTINGde.md)

# Bienvenue dans le guide de contribution à Return YouTube Dislikes

Merci d'investir votre temps pour contribuer à notre projet ! Toutes vos modifications seront prises en compte dans la prochaine version de l'extension (ou du site web).

## Pour commencer

Veuillez utiliser [Prettier](https://prettier.io/) avec les paramètres par défaut pour le formatage du code.

#### Prérequis

Vous devez avoir installé node et npm pour créer la version bundle depuis le code source.

Versions utilisées lors de la mise en place :

- node: 12.18.4
- npm: 6.14.6

Pour créer le fichier `bundled-content-script.js` qui contient la plupart de la logique de cette extension, vous devez d'abord installer toutes les dépendances.

1. Allez à la racine du repo et exécutez :

```
npm install
```

2. Exécutez la commande suivante pour créer le fichier `bundled-content-script.js` qui est utilisé dans le fichier `manifest.json`.

```
npm start // pour créer le(s) fichier(s) de construction et lancer un observateur de fichiers qui recharge à chaud lors de la sauvegarde.

// ou

npm run build // pour créer le(s) fichier(s) de construction une seule fois
```

Félicitations, vous êtes maintenant prêt·e à développer !

Si vous n'avez jamais développé d'extensions pour Chrome ou si vous avez besoin d'une aide supplémentaire, consultez [ce tutoriel YouTube](https://www.youtube.com/watch?v=mdOj6HYE3_0) (en anglais).

### Problèmes (aussi appelé issues en anglais)

#### Signaler un problème

Si vous rencontrez des problèmes avec l'extension, vérifiez que le problème n'a pas déjà été signalé. Si ce n'est pas le cas, [signalez le problème](https://github.com/Anarios/return-youtube-dislike/issues/new?assignees=&labels=bug&template=bug.yml&title=%28Bug%29%3A+), en utilisant le formulaire qui est fortement recommandé mais pas obligatoire.

#### Résoudre un problème

Si vous avez trouvé un problème que vous pensez pouvoir résoudre, ne soyez pas timide. Ouvrez une [PR](https://github.com/Anarios/return-youtube-dislike/pulls) [(C'est quoi ?)](https://blog.zenika.com/2017/01/24/pull-request-demystifie/) avec la solution et assurez-vous de mentionner le problème que vous résolvez (écrivez # puis le numéro de l'issue).

### Demande de fonctionnalité (aussi appelé feature request en anglais)

#### Ouverture d'une nouvelle demande de fonctionnalité

Si vous avez une idée pour l'extension, n'hésitez pas à [ouvrir une demande de fonctionnalité](https://github.com/Anarios/return-youtube-dislike/issues/new?assignees=&labels=enhancement&template=feature-request.yml&title=%28Feature+Request%29%3A+), mais veuillez effectuer une recherche préalable pour vous assurer que la fonctionnalité n'est pas déjà proposée. L'utilisation du formulaire de demande de fonctionnalité est fortement recommandée mais pas obligatoire.

#### Implémenter une demande de fonctionnalité

Si vous avez trouvé une fonctionnalité que vous pensez pouvoir mettre en œuvre, ne soyez pas timide. Ouvrez une [PR](https://github.com/Anarios/return-youtube-dislike/pulls) [(C'est quoi ?)](https://blog.zenika.com/2017/01/24/pull-request-demystifie/) avec le correctif et assurez-vous de mentionner la fonctionnalité que vous implémentez (écrivez # puis le numéro de l'issue).

### Quels PR acceptons-nous ?

- Correction de problèmes.
- Implémentation de fonctionnalités.
- Fautes de frappe ou utilisation de mots plus simples et plus efficaces.
- Contributions au site web.
