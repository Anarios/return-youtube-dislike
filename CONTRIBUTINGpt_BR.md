Read this in other languages: [русский](CONTRIBUTINGru.md), [Nederlands](CONTRIBUTINGnl.md), [Français](CONTRIBUTINGfr.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Polski](CONTRIBUTINGpl.md)

# Bem-vindo ao Guia de contribuição do Return YouTube Dislikes

Thank you for investing your time in contributing to our project! All your changes will be reflected in the next version of the extension (or the [website](https://www.returnyoutubedislike.com/)).

## Vamos ao  começo

Por favor use o Prettir com a configurações padrão de formatação.

#### Prerequisites

vocÊ precisa ter node e npm instalado para criar um You need to have node and npm installed to create the bundled version of the source.

Versões que usará quando estiver trabalhando nisso:

- node: 12.18.4
- npm: 6.14.6

To create the `bundled-content-script.js` that contains most of the business logic of this extension you have to install all dependencies first.

1. Vá para a raiz do repositorio e execute:

```
npm install
```

2. Execute o seguinte comando para criar `bundled-content-script.js` which (what is?) e usando no `manifest.json`

```
npm start // to create the build file(s) and start a file watcher that hot-reloads on save

// ou

npm run build // para criar uma build para cria um arquivo de build 
```

Congratulations, You are now ready to develop!

If you are new to developing Chrome extensions, or need extra help, please see [this YouTube tutorial](https://www.youtube.com/watch?v=mdOj6HYE3_0)

### Problemas

#### Abrindo um novo problema

Se voce tiver qualquer problema com a extensão, por favor pesquisa o que faz o problema antes de reporta-lo de fato. Se não houver, abra um probelma, usando o formulario de problema é recomendado mas não é uma obrigação.

#### Solucionando um problema

Se você tiver um problema If you found an issue that you feel you might be able to solve, Não seja  "shy"? . Abra um PR(Pull Request)com a correção e faça uma menção do problema que está consertando.

### Requisitação de Recurso

#### Abrindo uma nova requisitação de recurso

Se você tem alguma ideia para a extensão, sinta livre para abrir uma requisitação de recurso, mas por favor pesquise isso antes para não perder seu tempo com sua sugestão. Usando o formulario de recurso é altamente recomendado mas não é um obrigação.

#### Implementando uma requisitação de recurso

If you found a feature that you feel you might be able to implement, don't be shy. Open a PR with the fix and make sure to mention the feature you are implementing.

### What PRs do we accept?

- Resolução de problemas.
- Implementação de recurso.
- Marcação, melhoria facilitação de palavras usadas.
- Contribuição para o Website.
