# hybrid-search-decay

## Что это

Форк `obsidian-hybrid-search` (апстрим: https://github.com/flowing-abyss/obsidian-hybrid-search), развёрнутый под личным аккаунтом `triojohn`. Репозиторий: https://github.com/triojohn/hybrid-search-decay

## Кто и зачем

Владелец форка — `triojohn`. Апстрим ранжирует результаты чистым RRF по рангам четырёх каналов (vector, BM25, exact alias, partial fuzzy) и не имеет сигнала свежести: `notes.mtime` хранится, но используется только для переиндексации. Из-за этого:

- BM25 монотонно падает с длиной файла, поэтому растущие заметки (например, периодические отчёты) теряют балл;
- заметка, найденная двумя каналами, получает ~2× балла заметки с одним каналом;
- свежие версии документа не поднимаются выше устаревших.

Цель форка — добавить устаревание/свежесть (recency/decay) в ранжирование. На момент создания форка канал не реализован.

## Ограничения

- Имена бинарей (`obsidian-hybrid-search`, `ohs`, `obsidian-hybrid-search-mcp`) НЕ меняются: стоковый плагин Obsidian ищет их в PATH по этим именам.
- Плагин Obsidian (UI) не форкается — остаётся стоковым.
- В npm не публикуется.

## Источник
- Реальный путь репозитория: `C:\GitHub\hybrid-search-decay`
- Этот файл: `C:\GitHub\hybrid-search-decay\PROJECT.md`
- Зеркало в vault: `10-projects/hybrid-search-decay/PROJECT.md`
