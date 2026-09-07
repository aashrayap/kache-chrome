# parse/

Read raw captured responses from `../data/raw/`, normalize them through the
selected adapter, and emit records to `../data/<subject>.jsonl`.

The X adapter emits this record shape:

```json
{ "id": "", "created_at": "", "author": "", "text": "", "likes": 0, "retweets": 0, "replies": 0, "quotes": 0, "is_retweet": false, "url": "" }
```

- Input: `data/raw/*.json` and the existing output, if present.
- Output: `data/<subject>.jsonl`, deduplicated by record ID and filtered to the
  subject's records unless `ALL=1`.

Reruns add newly discovered IDs; existing IDs keep their previously stored
values. Invalid JSON or missing, blank, or non-string IDs in existing history
stop the run without replacing that file. Successful runs replace the output
atomically with owner-only permissions. The Reddit adapter's parser remains a
placeholder and emits no records.
