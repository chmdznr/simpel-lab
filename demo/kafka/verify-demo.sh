#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
dc=(docker compose -f demo/kafka/docker-compose.yml -p simpel-kafka-demo)
topic="simpel-demo-$(date +%s)-$$"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
"${dc[@]}" exec -T kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic "$topic" --partitions 1 --replication-factor 1
printf '%s\n' '{"event":"pengajuan.diterima","pengajuanId":"SIM-001"}' '{"event":"pengajuan.valid","pengajuanId":"SIM-001"}' '{"event":"billing.terbit","pengajuanId":"SIM-001"}' > "$tmp/expected"
"${dc[@]}" exec -T kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic "$topic" < "$tmp/expected"
for group in a b; do
  "${dc[@]}" exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic "$topic" --group "$topic-$group" --from-beginning --max-messages 3 --timeout-ms 20000 > "$tmp/$group"
  diff -u "$tmp/expected" "$tmp/$group"
  printf 'Group %s membaca tiga event:\n' "$group"
  cat "$tmp/$group"
done
printf 'PASS: kedua group membaca ulang tiga record yang sama, berurutan dalam satu partition.\n'
