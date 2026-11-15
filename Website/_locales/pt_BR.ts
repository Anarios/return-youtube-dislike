import { pt } from "vuetify/locale";
// by Unnamed-orbert
export default {
  ...pt,
  home: {
    name: "Inicio",
    title: "Return YouTube Dislike",
    subtitle: "Esta extensão de navegador usando a nossa APU irá mostra seus Deslikes no Youtube",
    ukraine: "Ajuda a Ucrania",
    sponsors: "Patrocinaores",
    becomeSponsor: "Torne-se nosso patrocinador",
  },
  install: {
    name: "Instalação",
    title: "Selecione sua plataforma",
    subtitle: "Disponivel para Firefox e tidos navegadores Chromium",
    title2: "Outras Plataformas",
    subtitle2: "Se seu navegador não suportar isso, tente usa um UserScript",
    title3: "Implementação de terceiro",
    subtitle3: "Não nós garantimos com isso, use por sua conta e risco!",
    firefox: "Firefox",
    chrome: "Chrome",
    edge: "Edge",
    opera: "Opera",
    brave: "Brave",
    userscript: "UserScript",
    tampermonkey: "Tampermonkey",
    androidReVanced: "Android - ReVanced",
    androidMorphe: "Android - Morphe",
    androidTubular: "Android (Tubular - um fork do NewPipe)",
    iosJailbroken: "iOS (com jailbreak)",
    iosUYouPlus: "iOS (uYou+)",
  },
  api: {
    name: "API",
    title: "Boas-vindas à documentação oficial do RYD!",
    subtitle: "Para começar, selecione uma seção no menu.",
    rights: {
      title: "Direitos de uso",
      subtitle:
        "Terceiros podem usar esta API aberta, desde que respeitem as seguintes condições:",
      bullet1: "Atribuição: ",
      bullet1text:
        "Dê os devidos créditos ao projeto de forma clara, com um link para este repositório ou para returnyoutubedislike.com.",
      bullet2: "Limites de requisições: ",
      bullet2text:
        "Cada cliente pode fazer até 100 requisições por minuto e 10.000 por dia. Ao ultrapassar esses limites, a API retorna o código de status 429, indicando que sua aplicação deve aguardar antes de fazer novas requisições.",
    },
    url: {
      title: "URL base",
      subtitle: "A API está disponível nesta URL base: ",
    },
    endpoints: {
      title: "Endpoints disponíveis",
      subtitle: "Consulte a lista de endpoints disponíveis aqui: ",
    },
    fetching: {
      title: "Como consultar os votos",
      subtitle: "Exemplo de consulta dos votos de um vídeo do YouTube pelo ID: ",
      title2: "Exemplo de requisição: ",
      url: "URL da requisição: ",
      method: "Método da requisição: ",
      headers: "Cabeçalhos: ",
      response: "Resposta: ",
      error1: 'Um ID inválido do YouTube retorna o código de status 404 "Not Found" (não encontrado).',
      error2: 'Um ID do YouTube com formato incorreto retorna o código de status 400 "Bad Request" (requisição inválida).',
    },
  },
  help: {
    name: "Ajuda",
    title: "Solução de problemas",
    bullet1: "Verifique se a versão",
    bullet11: "da extensão está instalada. Essa é a versão mais recente.",
    bullet2:
      "Tente remover a extensão, instalá-la novamente e reiniciar o navegador. Feche todas as janelas abertas, não apenas uma aba.",
    bullet3: "Ao abrir o link",
    bullet31: "confira se aparece uma resposta em texto simples como esta:",
    bullet4: "Se nada disso resolver, relate o problema no canal ",
    bullet41: "do nosso",
    bullet4a: "Informe seu sistema operacional, o nome do navegador e a versão dele.",
    bullet4b:
      "Na página em que o problema aparece (por exemplo, a de um vídeo do YouTube), pressione",
    bullet4b1: "e abra a aba Console. Faça uma captura de tela como a do exemplo abaixo.",
    bullet4c:
      "Faça uma captura de tela da página de extensões do navegador mostrando a extensão instalada.",
    bullet4c1: "Para abrir a página de extensões, digite na barra de endereço: ",
    firefox: "para Firefox",
    chrome: "para Chrome, Edge, Brave, Opera e Vivaldi",
    detected: "Detectado:",
    altExampleScreenshot: "captura de tela de exemplo",
  },
  faq: {
    name: "FAQ",
    title: "Perguntas frequentes",
    subtitle: "Ainda tem dúvidas? Entre no nosso Discord!",
    bullet1: "De onde vêm os dados da extensão?",
    bullet1text:
      "Usamos dados arquivados da época em que a API do YouTube ainda mostrava quantos votos de “Não gostei” cada vídeo tinha. Combinamos esses dados com os votos de quem usa a extensão para estimar o total.",
    bullet2: "Por que a contagem de “Não gostei” demora para mudar?",
    bullet2text:
      "A extensão mostra a última contagem salva. Dependendo da popularidade do vídeo, pode levar de algumas horas a alguns dias para uma nova contagem aparecer.",
    bullet3: "Como funciona a extensão?",
    bullet3text:
      "A extensão usa o ID do vídeo que você está vendo para consultar nossa API. Ela busca a contagem de “Não gostei”, o número de visualizações e o de curtidas. Na página do vídeo, você vê a contagem de “Não gostei” e a proporção entre os votos de “Gostei” e “Não gostei”. Quando você clica em um desses botões, a extensão envia seu voto ao nosso banco de dados. Esses votos ajudam a estimar o total.",
    bullet4: "Posso compartilhar com vocês a contagem de “Não gostei” dos meus vídeos?",
    bullet4text:
      "Ainda estamos estudando como oferecer esse recurso, seja com OAuth ou com uma API somente de leitura e permissões limitadas. A ideia é que os criadores possam compartilhar as contagens dos próprios vídeos e que possamos confirmar esses números.",
    bullet5: "Que dados vocês coletam e como usam essas informações?",
    bullet5text:
      'A extensão coleta apenas os dados de que precisa para funcionar, como seu endereço IP e o ID do vídeo que você está vendo. Nunca venderemos seus dados a terceiros. Para saber mais sobre como tratamos esses dados e protegemos sua privacidade, consulte as <a href="https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/SECURITY-FAQpt_BR.md">perguntas frequentes sobre segurança</a>.',
    bullet6: "Como funcionam a API e o servidor da extensão?",
    bullet6text:
      "O servidor usa as contagens arquivadas da época em que a API do YouTube ainda informava o total de “Não gostei”. Ele combina esses dados com os votos de “Gostei” e “Não gostei” de quem usa a extensão para estimar a contagem de cada vídeo. Também planejamos facilitar o envio seguro das contagens pelos próprios criadores e incluir no banco de dados as informações de 4,56 bilhões de vídeos arquivados pelo ArchiveTeam. Você também pode assistir a um vídeo sobre o assunto.",
    bullet7: "Por que aparece a mensagem “Desativado pelo proprietário” no lugar da contagem?",
    bullet7text:
      "Em vídeos recém-publicados, a extensão às vezes identifica por engano que o criador desativou os votos de “Não gostei”. A mensagem costuma desaparecer em algumas horas. Você também pode clicar em “Gostei” ou “Não gostei” e depois atualizar a página para ver se a contagem já aparece.",
  },
  donate: {
    name: "Doe",
    subtitle:
      "Você pode nós ajuda a melhora sua experiencia na internet com uma doação!",
    patreon: "Patreon",
    crypto: "Cripto",
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
    github: "GitHub",
    discord: "Discord",
  },
  layout: {
    notSupported: "não é compatível.",
    considerUpgrade: "Considere atualizar para a versão mais recente.",
  },
};
