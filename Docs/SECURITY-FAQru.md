Прочитать на других языках: [English](SECURITY-FAQ.md), [Français](SECURITY-FAQfr.md), [Türkçe](SECURITY-FAQtr.md), [українська](SECURITY-FAQuk.md)

# Безопасность

### Вы отслеживаете мою историю просмотров?

Нет. Код расширения находится в открытом доступе, и вы можете ознакомиться с ним самостоятельно. Единственная передаваемая информация - это идентификатор видео, который необходим для получения данных о количестве просмотров видео. Никаких дополнительных заголовков не передаётся. На коммуникационном уровне серверу будет передан ваш публичный IP-адрес, а также время, когда был сделан запрос. Однако ничто из этого не идентифицирует вас каким-либо образом. Предполагая среду с нулевым доверием, лучшее, что мы можем получить, это динамический IP. Который сегодня ваш, а завтра - вашего соседа. Если вы действительно беспокоитесь о том, что ваш IP может быть отслежен, вы, вероятно, уже используете какой-нибудь VPN.

### Можете ли вы однозначно идентифицировать меня, если я оставил отметку «Не нравится»?

Да. Когда вы оставляете видео отметку «Не нравится», мы создаём для вас случайно созданный уникальный идентификатор, который не привязан к вашему аккаунту Google. Это делается для избежания ботов. Но нет никакого способа привязать этот случайный идентификатор к вам или вашему личному аккаунту YouTube.

### Какой именно информацией вы располагаете?

Только идентификатор видео. Ни ваших комментариев, ни вашего имени пользователя, ни того, с кем вы поделились видео, ни каких-либо дополнительных метаданных. Ничего. Только идентификатор видео.

### Как хранится мой IP-адрес?

Внутренняя часть нашего сервера хранит нехешированные IP-адреса только в энергозависимой памяти (ОЗУ). Эти адреса не хранятся на жёстком диске и поэтому не регистрируются. Мы хэшируем IP-адреса, и оно хранится вместо них. Это сделано для предотвращения вандализма в базе данных.

### Я слышал обсуждение OAuth и доступа к моему аккаунту на YouTube!

Эта функция будет необязательной и очень нужной. Если вы являетесь создателем YouTube и хотите поделиться с нами статистикой отметок «Не нравится», вы можете это сделать. По своей структуре [OAuth](<https://ru.wikipedia.org/wiki/OAuth#:~:text=%D0%B1%D0%B5%D0%B7%20%D0%BF%D0%B5%D1%80%D0%B5%D0%B4%D0%B0%D1%87%D0%B8%20%D0%B5%D0%B9%20(%D1%82%D1%80%D0%B5%D1%82%D1%8C%D0%B5%D0%B9%20%D1%81%D1%82%D0%BE%D1%80%D0%BE%D0%BD%D0%B5)%20%D0%BB%D0%BE%D0%B3%D0%B8%D0%BD%D0%B0%20%D0%B8%20%D0%BF%D0%B0%D1%80%D0%BE%D0%BB%D1%8F>) очень безопасен. Вы можете отозвать доступ к своему аккаунту в любое время, и можете дать нам ограниченные разрешения. Мы не будем запрашивать никаких разрешений, которые не требуются. Мы будем запрашивать разрешения только для просмотра статистики ваших видео.

### Как я могу доверять этому счётчику отметок «Не нравится»?

Мы приняли меры по предотвращению атак ботов и собираемся продолжать работать над повышением эффективности системы предотвращения ботов: это поможет нам сохранить подсчёт отметок «Не нравится» как хороший представитель фактического количества. Конечно, он никогда не будет точным на 100%, поэтому вы сами решаете, доверять ему или нет.

### Почему бы вам не поделиться кодом внутренней части своего сервера?

Мы поделимся им в какой-то момент - но сейчас нет никаких реальных причин делиться ею. Это даёт ложное чувство безопасности - ведь в системе с нулевым доверием мы можем с таким же успехом раскрыть одну версию, но развернуть другую. Есть много причин держать код в тайне, в частности, как мы боремся со спамом. Скрытие и запутывание кода обработки спама - это довольно стандартная практика.