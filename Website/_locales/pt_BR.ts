import { pt_BR } from "vuetify/src/locale";
// by Unnamed-orbert
export default {
  ...pt_BR,
  home: {
    name: "Inicio",
    title: "Return YouTube Dislike",
    subtitle: "Esta extensão de navegador usando a nossa APU irá mostra seus Deslikes no Youtube",
    ukraine: "Ajuda a Ucrania",
    sponsors: "Patrocinaores",
  },
  install: {
    name: "Instalação",
    title: "Selecione sua plataforma",
    subtitle: "Disponivel para Firefox e tidos navegadores Chromium",
    title2: "Outras Plataformas",
    subtitle2: "Se seu navegador não suportar isso, tente usa um UserScript",
    title3: "Implementação de terceiro",
    subtitle3: "Não nós garantimos com isso, use por sua conta e risco!",
  },
  api: {
    name: "API",
    title: "Bem-vindo aos documentos oficiais de RYD!",
    subtitle: "Para começar, selecione um seletor o menu.",
    rights: {
      title: "Direitos de uso",
      subtitle:
        "Third party use of this open API is allowed with the following restrictions:",
      bullet1: "Attribution: ",
      bullet1text:
        "This project should be clearly attributed with either a link to this repo or a link to returnyoutubedislike.com",
      bullet2: "Rate Limiting: ",
      bullet2text:
        "There are per client rate limits in place of 100 per minute and 10,000 per day. This will return a 429 status code indicating that your application should back off",
    },
    url: {
      title: "Informação da URL",
      subtitle: "A API é acessivel seguindo o URL base: ",
    },
    endpoints: {
      title: "Available Endpoints",
      subtitle: "List of available endpoints is available here: ",
    },
    fetching: {
      title: "Basic Fetching Tutorial",
      subtitle: "Example to get votes of a given YouTube video ID: ",
      title2: "Examplo de Requesitação : ",
      url: "URL de requisitação: ",
      method: "Metodo de solicitação: ",
      headers: "Cabeçalhos: ",
      response: "Resposta: ",
      error1: 'Isso é um ID do youtube invalido retornando o codigo 404 "não encontrado"',
      error2: 'Isso é um ID do youtube mal formatada retornando o codigo 400 "Solicitação ruim"',
    },
  },
  help: {
    name: "Ajuda",
    title: "Troubleshooting",
    bullet1: "Make sure you have latest version of extension installed, ",
    bullet11: "right now",
    bullet2: "Tente remover a extensão e instalar novamente, ou tente reiniciar o navegador",
    bullet3: "Faça isso abrindo este link:",
    bullet31: "you should see plain text: ",
    bullet4: "Se não encontrou um ajuda - reporte seu problema no ",
    bullet41: "na nossa",
    bullet4a: "Diga-nós o seu sistema operacional, navegador e Versão do navegador",
    bullet4b:
      "Take a screenshot of the page with the problem (i.e. Youtube video page) with the console open (press ",
    bullet4b1: ") - example screenshot below.",
    bullet4c:
      "Take a screenshot of the extensions page of your browser with the extension installed.",
    bullet4c1: "Veja as extensões put essa into barra de endereço: ",
    firefox: "para Firefox",
    chrome: "para Chrome, Edge, Brave, Opera e Vivaldi",
  },
  faq: {
    name: "FAQ",
    title: "Pergunta feitas com Frequencia",
    subtitle: "Ainda tem perguntas? Sinta-se livre para nós acompanhar no Discord!",
    bullet1: "Quais dados a extensão obtem Where does the extension get its data?",
    bullet1text:
      "A combination of archived data from before the official YouTube dislike API shut down, and extrapolated extension user behavior.",
    bullet2: "Por que a contagem de deslike não está atualizando?",
    bullet2text:
      "Right now video dislikes are cached and they aren't updated very frequently. It varies depending on a video's popularity but can take anywhere between a few hours and a few days to update.",
    bullet3: "Como isso funciona?",
    bullet3text:
      "The extension collects the video ID of the video you are watching, and fetches the number of dislikes (and other fields like views, likes etc) using our API. The extension then displays the dislike count and ratio on the page. If you like or dislike a video, that is recorded and sent to the database so an accurate dislike count can be extrapolated.",
    bullet4: "Eu posso compartilha a contador de deslike com você?",
    bullet4text:
      "Coming soon. We are looking into using Oauth or a different read only API with a limited scope so creators can share their dislike counts verifiability.",
    bullet5: "Quais os dados que vocs coletam para fazer isso funcionar?",
    bullet5text:
      'A extensão apenas coleta os dados extritamente necessaria para o funcionamento proprietario, como o seu endereço de IP e ID do video  que vocês atualmente assistindo. None of your data will ever be sold to 3rd parties. If you would like to know more about how we handle security and privacy check out our <a href="https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/SECURITY-FAQ.md">security FAQ</a>.',
    bullet6: "How does the API/Backend work?",
    bullet6text:
      "The backend is using archived data from when the youtube api was still returning the dislike count, extension users like/dislike count and extrapolation. In the near future we will be allowing content creators to submit their dislike count easily and safely and we will be adding ArchiveTeam's archived data (4.56 billion videos) into our current database. You can also view a video on the topic.",
    bullet7: "Why does the dislike count show 'DISLIKES DISABLED'?",
    bullet7text:
      "Sometimes a recently uploaded video might show 'DISLIKES DISABLED' even if the creator hasn't disabled it, this is due to how we are detecting if dislikes are disabled, it should go away in a few hours or by liking or disliking the video and refreshing the page (hopefully).",
  },
  donate: {
    name: "Doe",
    subtitle:
      "Você pode nós ajuda a melhora sua experiencia na internet com uma doação!",
  },
  links: {
    name: "Links",
    title: "Links de Projetos",
    subtitle: "Links para o projeto e outros desenvolvedores",
    contact: "Entre em Contato comigo (Only English, please!)",
    translators: "Tradutores",
    coolProjects: "Projetos de Qualidade",
    sponsorBlockDescription: "Pule propagangas integradas nos videos",
    filmotDescription: "Pesquise videos do YouTube pelas Legandas",
  },
};
