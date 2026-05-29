# parse/ — Lane D

Read raw captured responses from `../data/raw/`, walk the X GraphQL JSON, and
emit clean records to `../data/<account>.jsonl`.

Record shape (draft — frozen after Lane B confirms real field paths):

```json
{ "id": "", "created_at": "", "author": "", "text": "", "likes": 0, "retweets": 0, "replies": 0, "is_retweet": false, "url": "" }
```

- Input: `data/raw/*.json` + field map from Lane B.
- Output: `data/gavinbaker.jsonl`, deduped by tweet id.

_Not implemented yet._
