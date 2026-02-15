"""
Script one-time pour traduire les descriptions des indicateurs BM de l'anglais au français.
Sauvegarde les traductions dans un fichier JSON cache.
Usage: python translate_descriptions.py
"""
import pandas as pd
import json
import os
import time
from deep_translator import GoogleTranslator

EXCEL_PATH = os.path.join(os.path.dirname(__file__), 'data.xlsx')
CACHE_PATH = os.path.join(os.path.dirname(__file__), 'descriptions_fr_cache.json')

def clean_text(text):
    """Remove common prefixes."""
    if not text:
        return ''
    clean = text.strip()
    for prefix in ['Methodology:', 'Méthodologie:', 'Definition:', 'Définition:']:
        if clean.lower().startswith(prefix.lower()):
            clean = clean[len(prefix):].strip()
            break
    return clean

def first_sentence(text, max_len=150):
    """Extract first sentence, truncated to max_len."""
    for sep in ['. ', '.\n', '\n']:
        if sep in text:
            text = text[:text.index(sep) + 1]
            break
    if len(text) > max_len:
        text = text[:max_len - 3] + '...'
    return text

def main():
    # Load existing cache
    cache = {}
    if os.path.exists(CACHE_PATH):
        with open(CACHE_PATH, 'r', encoding='utf-8') as f:
            cache = json.load(f)
        print(f"Cache existant: {len(cache)} traductions")

    # Load Excel
    df = pd.read_excel(EXCEL_PATH, sheet_name='Data')
    print(f"Indicateurs: {len(df)}")

    translator = GoogleTranslator(source='en', target='fr')

    # Collect items to translate — use Définition column
    to_translate = []
    for _, row in df.iterrows():
        code = str(row.get('Series Code', ''))
        definition = row.get('Définition', '')
        if pd.isna(code) or pd.isna(definition) or not str(definition).strip():
            continue
        desc_en = clean_text(str(definition))
        if not desc_en:
            continue
        if code in cache and cache[code].get('full_fr'):
            continue
        to_translate.append((code, desc_en))

    print(f"À traduire: {len(to_translate)}")
    if not to_translate:
        print("Rien à traduire!")
        return

    # Translate individually (reliable, avoids char limit issues)
    translated_count = 0
    errors = 0
    for i, (code, desc_en) in enumerate(to_translate):
        try:
            # Full text (max 500 chars for detail page)
            full_text = desc_en[:500]
            full_fr = translator.translate(full_text)
            
            # Short text for cards
            short_fr = first_sentence(full_fr, 150)
            
            cache[code] = {
                'short_fr': short_fr,
                'full_fr': full_fr,
                'en': full_text
            }
            translated_count += 1
            
            if (translated_count) % 25 == 0:
                print(f"  {translated_count}/{len(to_translate)} traduits...")
                # Save checkpoint
                with open(CACHE_PATH, 'w', encoding='utf-8') as f:
                    json.dump(cache, f, ensure_ascii=False, indent=2)
            
            # Small delay to be nice to Google
            time.sleep(0.3)
            
        except Exception as e:
            errors += 1
            print(f"  Erreur {code}: {e}")
            if errors > 10:
                print("  Trop d'erreurs, pause de 30s...")
                # Save what we have
                with open(CACHE_PATH, 'w', encoding='utf-8') as f:
                    json.dump(cache, f, ensure_ascii=False, indent=2)
                time.sleep(30)
                errors = 0

    # Final save
    with open(CACHE_PATH, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

    print(f"\nTerminé! {translated_count} traductions")
    print(f"Total cache: {len(cache)}")

if __name__ == '__main__':
    main()
