Leia isso em outros idiomas: [русский](FAQru.md), [Français](FAQfr.md),  [Nederlands](FAQnl.md),[Türkçe](FAQtr.md), [українська](FAQuk.md)


# Perguntas Frequentes

## Antes de fazer uma pergunta no GitHub ou no Discord, consulte isto.

<br>

### **1. De onde vêm os dados dessa extensão?**

Uma combinação de APIs do Google e dados coletados por raspagem.

Nós salvamos todos os dados disponíveis em nosso banco de dados para que ficassem disponíveis após o Google desativar a contagem de dislikes em sua API.

<br>

### **2. A contagem de dislikes do vídeo não atualiza**

Atualmente, as dislikes dos vídeos são armazenados em cache e não são atualizadas com muita frequência. Uma vez a cada 2-3 dias, não mais frequentemente que isso.

Sim, não é ideal, mas é o que é. Estamos trabalhando para melhorar a frequência de atualização desses dados.

<br>

### **3. Como isso funciona?**

A extensão coleta o ID do vídeo que você está assistindo, busca os dislikes (e outros campos, como visualizações, curtidas etc.) usando nossa API. Se for a primeira vez que o vídeo é buscado por nossa API, ela usará a API do YouTube para obter os dados, em seguida, armazena os dados em um banco de dados para fins de cache (armazenado em cache por cerca de 2-3 dias) e arquivamento, e os retorna para você. A extensão então exibe os dislikes para você.

<br>

### **4. O que acontecerá quando a API do YouTube parar de retornar a contagem de dislikes?**

O backend passará a usar uma combinação de estatísticas de dislikes arquivadas, estimativas extrapoladas dos dados dos usuários da extensão e estimativas baseadas nas proporções de visualizações/likes para vídeos cujos dislikes não foram arquivadas e para arquivos de dislikes desatualizados.

<br>

### **5. Como a contagem de dislikes é calculada?**

O RYD usa os votos de seus usuários para extrapolar a contagem de dislikes.

- Se o vídeo foi carregado após o desligamento da API:

  $$ \textup{Contagem de Dislikes do RYD} = \left( \frac{\textup{Contagem de Dislikes dos Usuários do RYD}}{\textup{Contagem de Likes dos Usuários do RYD}} \right) \times \textup{Contagem de Likes Pública} $$

- Se o banco de dados do RYD de alguma forma tiver a contagem real de likes e dislikes (fornecida pelo carregador do vídeo ou do arquivo), a contagem de dislikes será calculada com base em ambos - os votos dos usuários e o valor arquivado. O valor arquivado terá menos influência na contagem final conforme envelhece.

<br>

---

Isso em forma de vídeo

[![Return YouTube Dislike Explained](https://yt-embed.live/embed?v=GSmmtv-0yYQ)](https://www.youtube.com/watch?v=GSmmtv-0yYQ)

---

<br>

## Eu tenho preocupações com segurança / privacidade

Veja [esta página](SECURITY-FAQpt-br.md) para mais informações.
