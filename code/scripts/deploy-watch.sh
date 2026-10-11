#!/bin/zsh
# Theo dõi tiến trình deploy cho Monitor của Claude Code (mỗi dòng in ra = một thông báo):
# "found N files", từng pha (băm / thêm vào version / tải), "uploading new files [x/y] (p%)" mỗi khi tăng ≥5%,
# các mốc hoàn tất, lỗi tải HTTP (firebase-tools tự thử lại), mọi dòng lỗi, rồi kết quả kiểm bản live + dòng
# "số liệu". TỰ THOÁT ở dòng "số liệu" (0, hoặc 1 nếu kiểm live lệch), khi firebase báo Error: (1) hoặc khi
# scripts/deploy.sh đã dừng mà chưa xong (1) — khác `tail -f`, không treo tới hết hạn Monitor.
# Dòng debug của firebase-tools (deploy.sh chạy với DEBUG để đo thử lại/lỗi; mở đầu "[2026-…Z]") bị bỏ qua.
#
#   scripts/deploy.sh          (Bash, chạy nền)
#   scripts/deploy-watch.sh    (Monitor, timeout tối đa — hết hạn mà chưa xong thì bật lại)
#
# Chỉ đọc log ghi trong lúc này (ngày sửa ≥ lúc bắt đầu theo dõi − 5 giây), nên bật trước hay sau deploy.sh đều được.
cd "$(dirname "$0")/.."
exec perl - <<'PERL'
use strict;
use warnings;
$| = 1;
my $f = "scripts/.deploy.log";
my $t0 = time;
my ($last, $phase, $ino, $idle) = (-5, "", 0, 0);
my ($http, $done, $bad) = (0, 0, 0);

# deploy.sh (build + deploy) còn chạy không — gọi pgrep không qua shell (shell bọc ngoài sẽ khớp chính mẫu)
sub running { system("pgrep", "-q", "-f", "scripts/deploy.sh") == 0 }

sub handle {
  local $_ = shift;
  s/\e\[[0-9;]*m//g;
  s/\r//g;
  if (/^\[\d{4}-\d\d-\d\dT[^\]]*\] /) {    # dòng debug: chỉ báo lỗi HTTP khi tải (vài lần đầu, rồi mỗi 50 lần)
    if (/HTTP ERROR (\d+)/) { $http++; print "⚠ tải lỗi HTTP $1 (lần $http — firebase-tools tự thử lại)\n" if $http <= 3 || $http % 50 == 0 }
    return;
  }
  if (/found (\d+) files/) { print "📦 found $1 files\n"; return }
  if (/uploading new files \[(\d+)\/(\d+)\] \((\d+)%\)/) {
    if ($phase ne "upload") { $phase = "upload"; print "▸ bắt đầu tải: $2 file mới\n" }
    if ($3 >= $last + 5) { $last = $3; print "⬆️ uploading new files [$1/$2] ($3%)\n" }
    return;
  }
  if (/(hashing files|adding files to version) \[/) { if ($phase ne $1) { $phase = $1; print "▸ $1…\n" } return }
  if (/upload complete|version finalized|release complete/) { print "✔ $_"; return }
  if (/Deploy complete/) { $done = 1; print "✅ Deploy complete — đang kiểm bản live…\n"; return }
  if (/^(?:✓|✗) kiểm live/) { $bad = 1 if /^✗/; print; return }
  if (/^\s*số liệu:/) { print; exit($bad ? 1 : 0) }
  if (/^\s*Error:/) { print "❌ $_"; exit 1 }
  print "❌ $_" if /error|failed|exceeded|quota|\b429\b|unexpected/i;
}

# chờ log của lần deploy này (deploy.sh build xong mới ghi log)
my $waited = 0;
until (-f $f && (stat $f)[9] >= $t0 - 5) {
  sleep 1;
  if (++$waited % 10 == 0 && !running()) { print "✗ không thấy scripts/deploy.sh đang chạy (build lỗi?) — xem đầu ra của nó\n"; exit 1 }
}
open(my $fh, "<", $f) or die "✗ không mở được $f\n";
$ino = (stat $fh)[1];

while (1) {
  my $got = 0;
  while (my $l = <$fh>) { handle($l); $got = 1 }
  $idle = $got ? 0 : $idle + 1;
  if ($idle >= 15 && !running()) {
    exit 0 if $done;    # deploy.sh cũ (không ghi kết quả kiểm live vào log)
    print "✗ deploy.sh đã dừng mà chưa thấy Deploy complete — xem scripts/.deploy.log\n"; exit 1;
  }
  sleep 1;
  my @s = stat $f;
  if (@s && ($s[1] != $ino || $s[7] < tell $fh)) {    # log bị ghi lại từ đầu → đọc lại
    close $fh;
    open($fh, "<", $f) or next;
    $ino = (stat $fh)[1];
  }
  seek($fh, 0, 1);    # xoá cờ EOF để đọc tiếp phần mới ghi
}
PERL
