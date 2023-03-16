Leia em outros idiomas: [English](README.md), [Nederlands](READMEnl.md), [Türkçe](READMEtr.md)

# return-youtube-dislike-site

## Configuração de Build

```bash
# instalar dependências
$ npm install

# executar com hot reload em localhost:3000
$ npm run dev

# verificar seu código com ESLint
$ npm run lint

# gerar build para produção e lançar o servidor
$ npm run build
$ npm run start

# gerar projeto estático
$ npm run generate
```

Para uma explicação detalhada sobre como as coisas funcionam, confira a [documentação](https://nuxtjs.org/).

## Configuração recomendada para o VSCode

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) `ext install dbaeumer.vscode-eslint`
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) `ext install esbenp.prettier-vscode`
- [Vetur](https://marketplace.visualstudio.com/items?itemName=octref.vetur)

> `Ctrl(Cmd)` + `Shift` + `P` > Abrir Configurações (JSON)

```
"editor.formatOnSave": true,
"editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
}
"vetur.validation.template": false,
```

## Diretórios Especiais

Você pode criar os seguintes diretórios extras, alguns dos quais têm comportamentos especiais. Apenas `pages` é obrigatório; você pode excluí-los se não quiser usar sua funcionalidade.

### `assets`

O diretório de assets contém seus assets não compilados, como arquivos Stylus ou Sass, imagens ou fontes.

Mais informações sobre o uso deste diretório na [documentação](https://nuxtjs.org/docs/2.x/directory-structure/assets).

### `components`

O diretório de componentes contém seus componentes Vue.js. Os componentes compõem as diferentes partes da sua página e podem ser reutilizados e importados em suas páginas, layouts e até mesmo outros componentes.

Mais informações sobre o uso deste diretório na [documentação](https://nuxtjs.org/docs/2.x/directory-structure/components).

### `layouts`

Os layouts são de grande ajuda quando você deseja mudar a aparência e sensação do seu aplicativo Nuxt, seja incluindo uma barra lateral ou tendo layouts distintos para dispositivos móveis e desktop.

Mais informações sobre o uso deste diretório na [documentação](https://nuxtjs.org/docs/2.x/directory-structure/layouts).

### `pages`

Este diretório contém as visualizações e rotas de sua aplicação. Nuxt lerá todos os arquivos `*.vue` dentro deste diretório e configurará o Vue Router automaticamente.

Mais informações sobre o uso deste diretório na [documentação](https://nuxtjs.org/docs/2.x/get-started/routing).

### `plugins`

O diretório de plugins contém plugins JavaScript que você deseja executar antes de instanciar o aplicativo Vue.js raiz. Este é o lugar para adicionar plugins Vue e injetar funções ou constantes. Sempre que você precisar usar `Vue.use()`, você deve criar um arquivo em `plugins/` e adicionar seu caminho aos plugins em `nuxt.config.js`.

Mais informações sobre o uso deste diretório na [documentação](https://nuxtjs.org/docs/2.x/directory-structure/plugins).

### `static`

Este diretório contém seus arquivos estáticos. Cada arquivo dentro deste diretório é mapeado para `/`.

Exemplo: `/static/robots.txt` é mapeado como `/robots.txt`.

Mais informações sobre o uso deste diretório na [documentação](https://nuxtjs.org/docs/2.x/directory-structure/static).

### `store`

Este diretório contém seus arquivos de Vuex store. Criar um arquivo neste diretório ativa automaticamente o Vuex.

Mais informações sobre o uso deste diretório na [documentação](https://nuxtjs.org/docs/2.x/directory-structure/store).