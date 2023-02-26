Leia em outros idiomas: [русский](CONTRIBUTINGru.md), [Nederlands](CONTRIBUTINGnl.md), [Français](CONTRIBUTINGfr.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md)


# Bem-vindo ao guia de contribuição do Return YouTube Dislikes

Obrigado por investir seu tempo contribuindo para nosso projeto! Todas as suas alterações serão refletidas na próxima versão da extensão (ou do [site](https://www.returnyoutubedislike.com/)).

## Começando

Por favor, use o Prettier com as configurações padrão para formatar.

#### Pré-requisitos

Você precisa ter o node e npm instalados para criar a versão empacotada da fonte.

Versões usadas durante a configuração:

- node: 12.18.4
- npm: 6.14.6

Para criar o `bundled-content-script.js`, que contém a maior parte da lógica do negócio desta extensão, você precisa instalar todas as dependências primeiro.

1.  Vá para a raiz do repositório e execute:

```
npm install
```

2.  Execute o seguinte comando para criar `bundled-content-script.js`, que é usado em `manifest.json`.

```
npm start // para criar o(s) arquivo(s) de construção e iniciar um observador de arquivos que recarrega na gravação

// ou

npm run build // para criar o(s) arquivo(s) de construção uma vez
```

Parabéns, agora você está pronto para desenvolver!

Se você é novo no desenvolvimento de extensões para o Chrome ou precisa de ajuda extra, consulte [este tutorial do YouTube](https://www.youtube.com/watch?v=mdOj6HYE3_0).

### Issues

#### Abrindo uma nova issue

Se você tiver algum problema com a extensão, pesquise para verificar se a issue ainda não foi relatada. Se não foi, abra uma issue, usar o formulário de issue é altamente recomendado, mas não obrigatório.

#### Resolvendo uma issue

Se você encontrou uma issue que acredita ser capaz de resolver, não seja tímido. Abra um PR com a correção e certifique-se de mencionar a issue que está corrigindo.

### Solicitação de recurso

#### Abrindo uma nova solitação de recurso

Se você tem uma ideia para a extensão, sinta-se à vontade para abrir uma solicitação de recurso, mas pesquise antes para ter certeza de que o recurso ainda não foi sugerido. Usar o formulário de recurso é altamente recomendado, mas não obrigatório.

#### Implementando uma solicitação de recurso

Se você encontrou um recurso que acredita ser capaz de implementar, não seja tímido. Abra um PR com a correção e certifique-se de mencionar o recurso que está implementando.

### Quais PRs aceitamos?

- Correções de problemas.
- Implementação de recursos.
- Correção de erros de digitação ou palavras melhores e mais fáceis de usar.
- Contribuições para o site.