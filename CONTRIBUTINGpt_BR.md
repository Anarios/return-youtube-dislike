Read this in other languages: [русский](CONTRIBUTINGru.md), [Nederlands](CONTRIBUTINGnl.md), [Français](CONTRIBUTINGfr.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Polski](CONTRIBUTINGpl.md), [Español](CONTRIBUTINGes.md), [العربية](CONTRIBUTINGar.md) ou [English (Para Melhor precisão!)](CONTRIBUTING.md), [Bahasa Indonesia](CONTRIBUTINGid.md), [中文](CONTRIBUTINGcn.md)


# Bem-vindo ao guia de contribuição do Return YouTube Dislikes

Obrigado por investir seu tempo contribuindo para o nosso projeto! Todas as mudanças serão refletidas na próxima versão da extensão (ou do [website](https://www.returnyoutubedislike.com/)).

## Começando

Por favor use o Prettier com as configurações padrão de formatação.

#### Pré requisitos

Você precisa ter o node e o npm instalados para criar o pacote a partir do código-fonte.

Versões usadas na configuração:

- node: 12.18.4
- npm: 6.14.6

Para criar o `bundled-content-script.js` que contém muita da lógica de negócio dessa extensão você precisará instalar todas as dependências primeiro.

1. Vá para a raiz do repositório e execute:

```
npm install
```

2. Execute o comando a seguir para criar o `bundled-content-script.js` que será usado no `manifest.json`

```
npm start // Para criar os arquivos de build e iniciar um file watcher que recarrega o conteúdo automaticamente ao salvar

// ou

npm run build // Para criar os arquivos de build apenas uma vez
```

Parabéns, agora você está pronto para desenvolver!

Se você é novo no desenvolvimento de extensões para o Chrome, ou precisa de ajuda extra, por favor dê uma olhada [nesse tutorial do YouTube](https://www.youtube.com/watch?v=mdOj6HYE3_0)

### Problemas(Issues)

#### Abrindo uma nova issue

Se você tiver qualquer problema com a extensão, por favor pesquise nas issues do nosso repositório para ter certeza de que o problema já não foi reportado. Se não foi, abra uma issue, usar o formulário de issues é altamente recomendado mas não é obrigatório.

#### Resolvendo issues

Se você encontrou uma issue que você sente que é capaz de corrigir, não tenha vergonha. Abra uma PR com a correção e certifique-se de mencionar a issue que você está corrigindo.

### Sugerir um nova funcionalidade(Feature request)

#### Abrindo uma feature request

Se você tem uma ideia de funcionalidade para a extensão, sinta-se livre para abrir uma feature request no nosso repositório, mas por favor certifique-se de que a funcionalidade já não foi sugerida. Usar o formulário de features é altamente recomendado mas não é obrigatório.

#### Implementando uma feature request

Se você encontrou uma feature request que você sente que é capaz de implementar, não tenha vergonha. Abra uma PR com a implementação e certifique-se de mencionar a feature request que você está implementando.

### Quais PRs nós aceitamos?

- Correção de problemas.
- Implementação de funcionalidades.
- Erros de digitação e palavras melhores ou mais fáceis de entender.
- Contribuições para o Website.
