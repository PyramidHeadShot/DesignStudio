#!/usr/bin/env python3
"""Поиск лимита провайдера по числу изображений в запросе (openai-completions).

Воспроизводит ошибку 400 INVALID_REQUEST наращиванием числа картинок до
нахождения границы "N -> 200, N+1 -> 400". Использует реальные PNG из
указанной сессии pi (переиспользуя по кругу) либо явные файлы --image.
Отказы провайдера (4xx) не тарифицируются; успешные ответы просят 1 токен.

Запуск:
    python probe_image_limit.py --session path/to/session.jsonl
    python probe_image_limit.py --image shot1.png --image shot2.png \
        --provider provod --model mimo-v2.6-pro
"""
import argparse
import base64
import json
import pathlib
import sys
import urllib.error
import urllib.request

DEFAULT_MODELS_JSON = pathlib.Path.home() / ".pi" / "agent" / "models.json"


def load_provider(models_json, provider):
    cfg = json.loads(models_json.read_text(encoding="utf-8"))
    try:
        pv = cfg["providers"][provider]
    except KeyError:
        print(f"провайдер {provider!r} не найден в {models_json}")
        sys.exit(1)
    return pv


def images_from_session(path):
    imgs = []
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        content = rec.get("message", {}).get("content")
        if isinstance(content, list):
            for part in content:
                if part.get("type") == "image" and part.get("data"):
                    imgs.append(part["data"])
    return imgs


def images_from_files(paths):
    out = []
    for p in paths:
        raw = pathlib.Path(p).read_bytes()
        out.append(base64.b64encode(raw).decode())
    return out


def ask(base_url, key, model, imgs_n, pool, max_tokens_field):
    content = [{"type": "text", "text": "Reply with the single character 'k'."}]
    for i in range(imgs_n):
        content.append({"type": "image_url",
                        "image_url": {"url": "data:image/png;base64," + pool[i % len(pool)]}})
    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": content}],
        max_tokens_field: 1,
    }).encode()
    req = urllib.request.Request(
        base_url + "/chat/completions", data=body,
        headers={"Authorization": "Bearer " + key,
                 "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120):
            return 200
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:
        print(f"  сетевая ошибка: {e}")
        return 0


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--session", help="jsonl-сессия pi: взять из неё PNG")
    ap.add_argument("--image", action="append", default=[],
                    help="PNG-файл (можно несколько раз)")
    ap.add_argument("--provider", default="provod")
    ap.add_argument("--model", default="mimo-v2.6-pro")
    ap.add_argument("--models-json", default=str(DEFAULT_MODELS_JSON))
    ap.add_argument("--max", type=int, default=12,
                    help="верхняя граница перебора (по умолчанию 12)")
    args = ap.parse_args()

    pool = (images_from_session(args.session) if args.session
            else images_from_files(args.image))
    if not pool:
        print("не найдено ни одного изображения (--session или --image)")
        sys.exit(1)

    pv = load_provider(pathlib.Path(args.models_json), args.provider)
    base_url, key = pv["baseUrl"], pv["apiKey"]
    max_field = pv.get("compat", {}).get("maxTokensField") or "max_tokens"
    print(f"Провайдер: {args.provider} ({base_url}), модель: {args.model}")
    print(f"Пул картинок: {len(pool)} шт., перебор до {args.max}\n")

    # бинарный поиск границы: работает до n_lo включительно, от n_hi - нет
    lo, hi = 1, args.max
    results = {}
    while lo < hi:
        mid = (lo + hi + 1) // 2
        code = ask(base_url, key, args.model, mid, pool, max_field)
        results[mid] = code
        print(f"  {mid} изображ. -> {code}")
        if code == 200:
            lo = mid
        else:
            hi = mid - 1
    if lo == 1 and 1 not in results:
        code = ask(base_url, key, args.model, 1, pool, max_field)
        results[1] = code
        print(f"  1 изображ. -> {code}")
        if code != 200:
            print("\nДаже 1 изображение отвергается: проблема НЕ в количестве "
                  "(битый PNG / размер тела / другая валидация).")
            sys.exit(2)

    print(f"\nИТОГ: {args.provider}/{args.model} принимает до {lo} изображений "
          f"на запрос ({lo + 1}-е даёт 400).")
    print("Занеси результат в таблицу лимитов в SKILL.md!")


if __name__ == "__main__":
    main()