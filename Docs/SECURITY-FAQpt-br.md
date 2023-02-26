Leia isso em outros idiomas: [русский](SECURITY-FAQru.md), [Nederlands](SECURITY_FAQnl.md), [Français](SECURITY-FAQfr.md), [Türkçe](SECURITY-FAQtr.md), [українська](SECURITY-FAQuk.md)


# Segurança

### Vocês estão rastreando meu histórico de visualização?

Não. O código da extensão é público e você pode vê-lo por si mesmo. A única informação sendo enviada é o ID do vídeo, que é necessário para buscar a contagem de dislikes nos vídeos. Não há cabeçalhos adicionais sendo enviados. Sobre a camada de comunicação, seu IP público será exposto ao servidor, assim como a hora em que a solicitação foi feita. No entanto, nada disso está identificando você de forma única. Supondo um ambiente de zero confiança, o melhor que poderíamos obter é um IP dinâmico. Que hoje é seu, amanhã é do seu vizinho. Se você está realmente preocupado com o rastreamento do seu IP, provavelmente já usa uma VPN.

### Vocês podem me identificar de forma única se eu der um dislike?

Sim. Quando você dá dislike em um vídeo, criamos um ID único gerado aleatoriamente para você que não está vinculado à sua conta do Google. Isso é feito para evitar bots. Mas não há maneira de vincular esse ID aleatório a você ou à sua conta pessoal do YouTube.

### Que informações vocês têm, exatamente?

Apenas o ID do vídeo. Não seus comentários, não seu nome de usuário, não com quem você compartilhou o vídeo, não qualquer metadado adicional. Nada. Apenas o ID do vídeo.

### Como meu IP é armazenado?

O backend mantém os endereços IP sem hash apenas na memória volátil (RAM). Esses endereços não são armazenados em um disco rígido e, portanto, não são registrados. Fazemos os hashs dos endereços IP e isso que é armazenado. Isso é feito para evitar a vandalização do banco de dados.

### Ouvi uma discussão sobre OAuth e acesso à minha conta do YouTube!

Essa funcionalidade será opcional e completamente voluntária. Se você é um criador de conteúdo do YouTube e deseja compartilhar suas estatísticas de dislikes conosco, poderá fazê-lo. A maneira como o [OAuth](https://pt.wikipedia.org/wiki/OAuth#:~:text=mas%2C%20sem%20expor%20credenciais%20de%20autentica%C3%A7%C3%A3o%2C%20como%20senhas.) foi estruturado é na verdade muito segura. Você pode revogar o acesso à sua conta a qualquer momento e pode nos dar permissões muito específicas. Não solicitaremos nenhuma permissão que não seja necessária. Apenas solicitaremos permissões para visualizar as estatísticas do seu vídeo.

### Como posso confiar na contagem de dislikes?

Implementamos medidas para evitar ataques de bots e continuaremos trabalhando para melhorar a eficácia do sistema de prevenção de bots: isso nos ajudará a manter a contagem de dislikes como um bom representatativo da contagem real. Claro que nunca será 100% preciso, então cabe a você decidir se confia na contagem ou não.

### Por que vocês não compartilham o código do backend?

Compartilharemos em algum momento - mas realmente não há motivo real para compartilhá-lo agora. Isso dá uma falsa sensação de segurança - porque em um sistema de zero confiança, poderíamos muito bem divulgar uma versão, mas implantar outra. Há muitas razões para manter o código oculto, especialmente como lidamos com spam. Esconder/obscurecer o código de tratamento de spam é uma prática bastante padrão.
