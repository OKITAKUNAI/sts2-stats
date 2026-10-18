"""テスト用データを作る。

sample-runs/（実データ。GitHubには上げない）から、いろいろな場面を含むランを選んで
test-data/ にコピーする。その際、協力プレイのSteamID（17桁）を架空の値に置き換える。

使い方（このフォルダで実行）：
    python tools/make_test_data.py

・sample-runs/ のファイルは読むだけで、書き換えない
・Python に最初から入っている機能だけを使う（追加のインストールは不要）
"""
import json
import pathlib
import re
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'sample-runs'
DEST = ROOT / 'test-data'
FAKE_BASE = 76500000000000000  # 架空のSteamID（17桁）。001, 002 … と順に割り当てる
BIG_INT = re.compile(r'(?<![\d."])(\d{16,})(?![\d."])')


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def points(run):
    return [m for act in run['map_point_history'] for m in act]


def pick_runs(runs):
    """場面ごとに数件ずつ選ぶ（同じランは1回だけ）。"""
    chosen = {}

    def take(label, cond, n):
        hits = [name for name, r in runs if cond(r) and name not in chosen]
        for name in hits[:n]:
            chosen[name] = label

    single = lambda r: len(r['players']) == 1
    # 記録の形式（schema_version）ごとに、新しい方から数件ずつ
    for sv in sorted({r.get('schema_version') for _, r in runs}):
        hits = [name for name, r in reversed(runs) if r.get('schema_version') == sv and not r['was_abandoned'] and name not in chosen]
        for name in hits[:3]:
            chosen[name] = f'形式 schema {sv}（新しい方から）'
    take('シングル勝利', lambda r: single(r) and r['win'], 4)
    take('シングル敗北（3章まで）', lambda r: single(r) and not r['win'] and not r['was_abandoned'] and len(r['map_point_history']) == 3, 4)
    take('シングル敗北（1章）', lambda r: single(r) and not r['was_abandoned'] and len(r['map_point_history']) == 1, 3)
    take('ネオーで放棄', lambda r: r['was_abandoned'] and len(points(r)) <= 1, 1)
    take('途中で放棄', lambda r: r['was_abandoned'] and len(points(r)) > 1, 1)
    take('イベント戦闘で死亡', lambda r: r['killed_by_encounter'] == 'NONE.NONE' and r['killed_by_event'] != 'NONE.NONE' and not r['was_abandoned'], 1)
    take('3章ボス2連戦', lambda r: len(r['map_point_history']) == 3 and sum(m['map_point_type'] == 'boss' for m in r['map_point_history'][2]) == 2, 2)
    take('イベントから戦闘', lambda r: any(len(m['rooms']) > 1 for m in points(r)), 1)
    take('プレイ時間3時間超', lambda r: r['run_time'] > 3 * 3600, 1)
    take('協力2人・勝利', lambda r: len(r['players']) == 2 and r['win'], 3)
    take('協力2人・敗北', lambda r: len(r['players']) == 2 and not r['win'], 3)
    take('協力3人', lambda r: len(r['players']) == 3, 2)
    for name, r in runs:  # キャラごとに最低1件
        chars = {p['character'] for p in r['players']}
        have = {c for n, rr in runs if n in chosen for p in rr['players'] for c in [p['character']]}
        if single(r) and not chars <= have:
            chosen[name] = 'キャラの補充'
    return chosen


def main():
    if not SRC.is_dir():
        sys.exit(f'{SRC} がありません。')
    runs = [(p.name, load(p)) for p in sorted(SRC.glob('*.run'))]
    chosen = pick_runs(runs)

    # 実際のID → 架空のID（同じIDは全ファイルで同じ架空IDにする。登場回数の多い順に001から）
    counts = {}
    for name, r in runs:
        if name in chosen:
            for p in r['players']:
                if len(str(p['id'])) >= 16:
                    counts[str(p['id'])] = counts.get(str(p['id']), 0) + 1
    mapping = {real: str(FAKE_BASE + i + 1) for i, (real, _) in enumerate(sorted(counts.items(), key=lambda x: -x[1]))}

    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir()
    for name in sorted(chosen):
        text = (SRC / name).read_text(encoding='utf-8')

        def repl(m):
            v = m.group(1)
            if v not in mapping:
                sys.exit(f'{name}：置き換え表に無い16桁以上の数値があったので中止しました。')
            return mapping[v]

        out = BIG_INT.sub(repl, text)
        if any(real in out for real in mapping):
            sys.exit(f'{name}：実際のIDが残っていたので中止しました。')
        (DEST / name).write_text(out, encoding='utf-8', newline='')

    # .run.backup のスキップ確認用に1件だけ用意する（中身は .run と同じ）
    first = sorted(chosen)[0]
    shutil.copyfile(DEST / first, DEST / (first + '.backup'))

    by_label = {}
    for name, label in chosen.items():
        by_label[label] = by_label.get(label, 0) + 1
    print(f'test-data/ に .run を {len(chosen)} 件、.run.backup を 1 件作りました。')
    for label, n in by_label.items():
        print(f'  {label}：{n}件')
    print(f'置き換えたSteamID：{len(mapping)} 種類（{FAKE_BASE + 1} から順に割り当て）')


if __name__ == '__main__':
    main()
