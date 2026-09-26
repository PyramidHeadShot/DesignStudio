#!/usr/bin/env python3
"""Инвентаризация изображений в jsonl-сессии pi (поиск причины 400 INVALID_REQUEST).

Показывает для каждого изображения: номер строки, размер base64, валидность PNG
(сигнатура + IEND), пиксели из IHDR, оценку vision-токенов, md5-дубликаты.
Дополнительно: первая ошибка модели и проверка парности toolCall/toolResult.

Запуск:
    python inspect_session.py <путь/к/сессии.jsonl>
"""
import base64
import hashlib
import json
import struct
import sys


def png_info(raw):
    """(ok_sig, ok_iend, width, height) по заголовкам PNG; None-ы при не-PNG."""
    if raw[:8] != b"\x89PNG\r\n\x1a\n":
        return False, False, None, None
    w = h = None
    if len(raw) >= 24 and raw[12:16] == b"IHDR":
        w, h = struct.unpack(">II", raw[16:24])
    # у нормального PNG IEND - последний чанк
    ok_iend = raw[-8:-4] == b"IEND"
    return True, ok_iend, w, h


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    path = sys.argv[1]

    images = []           # (line_idx, msg_id, role, tool, b64len, raw, md5)
    tool_calls = {}       # id -> (line_idx, name)
    tool_results = {}     # toolCallId -> (line_idx, name)
    first_error = None
    body_chars = 0

    with open(path, encoding="utf-8") as f:
        for idx, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            body_chars += len(line)
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                print(f"!! строка {idx}: не парсится как JSON (файл повреждён?)")
                continue
            msg = rec.get("message", {})
            role = msg.get("role", rec.get("type", "?"))
            content = msg.get("content")
            if isinstance(content, list):
                for part in content:
                    t = part.get("type")
                    if t == "image":
                        data = part.get("data", "")
                        try:
                            raw = base64.b64decode(data)
                        except Exception:
                            raw = b""
                        images.append((idx, rec.get("id"), role,
                                       msg.get("toolName"), len(data), raw,
                                       hashlib.md5(raw).hexdigest()[:12]))
                    elif t == "toolCall":
                        tool_calls[part.get("id")] = (idx, part.get("name"))
            if msg.get("toolCallId"):
                tool_results[msg["toolCallId"]] = (idx, msg.get("toolName"))
            if role == "assistant" and msg.get("stopReason") == "error":
                first_error = first_error or (idx, rec.get("id"),
                                              msg.get("errorMessage", ""))

    print(f"Файл: {path}")
    print(f"Символов в jsonl: {body_chars:,}".replace(",", " "))
    print(f"Изображений в истории: {len(images)}\n")

    if not images:
        print("Изображений нет - лимит по картинкам ни при чём.")
    print("Строка | b64    | PNG | IEND | пиксели    | ~vis.tok | md5        | роль/инструмент")
    seen = {}
    total_vtok = 0
    total_b64 = 0
    for (idx, mid, role, tool, blen, raw, md5) in images:
        ok_sig, ok_iend, w, h = png_info(raw)
        vtok = int(w * h / 750 + 850) if w else 0
        total_vtok += vtok
        total_b64 += blen
        dup = md5 in seen
        seen.setdefault(md5, idx)
        dims = f"{w}x{h}" if w else "?"
        print(f"{idx:>6} | {blen:>6} | {'ok' if ok_sig else 'BAD':>3} | "
              f"{('ok' if ok_iend else 'BAD'):>4} | {dims:>10} | {vtok:>8} | {md5} | "
              f"{role}/{tool}{'  [ДУБЛИКАТ строки %d]' % seen[md5] if dup else ''}")
    if images:
        print(f"\nИтого: base64 {total_b64:,} символов, ~{total_vtok} vision-токенов"
              .replace(",", " "))
        oversized = [_ for _ in images
                     if (png_info(_[5])[2] or 0) > 1568 or (png_info(_[5])[3] or 0) > 1568]
        print(f"Вылезают за 1568px по длинной стороне: {len(oversized)} шт. "
              f"(без inputLimits.images.resize в models.json такие кладутся "
              f"в историю как есть)")

    print("\n--- Первый stopReason: error ---")
    if first_error:
        idx, mid, errmsg = first_error
        print(f"строка {idx} (id {mid}): {errmsg[:300]}")
        n_before = sum(1 for im in images if im[0] < idx)
        print(f"Картинок в истории к моменту отказа: {n_before} "
              f"(лимиты типовых провайдеров: 4-10, у provod/mimo-v2.6-pro - 4)")
    else:
        print("ошибок stopReason: error не найдено")

    print("\n--- Парность toolCall / toolResult ---")
    orphans_res = [k for k in tool_results if k not in tool_calls]
    orphans_call = [k for k in tool_calls if k not in tool_results]
    if orphans_res:
        print(f"toolResult без toolCall (сломает запрос с 400): {len(orphans_res)}")
        for k in orphans_res[:5]:
            print(f"  {k} (строка {tool_results[k][0]})")
    if orphans_call:
        print(f"toolCall без toolResult (бесконечный цикл или обрыв): {len(orphans_call)}")
        for k in orphans_call[:5]:
            print(f"  {k} (строка {tool_calls[k][0]}, {tool_calls[k][1]})")
    if not orphans_res and not orphans_call:
        print(f"OK: {len(tool_calls)} пар, нарушений нет")


if __name__ == "__main__":
    main()