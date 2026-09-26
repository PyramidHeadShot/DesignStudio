#!/usr/bin/env python3
"""Лечение зависшей сессии pi: замена старых изображений на текстовые плейсхолдеры.

Когда в истории копится больше картинок, чем принимает провайдер (например,
provod/mimo-v2.6-pro - максимум 4), каждый запрос падает с 400 INVALID_REQUEST.
Скрипт уменьшает число изображений до --keep последних, заменяя остальные
элементы {"type":"image"} коротким текстом. Идемпотентен. Делает бэкап.

Запуск:
    python strip_history_images.py path/to/session.jsonl --keep 2
    python strip_history_images.py path/to/session.jsonl --keep 0   # убрать все
"""
import argparse
import base64
import json
import pathlib
import shutil
import struct
import sys


def png_dims(data_b64):
    try:
        raw = base64.b64decode(data_b64)
        if raw[:8] == b"\x89PNG\r\n\x1a\n" and len(raw) >= 24:
            w, h = struct.unpack(">II", raw[16:24])
            return f"{w}x{h}", len(raw)
        return "?", len(raw)
    except Exception:
        return "?", 0


def backup_path(p: pathlib.Path) -> pathlib.Path:
    cand = p.with_suffix(p.suffix + ".bak")
    n = 1
    while cand.exists():
        cand = p.with_suffix(p.suffix + f".bak.{n}")
        n += 1
    return cand


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("session", help="jsonl-файл сессии pi")
    ap.add_argument("--keep", type=int, default=2,
                    help="сколько последних изображений оставить (по умолчанию 2)")
    ap.add_argument("--yes", action="store_true",
                    help="не спрашивать подтверждение")
    args = ap.parse_args()

    p = pathlib.Path(args.session)
    if not p.exists():
        print(f"нет файла: {p}")
        sys.exit(1)

    lines = p.read_text(encoding="utf-8").splitlines()

    # позиции (line_idx, part_idx) всех изображений в хронологии
    spots = []
    parsed = []
    for i, line in enumerate(lines):
        if not line.strip():
            parsed.append(None)
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            print(f"!! строка {i + 1} не парсится - файл повреждён, прерываюсь")
            sys.exit(2)
        parsed.append(rec)
        content = rec.get("message", {}).get("content")
        if isinstance(content, list):
            for j, part in enumerate(content):
                if part.get("type") == "image":
                    spots.append((i, j))

    keep = max(0, args.keep)
    to_strip = spots if len(spots) <= keep else spots[:-keep]
    kept = len(spots) - len(to_strip)
    print(f"Изображений в истории: {len(spots)}, к удалению: {len(to_strip)}, "
          f"остаётся: {kept}")

    if not to_strip:
        print("Стрипать нечего - сессия уже легче лимита.")
        return

    if not args.yes:
        ans = input("Сделать бэкап и перезаписать файл? [y/N] ").strip().lower()
        if ans not in ("y", "yes", "д", "да"):
            print("отменено")
            return

    strip_set = set(to_strip)
    n_bytes = 0
    for (i, j) in to_strip:
        part = parsed[i]["message"]["content"][j]
        dims, nbytes = png_dims(part.get("data", ""))
        n_bytes += nbytes
        parsed[i]["message"]["content"][j] = {
            "type": "text",
            "text": f"[image stripped to fit provider image limit: {dims}, "
                    f"{nbytes} bytes]",
        }

    bak = backup_path(p)
    shutil.copy2(p, bak)
    tmp = p.with_suffix(p.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        for rec in parsed:
            if rec is None:
                f.write("\n")
            else:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    tmp.replace(p)

    print(f"Готово: вырезано {len(strip_set)} изображений (~{n_bytes // 1024} КБ "
          f"бинарно), оставлено {kept}.")
    print(f"Бэкап: {bak}")
    print("Сессию можно продолжать - снова должна отвечать.")


if __name__ == "__main__":
    main()