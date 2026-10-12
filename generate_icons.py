#!/usr/bin/env python3
"""
Générateur d'icônes PWA pour CollecBox / ExLibris
Produit les icônes PNG 192x192, 512x512 et leurs variantes maskables.
"""
from PIL import Image, ImageDraw, ImageFont
import math
import os

def create_icon(size, is_maskable=False):
    # Image RGBA
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Dégradé de fond
    # Couleurs : Bleu électrique #3b82f6 (59, 130, 246) vers Indigo #4f46e5 (79, 70, 229)
    c1 = (59, 130, 246)
    c2 = (79, 70, 229)

    corner_radius = 0 if is_maskable else int(size * 0.22)
    
    # Créer un masque arrondi ou plein
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    if is_maskable:
        mask_draw.rectangle([0, 0, size, size], fill=255)
    else:
        mask_draw.rounded_rectangle([0, 0, size, size], radius=corner_radius, fill=255)

    # Remplissage par dégradé
    grad = Image.new('RGBA', (size, size))
    grad_draw = ImageDraw.Draw(grad)
    for y in range(size):
        ratio = y / float(size)
        r = int(c1[0] + (c2[0] - c1[0]) * ratio)
        g = int(c1[1] + (c2[1] - c1[1]) * ratio)
        b = int(c1[2] + (c2[2] - c1[2]) * ratio)
        grad_draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    img.paste(grad, (0, 0), mask)

    # Zone de contenu (safe area pour maskable : 80% du centre)
    scale = 0.65 if is_maskable else 0.75
    cx, cy = size // 2, size // 2
    r_outer = int((size * scale) // 2)

    icon_draw = ImageDraw.Draw(img)

    # Dessin d'un symbole stylisé : Vinyle + Étagère / Box
    # 1. Disque vinyle (cercle blanc semi-transparent avec sillons)
    icon_draw.ellipse(
        [cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer],
        fill=(255, 255, 255, 35),
        outline=(255, 255, 255, 220),
        width=max(2, size // 64)
    )

    # Sillon intermédiaire
    r_mid = int(r_outer * 0.72)
    icon_draw.ellipse(
        [cx - r_mid, cy - r_mid, cx + r_mid, cy + r_mid],
        outline=(255, 255, 255, 120),
        width=max(1, size // 100)
    )

    # Centre du vinyle (pastille colorée cyan/ambre)
    r_inner = int(r_outer * 0.38)
    icon_draw.ellipse(
        [cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner],
        fill=(245, 158, 11, 240),  # Ambre
        outline=(255, 255, 255, 240),
        width=max(2, size // 80)
    )

    # Trou central
    r_hole = int(r_outer * 0.12)
    icon_draw.ellipse(
        [cx - r_hole, cy - r_hole, cx + r_hole, cy + r_hole],
        fill=(59, 130, 246, 255),
        outline=(255, 255, 255, 200),
        width=max(1, size // 120)
    )

    # Badge étoile / gemme en haut à droite
    star_x = cx + int(r_outer * 0.65)
    star_y = cy - int(r_outer * 0.65)
    star_r = int(r_outer * 0.28)
    icon_draw.ellipse(
        [star_x - star_r, star_y - star_r, star_x + star_r, star_y + star_r],
        fill=(16, 185, 129, 255),  # Emeraude
        outline=(255, 255, 255, 255),
        width=max(2, size // 80)
    )

    return img

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(base_dir, 'icons')
    os.makedirs(icons_dir, exist_ok=True)

    # Génération
    img_192 = create_icon(192, is_maskable=False)
    img_192.save(os.path.join(icons_dir, 'icon-192.png'), 'PNG')

    img_512 = create_icon(512, is_maskable=False)
    img_512.save(os.path.join(icons_dir, 'icon-512.png'), 'PNG')

    img_192_m = create_icon(192, is_maskable=True)
    img_192_m.save(os.path.join(icons_dir, 'icon-192-maskable.png'), 'PNG')

    img_512_m = create_icon(512, is_maskable=True)
    img_512_m.save(os.path.join(icons_dir, 'icon-512-maskable.png'), 'PNG')

    print("✅ Icônes PNG générées avec succès dans icons/")
