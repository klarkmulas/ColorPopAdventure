# DealHunter AI V1.6 — Web Scanner

Questa versione usa una pagina statica (`v16.html`) e un backend Cloudflare Worker (`worker-v16.js`). Non richiede Python o installazioni sul PC.

## Cosa fa
- Cerca sul web prodotti monitorati usando Brave Search API con targeting Italia/italiano.
- Apre solo URL prodotto precisi, non pagine di ricerca generiche.
- Prova a leggere prezzo e disponibilità da JSON-LD / metadata della pagina prodotto.
- Se eBay API è configurata, usa gli annunci attivi eBay Italia come riferimento di mercato e può includere annunci eBay specifici sottoprezzati.
- Calcola lato browser target di rivendita eBay/Subito, utile stimato, ROI e Deal Score.
- Amazon non viene simulato: richiede integrazione Creators API dedicata.
- Subito viene usato come canale di rivendita/stima, senza scraping automatico.

## Setup solo da browser
1. Crea un account Cloudflare e vai in Workers & Pages.
2. Crea un Worker nuovo e sostituisci il codice con `worker-v16.js`.
3. In Settings > Variables and Secrets crea:
   - `BRAVE_API_KEY` — obbligatoria.
   - `SCANNER_KEY` — obbligatoria; scegli una password lunga casuale.
   - `EBAY_CLIENT_ID` — opzionale ma consigliata.
   - `EBAY_CLIENT_SECRET` — opzionale ma consigliata.
4. Pubblica il Worker e copia l'URL `https://....workers.dev`.
5. Apri `v16.html`, entra in Impostazioni e inserisci:
   - URL Cloudflare Worker.
   - la stessa `SCANNER_KEY`.
6. Vai su Monitorati, scegli fino a 6 prodotti per scansione e premi `Scansiona web`.

## Sicurezza
Le chiavi Brave/eBay non devono essere inserite nella pagina HTML o nel repository pubblico. Restano nei Secret del Worker. La `SCANNER_KEY` serve a evitare che chi conosce l'URL del Worker consumi le tue API.

## Limiti intenzionali
"Tutto il web" significa copertura dell'indice web e delle fonti/API compatibili, non ogni singolo sito esistente. Alcuni retailer impediscono accessi automatici o non pubblicano prezzi in formato strutturato; tali risultati vengono esclusi invece di inventare dati.
