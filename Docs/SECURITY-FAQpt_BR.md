Leia em outros idiomas: [English](SECURITY-FAQ.md), [فارسی](SECURITY-FAQfa.md), [беларуская](SECURITY-FAQbe.md), [русский](SECURITY-FAQru.md), [Nederlands](SECURITY-FAQnl.md), [Français](SECURITY-FAQfr.md), [Italiano](SECURITY-FAQit.md), [Türkçe](SECURITY-FAQtr.md), [українська](SECURITY-FAQuk.md), [Polski](SECURITY-FAQpl.md), [Deutsch](SECURITY-FAQde.md), [العربية](SECURITY_FAQar.md), [Bahasa Indonesia](SECURITY-FAQid.md), [中文](SECURITY-FAQcn.md), [български](SECURITY-FAQbg.md), [Tiếng Việt](SECURITY-FAQvi.md), [Slovenščina](SECURITY-FAQsl.md), [Slovenčina](SECURITY-FAQsk.md)

# Segurança

### Vocês rastreiam meu histórico de visualizações?

A extensão envia à API do Return YouTube Dislike o ID do vídeo que você está vendo e, quando disponível, o número de
votos de “Gostei” exibido no vídeo. O servidor usa esses dados para fornecer e melhorar a estimativa de votos de
“Não gostei”. A requisição também revela dados comuns de rede, como o endereço IP público e o horário do acesso. A extensão
não envia o nome da sua conta do YouTube, seus comentários no YouTube, dados privados do YouTube nem o conteúdo de
páginas não relacionadas, e não mantém uma lista local separada do histórico de visualizações. No Firefox, o ID do vídeo
e a contagem de marcações “Gostei” só são enviados após você autorizar o envio de cada um deles.

### Quando clico em “Não gostei”, vocês conseguem me identificar?

Na primeira vez que você vota ou reage a um comentário do RYD, a extensão cria um ID aleatório persistente para proteger
o envio de votos contra abusos. A extensão não envia esse ID quando você abre um vídeo ou lê os comentários. Ele não é derivado da
sua conta do Google ou do YouTube nem vinculado a ela, mas a Mozilla classifica identificadores persistentes como dados
pessoais. O ID permite que o serviço associe os votos enviados à mesma instalação da extensão.

### Quais informações vocês têm, exatamente?

- Nas consultas à contagem de “Não gostei”, a API recebe o ID do vídeo atual e, quando disponível, o número de votos de
  “Gostei” exibido no vídeo.
- No registro e no envio de votos, os dados incluem o ID aleatório de usuário da extensão, o ID do vídeo, o voto escolhido,
  a data e a hora.
- Quando você reage a um comentário do RYD, a API recebe o mesmo ID aleatório, o ID do comentário e a reação.
  Os comentários e as respostas que membros conectados publicam no RYD são públicos e ficam armazenados com o apelido
  de quem os publicou.

A API também recebe seu endereço IP. O endereço original fica na memória RAM. Para controlar abusos, armazenamos seu hash.

Quando você escolhe entrar pelo Patreon ou pelo GitHub, os recursos premium opcionais usam os dados fornecidos no login.
São eles o ID da conta, o nome, o endereço de e-mail, a imagem de perfil, as informações de assinatura e o token de sessão
do serviço. Na versão 4.1.0 da extensão e na versão correspondente do backend, o serviço determina o acesso pelo Patreon
a partir dos IDs dos níveis da assinatura aos quais você tem direito no momento. Quando necessário, considera também
o valor atual que dá direito aos benefícios e se a assinatura é mensal ou anual. A extensão não recebe esses campos de
valor e periodicidade nem dados de cartão de pagamento ou de conta bancária.

### Como meu IP é armazenado?

Os endereços IP originais ficam na memória RAM. Armazenamos seus hashes. Essas informações são usadas para prevenir
abusos e para análises agregadas. Elas não são vendidas nem usadas para publicidade.

### Como funciona o login com OAuth? Ele dá acesso à minha conta do YouTube?

O login para acessar as análises premium é opcional e só começa depois que o usuário escolhe entrar pelo Patreon ou
pelo GitHub na extensão. O fluxo OAuth retorna dados da conta e um token de sessão do Return YouTube Dislike usado para
autenticar requisições à API premium. Na versão 4.1.0 da extensão e na versão correspondente do backend, o serviço
verifica o acesso pelo Patreon com base nos IDs dos níveis da assinatura aos quais você tem direito no momento. Quando
necessário, também considera o valor atual que dá direito aos benefícios e a periodicidade da assinatura. O serviço não
solicita datas nem status de cobranças, o total pago ao longo do tempo ou o status de apoiador.

O Firefox solicita as permissões opcionais “Informações de autenticação” e “Informações de identificação pessoal” antes
do início do tráfego de dados da conta. Sair da conta remove os dados da conta e a sessão armazenados na extensão. Revogar
a permissão de dados de autenticação do Firefox também limpa a sessão da conta e bloqueia novas comunicações da conta
até que você dê seu consentimento e faça login novamente. Quando ativada, a sincronização do navegador pode sincronizar
o identificador da instalação, as configurações e a sessão da conta.

### Posso confiar na contagem de “Não gostei”?

Adotamos medidas para impedir ataques de bots e continuaremos a aperfeiçoá-las. Isso ajuda a manter a estimativa de
votos de “Não gostei” próxima da contagem real. Ela nunca será 100% exata. Cabe a você decidir se confia na estimativa.

### Por que vocês não compartilham o código do backend?

Vamos compartilhá-lo em algum momento, mas não há um motivo real para fazer isso agora. Compartilhar o código dá uma
falsa sensação de segurança, porque, em um sistema de confiança zero, poderíamos divulgar uma versão e colocar outra em
produção. Há muitos motivos para manter o código fechado, especialmente a forma como combatemos spam. Ocultar ou
ofuscar o código que lida com spam é uma prática bastante comum.
