```
for i in 1 2 3 4 5; do
  curl -s -X POST http://localhost:4001/iam/notify \
    -H 'Content-Type: application/json' \
    -d "{\"topic\":\"batch\",\"message\":\"Event $i of 5\"}"
  sleep 0.5
done
```
