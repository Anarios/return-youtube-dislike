[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Διαθέσιμο στις παρακάτω γλώσσες: [English](README.md), [русский](READMEru.md), [Español](READMEes.md), [Nederlands](READMEnl.md), [Français](READMEfr.md), [日本語](READMEja.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Deutsch](READMEde.md), [Svenska](READMEsv.md), [中文](READMEcn.md), [Polski](READMEpl.md)

# Return YouTube Dislike

<p align="center">
    <b>Το Return YouTube Dislike είναι μια επέκταση ανοιχτού κώδικα η οποία επαναφέρει τον μετρητή dislike στο YouTube.</b><br>
    Είναι διαθέσιμο για Chrome και Firefox ως πρόσθετη επέκταση.<br>
    Επίσης είναι διαθέσιμο και σε άλλους φυλλομετρητές ως JS Userscript.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## Ιστορικό

Στις 10 Νοεμβρίου 2021, η Google [ανακοίνωσε](https://blog.youtube/news-and-events/update-to-youtube/) ότι θα αφαιρέσει τον μετρητή dislike απο το YouTube.

Ακολούθως, στις 13 Δεκεμβρίου 2021 [αφαιρέθηκε](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) το πεδίο `dislike` και απο το YouTube API, στερώντας κάθε δυνατότητα να κρίνουμε την ποιότητα του περιεχομένου πριν από την παρακολούθηση.

## Πώς λειτουργεί

Έπειτα απο την αφάιρεση των στατιστικών dislike απο το YouTube API, το backend μας άλλαξε ώστε να χρησιμοποιεί ένα συνδυασμό συλλογής στατιστικών, και εκτιμήσεων με βάση τα δεδομένα χρήσης της επέκτασης.

[Συχνές Ερωτήσεις](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## Γιατί έχει σημασία

Μπορείτε να μάθετε περισσότερα στην ιστοσελίδα μας: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## Τεκμηρίωση του API

Η χρήση απο τρίτους αυτού του ανοιχτού API επιτρέπεται με τους παρακάτω περιορισμούς:

- **Αναφορά**: Να υπάρχει καθαρή αναφορά στον κώδικα αυτού του έργου με την χρήση του παρακάτω συνδέσμου [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Όριο Χρήσης**: Υπάρχει όριο χρήσης ανα χρήστη το οποίο είναι 100 το λεπτό και 10000 την μέρα. Σε αντίθετη περίπτωση επιστρέφεται μύνημα λάθους _429_ υποδυκνύοντας οτι η εφαρμογή του χρήστη θα πρέπει να περιορίσει την χρήση της.

Το API είναι διαθέσιμο στον παρακάτω σύνδεσμο:  
https://returnyoutubedislikeapi.com

Λίστα με τα διαθέσιμα endpoints μπορείτε να βρείτε εδώ:  
https://returnyoutubedislikeapi.com/swagger/index.html

### Λήψη ψήφων

Παράδειγμα ώστε να αντλήσετε τις ψήφους από συγκεκριμένο YouTube video ID:  
`/votes?videoId=kxOuG8jMIgI`

```json
{
  "id": "kxOuG8jMIgI",
  "dateCreated": "2021-12-20T12:25:54.418014Z",
  "likes": 27326,
  "dislikes": 498153,
  "rating": 1.212014408444885,
  "viewCount": 3149885,
  "deleted": false
}
```

Μή διαθέσιμο YouTube ID θα επιστρέψει κωδικό status _404_ "Not Found".  
Λάνθασμένη δομή YouTube ID θα επιστρέψει _400_ "Bad Request".

<!---
## API documentation

You can view all documentation on our website.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## Συνεισφορά

Παρακαλώ διαβάστε τον [οδηγό συνεισφοράς](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTING.md).

## Υποστηρίξτε αυτό το project!

Μπορείτε να υποστηρίξετε αυτό το έργο κάνοντας δωρεά προς εμάς στον παρακάτω σύνδεσμο:

[Δωρεά](https://returnyoutubedislike.com/donate)

## Χορηγοί

[Piepacker](https://piepacker.com)

[Seed4.Me VPN](https://www.seed4.me/users/register?gift=ReturnYoutubeDislike)

[PocketTube](https://yousub.info/?utm_source=returnyoutubedislike)

[Γίνεται χορηγός μας](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
