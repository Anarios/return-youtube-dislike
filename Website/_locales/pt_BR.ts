import { pt } from "vuetify/src/locale";

export default {
  ...pt,
  home: {
    name: "Início",
    title: "Return YouTube Dislike",
    subtitle:
      "Extensão de navegador e uma API que mostra os dislikes no Youtube",
    ukraine: "Apoie a Ucrânia",
    sponsors: "Patrocinadores",
  },
  install: {
    name: "Instalar",
    title: "Selecione sua Plataforma",
    subtitle: "Disponível para Firefox e todos os navegadores Chromium",
    title2: "Outras Plataformas",
    subtitle2:
      "Se o seu navegador ainda não for suportado, tente este UserScript",
    title3: "Implementações de Terceiros",
    subtitle3: "Sem responsabilidade de nossa parte, use por sua conta e risco",
  },
  api: {
    name: "API",
    title: "Bem-vindo à documentação oficial do RYD!",
    subtitle: "Para começar, selecione uma seção no menu.",
    rights: {
      title: "Direitos de uso",
      subtitle:
        "O uso de terceiros desta API aberta é permitido com as seguintes restrições:",
      bullet1: "Atribuição: ",
      bullet1text:
        "Este projeto deve ser claramente atribuído com um link para este repositório ou um link para returnyoutubedislike.com",
      bullet2: "Limitação de taxa: ",
      bullet2text:
        "Existem limites de taxa por cliente de 100 por minuto e 10.000 por dia. Isso retornará um código de status 429 indicando que sua aplicação deve diminuir a velocidade.",
    },
    url: {
      title: "Informação de URL",
      subtitle: "A API é acessível no seguinte URL base: ",
    },
    endpoints: {
      title: "Endpoints disponíveis",
      subtitle: "Lista de endpoints disponíveis está disponível aqui: ",
    },
    fetching: {
      title: "Tutorial Básico de Requisição",
      subtitle:
        "Exemplo para obter votos de um vídeo do YouTube com um ID específico:",
      title2: "Exemplo de Requisição:",
      url: "URL da Requisição: ",
      method: "Método da Requisição: ",
      headers: "Cabeçalhos: ",
      response: "Resposta: ",
      error1:
        'Um ID do YouTube inválido retornará o código de status 404 "Not Found".',
      error2:
        'Um ID do YouTube com formato incorreto retornará 400 "Bad Request".',
    },
  },
  help: {
    name: "Ajuda",
    title: "Solucionando problemas",
    bullet1:
      "Certifique-se de ter a versão mais recente da extensão instalada, ",
    bullet11: "agora.",
    bullet2:
      "Tente remover a extensão e instalá-la novamente, em seguida, reinicie o navegador (todas as janelas ativas, não apenas uma guia).",
    bullet3: "Certifique-se de que este link abre: ",
    bullet31: "você deve ver texto simples: ",
    bullet4: "Se nada disso ajudar - reporte seu problema em",
    bullet41: "no nosso ",
    bullet4a: "Informe seu sistema operacional, nome e versão do navegador.",
    bullet4b:
      "Tire uma captura de tela da página com o problema (ou seja, página do vídeo do Youtube) com o console aberto (pressione ",
    bullet4b1: ") - exemplo de captura de tela abaixo.",
    bullet4c:
      "Tire uma captura de tela da página de extensões do seu navegador com a extensão instalada.",
    bullet4c1: "Para ver as extensões, digite isso na barra de endereço: ",
    firefox: "para Firefox.",
    chrome: "para Chrome, Edge, Brave, Opera e Vivaldi.",
  },
  faq: {
    name: "FAQ",
    title: "Perguntas Frequentes",
    subtitle:
      "Ainda tem perguntas? Sinta-se à vontade para entrar no nosso Discord!",
    bullet1: "De onde a extensão obtém seus dados?",
    bullet1text:
      "De uma combinação de dados arquivados antes do desligamento oficial da API de deslikes do YouTube e do comportamento dos usuários da extensão extrapolado.",
    bullet2: "Por que a contagem de deslikes não está sendo atualizada?",
    bullet2text:
      "Atualmente, os deslikes dos vídeos são armazenados em cache e não são atualizados com muita frequência. Isso varia dependendo da popularidade do vídeo, mas pode levar de algumas horas a alguns dias para ser atualizado.",
    bullet3: "Como isso funciona?",
    bullet3text:
      "A extensão coleta o ID do vídeo que você está assistindo e busca o número de deslikes (e outros campos como visualizações, likes etc.) usando nossa API. A extensão então exibe a contagem e a proporção de deslikes na página. Se você gosta ou não gosta de um vídeo, isso é registrado e enviado para o banco de dados para que uma contagem precisa de deslikes possa ser extrapolada.",
    bullet4: "Posso compartilhar minha contagem de deslikes com vocês?",
    bullet4text:
      "Em breve. Estamos analisando o uso de Oauth ou uma API somente de leitura com um escopo limitado para que os criadores possam compartilhar suas contagens de deslikes de forma verificável.",
    bullet5: "Que dados vocês coletam e como eles são tratados?",
    bullet5text:
      'A extensão coleta apenas os dados estritamente necessários para que ela funcione corretamente, como o endereço IP ou ID do vídeo que você está assistindo. Nenhum dos seus dados será vendido para terceiros. Se você quiser saber mais sobre como lidamos com segurança e privacidade, confira nosso <a href="https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/SECURITY-FAQptBR.md">FAQ de segurança</a>.',
    bullet6: "Como funciona a API/backend?",
    bullet6text:
      "O backend está usando dados arquivados da época em que a API do YouTube ainda retornava a contagem de deslikes, a contagem de likes/deslikes dos usuários da extensão e a extrapolação. Em um futuro próximo, permitiremos que os criadores de conteúdo enviem sua contagem de deslikes facilmente e com segurança e adicionaremos os dados arquivados do ArchiveTeam (4,56 bilhões de vídeos) em nosso banco de dados atual. Você também pode assistir a um vídeo sobre o assunto.",
    bullet7: "Por que a contagem de deslikes mostra 'DESLIKES DESATIVADOS'?",
    bullet7text:
      "Às vezes, um vídeo recentemente carregado pode mostrar 'DESLIKES DESATIVADOS', mesmo que o criador não o tenha desativado. Isso ocorre devido à forma como estamos detectando se os deslikes estão desativados e deve desaparecer em algumas horas ou ao gostar ou não gostar do vídeo e atualizar a página (esperançosamente).",
  },
  donate: {
    name: "Doar",
    subtitle:
      "Você pode apoiar nossos esforços para manter a internet livre com uma doação!",
  },
  links: {
    name: "Links",
    title: "Links do Projeto",
    subtitle: "Links para o projeto e seus desenvolvedores",
    contact: "Entre em Contato",
    translators: "Tradutores",
    coolProjects: "Projetos Legais",
    sponsorBlockDescription: "Pula anúncios integrados ao vídeo",
    filmotDescription: "Busca vídeos no YouTube por meio das legendas",
  },
};
