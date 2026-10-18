#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ============================================================
# build_heroes — فاز ۱ Asset Production: چهار قهرمان (کارت ۶.۱..۶.۴)
# ------------------------------------------------------------
# خروجی: public/assets/3d/heroes/{arman,aria,radin,nila}.glb
# طراحی: بدنه = «یک» مش چند-پریمیتیو + سلاح = «یک» مش جدا
#   → Prop-Swing قطعی (کوچک‌ترین جزء = سلاح کشیده)
# ارتفاع‌ها دقیق: آرمان 1.85 / آریا 1.78 / رادین 1.95 / نیلا 1.75
# جهت +Z (چهره رو به جلو) — پاها روی y=0
# ============================================================
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glbkit as g
import numpy as np

OUT = '/home/z/my-project/public/assets/3d/heroes'
os.makedirs(OUT, exist_ok=True)

# ============================================================
# پالت‌ها — از کارت‌های Art Bible
# ============================================================

def M(name, color, **kw):
    return g.Mat(name, color, **kw)

# ---------------------------- ۶.۱ — آرمان ----------------------------
# فولاد آبی‌خاکستری #5d6b7a · طلایی آذر #f0b03c · لاجورد #2e5f8a
# کریستال آذرخش #93c5fd (Emissive) · چرم #7a5a3a · چوب #6b4a2f

def build_arman():
    m = g.Model('Arman_Commander')
    steel = M('steel_blue', '#5d6b7a', metallic=0.55, roughness=0.45)
    steel_dark = M('steel_dark', '#49545f', metallic=0.6, roughness=0.5)
    gold = M('azar_gold', '#f0b03c', metallic=0.85, roughness=0.3)
    indigo = M('indigo_sash', '#2e5f8a', roughness=0.75)
    leather = M('leather', '#7a5a3a', roughness=0.85)
    skin = M('skin', '#d9a06f', roughness=0.7)
    beard = M('beard', '#1c1a18', roughness=0.9)
    hair = M('hair', '#191614', roughness=0.9)
    crystal = M('storm_crystal', '#93c5fd', emissive='#93c5fd', emissive_k=1.4, roughness=0.2)
    stone = M('hammer_stone', '#8a8f96', metallic=0.3, roughness=0.6)
    wood = M('haft_wood', '#6b4a2f', roughness=0.9)
    gem = M('blue_gem', '#3b82f6', emissive='#3b82f6', emissive_k=0.8)

    b = m.part('arman_body')

    # ---- ساق‌پا و چکمه (زانوخم کمی — ایستای قهرمانی) ----
    for sx in (-1, 1):
        x = 0.13 * sx
        b.cyl(steel_dark, 0.075, 0.062, 0.5, seg=8, at=(x, 0.16, -0.01))
        b.cyl(steel_dark, 0.07, 0.06, 0.32, seg=8, at=(x * 1.06, 0.66, 0.0))
        # چکمه
        b.box(leather, 0.13, 0.1, 0.26, at=(x, 0.05, 0.045))
        b.box(steel_dark, 0.145, 0.07, 0.14, at=(x, 0.135, 0.02))
    # زانوبند طلایی
    for sx in (-1, 1):
        b.cyl(gold, 0.066, 0.066, 0.05, seg=8, at=(0.138 * sx, 0.62, 0.0))

    # ---- دامن‌کوتاه تسمه‌ای (نه دامن بلند) ----
    b.cyl(indigo, 0.19, 0.17, 0.24, seg=10, at=(0, 0.95, 0), pivot='center')
    for i in range(5):
        a = i * 72
        bx, bz = 0.135 * np.sin(np.radians(a)), 0.135 * np.cos(np.radians(a))
        b.box(leather if i % 2 == 0 else steel_dark, 0.07, 0.26, 0.035,
              rot=(0, a, 0), at=(bx, 0.82, bz))

    # ---- کمربند + قفل مُهر آذر ----
    b.cyl(gold, 0.175, 0.175, 0.07, seg=10, at=(0, 1.07, 0), pivot='center')
    b.box(gold, 0.1, 0.09, 0.05, at=(0, 1.07, 0.17))

    # ---- بالاتنه — قوی، کمر باریک ----
    b.cyl(steel, 0.155, 0.215, 0.42, seg=10, at=(0, 1.1, 0))
    # سینه‌پوش صفحه‌ای با ترنج حکاکی
    b.cyl(steel, 0.225, 0.235, 0.16, seg=10, at=(0, 1.38, 0), pivot='center')
    # ترنج (لوزی طلایی جلوی سینه)
    b.box(gold, 0.11, 0.15, 0.03, rot=(0, 45, 0), at=(0, 1.4, 0.235))
    b.box(gold, 0.05, 0.05, 0.028, rot=(0, 45, 0), at=(0, 1.4, 0.25))
    # خطوط حکاکی زیر سینه
    b.cyl(gold, 0.208, 0.208, 0.02, seg=10, at=(0, 1.28, 0), pivot='center')

    # ---- شانه‌پوش دوتکه چهارگوش ----
    for sx in (-1, 1):
        b.box(steel, 0.19, 0.09, 0.24, at=(0.29 * sx, 1.5, 0.0), rot=(0, 0, -6 * sx))
        b.box(gold, 0.2, 0.025, 0.25, at=(0.29 * sx, 1.545, 0.0), rot=(0, 0, -6 * sx))
        # زنجیر کوتاه شانه به سینه‌پوش (سمت چپ)
        if sx > 0:
            b.cyl(gold, 0.012, 0.012, 0.2, seg=5, at=(0.21, 1.42, 0.12), rot=(0, 0, 30))

    # ---- بازوها — پیش‌بازوی چرم پرشمار ----
    for sx in (-1, 1):
        b.cyl(steel, 0.068, 0.058, 0.26, seg=8, at=(0.3 * sx, 1.24, 0), rot=(0, 0, 8 * sx))
        b.sphere(skin, 0.055, at=(0.345 * sx, 1.14, 0.01))
        b.cyl(leather, 0.06, 0.052, 0.24, seg=8, at=(0.36 * sx, 0.93, 0.02), rot=(0, 0, 4 * sx))
        for i in range(3):  # پرشمار چرم
            b.cyl(gold if i == 1 else steel_dark, 0.062, 0.062, 0.018, seg=8,
                  at=(0.368 * sx, 0.99 - i * 0.075, 0.02), rot=(0, 0, 4 * sx))
        b.sphere(skin, 0.055, at=(0.385 * sx, 0.82, 0.03))  # دست

    # ---- سربند لاجوردی (گردن) ----
    b.cyl(indigo, 0.075, 0.075, 0.07, seg=8, at=(0, 1.5, 0), pivot='center')
    b.cyl(gold, 0.078, 0.078, 0.015, seg=8, at=(0, 1.485, 0), pivot='center')

    # ---- سر — ریش کوتاه مشکی، پیشانی‌بند طلایی با نگین ----
    b.cyl(skin, 0.042, 0.045, 0.09, seg=6, at=(0, 1.545, 0))  # گردن
    b.sphere(skin, 0.115, at=(0, 1.685, 0.005), lat=8, lon=12, scale=(1.0, 1.05, 1.0))
    # ریش — نیم‌کرهٔ پایین صورت
    b.sphere(beard, 0.105, at=(0, 1.635, 0.035), lat=7, lon=10, hemisphere=True, scale=(0.95, 0.9, 0.85))
    b.box(beard, 0.07, 0.09, 0.06, at=(0, 1.63, 0.1))  # سبیل پیوسته + چانه
    # موی پسِ سر
    b.sphere(hair, 0.108, at=(0, 1.72, -0.035), lat=7, lon=10, hemisphere=True,
             scale=(1.02, 1.0, 0.95), rot=(-18, 0, 0))
    # پیشانی‌بند فلزی طلایی
    b.cyl(gold, 0.118, 0.118, 0.035, seg=12, at=(0, 1.745, 0.005), pivot='center')
    # نگین آبی وسط پیشانی‌بند
    b.octa(gem, 0.028, at=(0, 1.745, 0.115), scale=(1, 1.2, 0.7))

    # ---- پتک آذری — مش مجزا (tabaz-hammer: تبر-چکش یک‌دسته) ----
    # وجه چکش +Z (ضربه به جلو) — وجه تبر -Z — bbox باریک برای Prop-Swing (<۱۰٪)
    w = m.part('arman_weapon', translation=(-0.42, 0.0, 0.06), rotation=(0, 0, 0))
    # دستهٔ چوب‌فلزی
    w.cyl(wood, 0.024, 0.02, 0.92, seg=8, at=(0, 0.58, 0))
    w.cyl(gold, 0.027, 0.027, 0.05, seg=8, at=(0, 0.62, 0), pivot='center')   # یراق دسته
    w.cyl(gold, 0.027, 0.027, 0.05, seg=8, at=(0, 1.44, 0), pivot='center')   # یراق زیر سر
    w.cyl(gold, 0.03, 0.024, 0.06, seg=8, at=(0, 1.5, 0))                      # اتصال سر
    # سر چکش مستطیلی سنگی — وجه چکش +Z / وجه تبر -Z
    w.box(stone, 0.14, 0.19, 0.2, at=(0, 1.6, 0.02))
    w.box(steel, 0.155, 0.2, 0.05, at=(0, 1.6, 0.135))         # حلقهٔ آهنی جلو
    w.box(steel, 0.1, 0.17, 0.09, at=(0, 1.6, -0.12))          # لبهٔ تبر فشرده -Z
    # حکاکی ترنج روی وجوه
    w.box(gold, 0.04, 0.04, 0.024, rot=(0, 45, 0), at=(0, 1.6, 0.125))
    # کریستال آذرخش نوک‌دار
    w.cyl(steel_dark, 0.032, 0.018, 0.05, seg=6, at=(0, 1.72, 0.02))
    w.octa(crystal, 0.05, at=(0, 1.8, 0.02), scale=(1, 1.6, 1))
    # انتهای دسته — پومل
    w.sphere(gold, 0.03, at=(0, 0.57, 0))

    # ---- نقاط VFX ----
    m.point('WeaponPoint', (-0.42, 1.87, 0.08))
    m.point('MuzzlePoint', (-0.42, 1.87, 0.08))
    m.point('ChestPoint', (0, 1.38, 0.25))
    m.point('HeadPoint', (0, 1.7, 0.12))
    m.point('HitPoint', (0, 1.0, 0))

    p = os.path.join(OUT, 'arman.glb')
    m.save(p)
    return m, p


# ============================================================
# ۶.۲ — آریا GUARDIAN — سپر اثری
# ============================================================

def build_aria():
    m = g.Model('Aria_Guardian')
    cream = M('cream_cloth', '#d9d4c6', roughness=0.9)
    cream2 = M('cream_under', '#c4beb0', roughness=0.9)
    indigo = M('indigo_trim', '#2e5f8a', roughness=0.75)
    bronze = M('bronze', '#8a6b45', metallic=0.75, roughness=0.4)
    bronze_d = M('bronze_dark', '#6e5435', metallic=0.8, roughness=0.45)
    skin = M('skin_aria', '#e8c39a', roughness=0.7)
    hair = M('hair_aria', '#2b2320', roughness=0.85)
    scarf = M('scarf', '#3a6ea5', roughness=0.85)
    orb = M('aether_orb', '#67e8f9', emissive='#67e8f9', emissive_k=1.6, roughness=0.15)
    eye = M('eye_turquoise', '#67e8f9', emissive='#67e8f9', emissive_k=1.0)
    gem = M('forehead_gem', '#67e8f9', emissive='#67e8f9', emissive_k=0.7)

    b = m.part('aria_body')

    # ---- ردای بلند-کوتاه (دامن تا زانو با لایهٔ زیرین کوتاه‌تر) ----
    b.cyl(cream, 0.27, 0.15, 0.95, seg=12, at=(0, 0.02, 0))
    b.cyl(cream2, 0.21, 0.13, 0.55, seg=12, at=(0, 0.02, 0))
    # پاها زیر ردا — چکمهٔ ظریف
    for sx in (-1, 1):
        b.box(bronze_d, 0.09, 0.06, 0.2, at=(0.08 * sx, 0.03, 0.03))
    # لایهٔ حاشیهٔ پایین ردا
    b.cyl(indigo, 0.272, 0.272, 0.03, seg=12, at=(0, 0.035, 0), pivot='center')

    # ---- شال کمر با گره مُهر ----
    b.cyl(indigo, 0.148, 0.148, 0.06, seg=12, at=(0, 0.98, 0), pivot='center')
    b.box(indigo, 0.07, 0.16, 0.03, at=(0.1, 0.88, 0.13), rot=(0, 0, 12))

    # ---- بالاپوش زره‌دار سبک ----
    b.cyl(cream, 0.14, 0.185, 0.38, seg=10, at=(0, 1.0, 0))
    b.cyl(bronze, 0.192, 0.2, 0.13, seg=10, at=(0, 1.28, 0), pivot='center')
    # طلسم دایره‌ای روی سینه‌پوش
    b.cyl(gold_ := M('gold_accent', '#c9a558', metallic=0.9, roughness=0.3), 0.055, 0.055, 0.02, seg=12,
          at=(0, 1.3, 0.2), rot=(90, 0, 0), pivot='center')
    b.octa(gem, 0.022, at=(0, 1.3, 0.212), scale=(1, 1, 0.6))
    # پاپیون‌های لاجوردی شانه
    for sx in (-1, 1):
        b.box(indigo, 0.09, 0.045, 0.06, at=(0.16 * sx, 1.44, 0.02), rot=(0, 0, -18 * sx))
        b.octa(bronze, 0.024, at=(0.16 * sx, 1.44, 0.055), scale=(1, 1, 0.7))

    # ---- بازوها + بازوبند برنزی ----
    for sx in (-1, 1):
        b.cyl(cream, 0.05, 0.042, 0.3, seg=8, at=(0.215 * sx, 1.22, 0), rot=(0, 0, 9 * sx))
        b.cyl(bronze, 0.052, 0.048, 0.16, seg=8, at=(0.26 * sx, 0.97, 0.015), rot=(0, 0, 4 * sx))
        b.sphere(skin, 0.048, at=(0.285 * sx, 0.86, 0.02))
        b.sphere(skin, 0.042, at=(0.29 * sx, 1.13, 0.01))  # شانه

    # ---- سر — چشم فیروزه‌ای، موی بسته، نگین پیشانی ----
    b.cyl(skin, 0.035, 0.038, 0.08, seg=6, at=(0, 1.47, 0))
    b.sphere(skin, 0.105, at=(0, 1.59, 0.005), lat=8, lon=12, scale=(0.95, 1.05, 0.98))
    # چشم‌های روشن
    b.sphere(eye, 0.016, at=(-0.038, 1.615, 0.093))
    b.sphere(eye, 0.016, at=(0.038, 1.615, 0.093))
    # روسری پشت سر + موی بسته
    b.sphere(scarf, 0.112, at=(0, 1.62, -0.03), lat=7, lon=10, hemisphere=True,
             scale=(1.02, 1.05, 0.95), rot=(-15, 0, 0))
    b.sphere(hair, 0.065, at=(0, 1.56, -0.11), lat=6, lon=9)  # گوجهٔ مو
    # نگین پیشانی کوچک
    b.octa(gem, 0.018, at=(0, 1.665, 0.1), scale=(1, 1.2, 0.6))

    # ---- عصای اثیر — مش مجزا (دست راست) ----
    w = m.part('aria_weapon', translation=(0.3, 0, 0.08), rotation=(0, 0, 0))
    w.cyl(bronze_d, 0.02, 0.016, 1.42, seg=8, at=(0, 0.38, 0))
    # ریسهٔ حکاکی حلقهٔ پایین‌تر
    w.cyl(bronze, 0.03, 0.03, 0.06, seg=8, at=(0, 0.62, 0), pivot='center')
    # سرِ دو-حلقه‌ای برنزی
    w.cyl(bronze, 0.085, 0.085, 0.022, seg=12, at=(0, 1.78, 0), pivot='center')
    w.cyl(bronze, 0.07, 0.07, 0.02, seg=12, at=(0, 1.9, 0), pivot='center')
    # بازوهای اتصال حلقه‌ها
    w.cyl(bronze_d, 0.012, 0.012, 0.13, seg=6, at=(0.06, 1.84, 0))
    w.cyl(bronze_d, 0.012, 0.012, 0.13, seg=6, at=(-0.06, 1.84, 0))
    # گوی فیروزه‌ای شناور (بین دو حلقه)
    w.sphere(orb, 0.082, at=(0, 1.845, 0), lat=8, lon=12)
    # نوک عصا
    w.octa(bronze, 0.025, at=(0, 1.955, 0), scale=(1, 1.3, 1))

    # ---- نقاط VFX ----
    m.point('WeaponPoint', (0.3, 1.97, 0.08))
    m.point('StaffPoint', (0.3, 1.85, 0.08))
    m.point('ChestPoint', (0, 1.28, 0.2))
    m.point('HeadPoint', (0, 1.6, 0.1))
    m.point('HitPoint', (0, 0.95, 0))

    p = os.path.join(OUT, 'aria.glb')
    m.save(p)
    return m, p


# ============================================================
# ۶.۳ — رادین BERSERKER — خشم جنگ
# ============================================================

def build_radin():
    m = g.Model('Radin_Berserker')
    bronze = M('bronze_radin', '#6e5138', metallic=0.7, roughness=0.45)
    bronze_d = M('bronze_dark_radin', '#57402c', metallic=0.75, roughness=0.5)
    redleather = M('red_leather', '#8a4438', roughness=0.85)
    red = M('rage_red', '#f87171', roughness=0.6, emissive='#f87171', emissive_k=0.35)
    skin = M('skin_radin', '#c99b74', roughness=0.75)
    hair = M('hair_radin', '#241a12', roughness=0.9)
    bone = M('bone_pin', '#d8cfc0', roughness=0.6)
    pelt = M('wolf_pelt', '#6b6b66', roughness=0.95)
    pelt2 = M('wolf_pelt2', '#5a5a56', roughness=0.95)
    steel = M('axe_steel', '#9aa1a9', metallic=0.85, roughness=0.35)
    wood = M('axe_haft', '#5d4227', roughness=0.9)

    b = m.part('radin_body')

    # ---- ساق‌بند و شلوار بستهٔ جنگی ----
    for sx in (-1, 1):
        x = 0.15 * sx
        b.cyl(redleather, 0.1, 0.082, 0.55, seg=8, at=(x, 0.14, 0))     # ساق‌بند
        b.cyl(skin, 0.088, 0.078, 0.3, seg=8, at=(x * 1.05, 0.68, 0))   # ران
        b.box(bronze_d, 0.14, 0.09, 0.28, at=(x, 0.05, 0.04))           # چکمه
        b.box(redleather, 0.11, 0.05, 0.24, at=(x, 0.13, 0.03))
    # زانوبند
    for sx in (-1, 1):
        b.cyl(bronze, 0.086, 0.086, 0.05, seg=8, at=(0.152 * sx, 0.6, 0), pivot='center')

    # ---- کمر پهن با مُهر سرخ ----
    b.cyl(redleather, 0.23, 0.23, 0.1, seg=10, at=(0, 1.02, 0), pivot='center')
    b.cyl(red, 0.07, 0.07, 0.035, seg=10, at=(0, 1.02, 0.225), rot=(90, 0, 0), pivot='center')

    # ---- سینهٔ جلو — تودهٔ سنگین ----
    b.cyl(skin, 0.21, 0.3, 0.52, seg=10, at=(0, 1.07, 0))
    # پلاک سینهٔ راست (نامتقارن — سمت -X)
    b.box(bronze, 0.2, 0.3, 0.06, at=(-0.12, 1.4, 0.24), rot=(0, 0, -5))
    b.box(gold_ := M('seal_gold', '#b08a4a', metallic=0.85, roughness=0.35), 0.06, 0.06, 0.03,
          rot=(0, 45, 0), at=(-0.12, 1.47, 0.28))
    # زخم‌های قدیمی — خطوط روشن روی سینه
    b.box(M('scar', '#a97e5c', roughness=0.8), 0.025, 0.16, 0.02, at=(0.05, 1.42, 0.295), rot=(0, 0, 18))
    b.box(M('scar', '#a97e5c', roughness=0.8), 0.02, 0.12, 0.02, at=(0.13, 1.35, 0.26), rot=(0, 0, -30))
    # حلقه‌های تسمه روی سینه‌پوش
    b.cyl(redleather, 0.285, 0.29, 0.045, seg=10, at=(0, 1.5, 0), pivot='center', cap0=False, cap1=False)

    # ---- شانه‌پوش تک‌طرف (-X) + پوست گرگ (+X) ----
    b.sphere(bronze, 0.14, at=(-0.32, 1.58, 0), lat=7, lon=10, hemisphere=True, scale=(1.15, 0.75, 1.1))
    b.cyl(bronze, 0.13, 0.11, 0.05, seg=10, at=(-0.32, 1.56, 0), pivot='center')
    # پوست گرگ — لایه‌لایه کوتاه
    b.box(pelt, 0.26, 0.5, 0.07, at=(0.33, 1.38, 0.02), rot=(0, 0, 8))
    b.box(pelt2, 0.22, 0.2, 0.05, at=(0.33, 1.6, -0.01), rot=(0, 0, 8))
    b.box(pelt2, 0.24, 0.14, 0.05, at=(0.33, 1.13, 0.05), rot=(0, 0, 8))

    # ---- بازوهای برهنهٔ سنگین ----
    for sx in (-1, 1):
        b.cyl(skin, 0.095, 0.078, 0.34, seg=8, at=(0.36 * sx, 1.28, 0), rot=(0, 0, 10 * sx))
        b.cyl(skin, 0.078, 0.066, 0.3, seg=8, at=(0.46 * sx, 0.98, 0.01), rot=(0, 0, 4 * sx))
        b.sphere(skin, 0.065, at=(0.485 * sx, 0.84, 0.02))
        # دستبند استخوانی (راست)
        if sx < 0:
            b.cyl(bone, 0.082, 0.082, 0.05, seg=8, at=(0.465 * -1, 0.9, 0.01), pivot='center')
    # خال‌کوبی سرخ بازوی راست
    b.cyl(red, 0.081, 0.081, 0.09, seg=8, at=(-0.375, 1.32, 0), rot=(0, 0, 10), pivot='center',
          cap0=False, cap1=False)

    # ---- سر — وحشی، گوش بریده، پین استخوانی ----
    b.cyl(skin, 0.05, 0.055, 0.1, seg=6, at=(0, 1.63, 0))
    b.sphere(skin, 0.125, at=(0, 1.78, 0.005), lat=8, lon=12, scale=(1.0, 1.05, 1.0))
    # موی وحشی نیم‌بسته
    b.sphere(hair, 0.12, at=(0, 1.84, -0.045), lat=7, lon=10, hemisphere=True, scale=(1.05, 1.0, 1.0), rot=(-20, 0, 0))
    b.sphere(hair, 0.07, at=(0.02, 1.66, -0.14), lat=6, lon=8, scale=(1.0, 1.4, 0.7))  # دم اسبی وحشی
    # پین‌های استخوانی
    b.cyl(bone, 0.012, 0.012, 0.12, seg=5, at=(0.08, 1.86, -0.02), rot=(0, 0, 40))
    b.cyl(bone, 0.01, 0.01, 0.1, seg=5, at=(-0.07, 1.87, -0.03), rot=(0, 0, -35))
    # گوش‌ها — چپ بریده (عدم تقارن)
    b.sphere(skin, 0.03, at=(0.115, 1.76, 0.0), scale=(0.5, 1.0, 0.7))
    b.sphere(skin, 0.016, at=(-0.118, 1.77, 0.0), scale=(0.5, 1.0, 0.7))
    # ته‌ریش
    b.sphere(hair, 0.09, at=(0, 1.72, 0.05), lat=6, lon=9, hemisphere=True, scale=(0.85, 0.7, 0.7))

    # ---- تبر جنگ دو-دستی — مش مجزا (تیشه به سمت -X بیرون، تیزهٔ عقب +Z) ----
    w = m.part('radin_weapon', translation=(-0.5, 0, 0.05), rotation=(0, 0, 0))
    # دستهٔ پیچ‌دار
    w.cyl(wood, 0.03, 0.026, 1.5, seg=8, at=(0, 0.36, 0))
    for i in range(4):  # نوارهای سرخ
        w.cyl(redleather, 0.033, 0.033, 0.05, seg=8, at=(0, 0.55 + i * 0.3, 0), pivot='center')
    # گلوگاه برنزی + تیشهٔ پهن با دو قوس برنده
    w.box(bronze, 0.07, 0.12, 0.07, at=(0, 1.72, 0))
    w.box(steel, 0.26, 0.28, 0.03, at=(-0.14, 1.87, 0))
    w.tri_fan(steel, [
        # قوس برندهٔ بالا
        [(-0.24, 1.98, 0.0), (-0.34, 1.93, 0.0), (-0.26, 1.87, 0.008)],
        [(-0.34, 1.93, 0.0), (-0.26, 1.87, -0.008), (-0.26, 1.87, 0.008)],
        # قوس برندهٔ پایین
        [(-0.24, 1.76, 0.0), (-0.34, 1.81, 0.0), (-0.26, 1.87, 0.008)],
        [(-0.34, 1.81, 0.0), (-0.26, 1.87, -0.008), (-0.26, 1.87, 0.008)],
    ])
    # عقب‌تیزهٔ چکشی — به سمت +Z
    w.box(bronze_d, 0.09, 0.13, 0.09, at=(0.0, 1.87, 0.09))
    w.box(bronze, 0.05, 0.17, 0.06, at=(0.0, 1.87, 0.04))
    # مُهر آذر روی گونهٔ تیشه
    w.octa(red, 0.04, at=(-0.14, 1.87, 0.02), scale=(1.3, 1, 0.5))
    # سرپوش انتهای دسته
    w.sphere(bronze, 0.04, at=(0, 0.35, 0))

    # ---- نقاط VFX ----
    m.point('WeaponPoint', (-0.5 - 0.24, 1.87, 0.05))
    m.point('ChestPoint', (0, 1.4, 0.3))
    m.point('HeadPoint', (0, 1.78, 0.12))
    m.point('HitPoint', (0, 1.05, 0))

    p = os.path.join(OUT, 'radin.glb')
    m.save(p)
    return m, p


# ============================================================
# ۶.۴ — نیلا RANGER — باران تیر
# ============================================================

def build_nila():
    m = g.Model('Nila_Ranger')
    darkgreen = M('night_green', '#4a5548', roughness=0.85)
    darkgreen2 = M('night_green2', '#3d463c', roughness=0.85)
    leather = M('leather_nila', '#7a5a3a', roughness=0.9)
    leather_d = M('leather_dark', '#5d452c', roughness=0.9)
    silver = M('silver_matte', '#a8adb5', metallic=0.8, roughness=0.35)
    purple = M('arrow_purple', '#c084fc', emissive='#c084fc', emissive_k=1.2, roughness=0.3)
    skin = M('skin_nila', '#dcae87', roughness=0.7)
    hair = M('hair_nila', '#1f1a16', roughness=0.88)
    scarf = M('neck_scarf', '#3a4038', roughness=0.9)
    amber = M('eye_amber', '#fbbf24', emissive='#fbbf24', emissive_k=0.9)
    paint = M('war_paint', '#8b5cf6', roughness=0.7)

    b = m.part('nila_body')

    # ---- شلوار تیراندازی بسته + چکمهٔ سبک ----
    for sx in (-1, 1):
        x = 0.1 * sx
        b.cyl(darkgreen, 0.068, 0.056, 0.5, seg=8, at=(x, 0.14, 0))
        b.cyl(darkgreen2, 0.062, 0.054, 0.34, seg=8, at=(x * 1.05, 0.62, 0))
        b.box(leather_d, 0.1, 0.08, 0.22, at=(x, 0.04, 0.04))
    # شال کمر + کیسهٔ حبوب
    b.cyl(leather_d, 0.13, 0.13, 0.06, seg=10, at=(0, 0.9, 0), pivot='center')
    b.box(leather, 0.08, 0.1, 0.05, at=(-0.11, 0.82, 0.1))
    b.octa(purple, 0.02, at=(0, 0.9, 0.135), scale=(1, 1, 0.4))  # نقش کمربند بنفش

    # ---- بالاپوش چرمی سبک با پلاک‌های کوچک ----
    b.cyl(darkgreen, 0.115, 0.16, 0.36, seg=10, at=(0, 0.92, 0))
    b.cyl(leather, 0.165, 0.17, 0.12, seg=10, at=(0, 1.2, 0), pivot='center')
    # پلاک‌های نقره‌ای کوچک
    b.box(silver, 0.05, 0.07, 0.02, at=(-0.06, 1.24, 0.165), rot=(10, 0, 0))
    b.box(silver, 0.05, 0.07, 0.02, at=(0.05, 1.2, 0.168), rot=(10, 0, 0))
    # شال گردن تنگ
    b.cyl(scarf, 0.06, 0.06, 0.06, seg=8, at=(0, 1.32, 0), pivot='center')

    # ---- بازوها — چابک ----
    for sx in (-1, 1):
        b.cyl(darkgreen, 0.044, 0.038, 0.26, seg=8, at=(0.19 * sx, 1.18, 0), rot=(0, 0, 8 * sx))
        b.sphere(skin, 0.036, at=(0.225 * sx, 1.1, 0.005))
        b.cyl(darkgreen2, 0.04, 0.034, 0.2, seg=8, at=(0.245 * sx, 0.95, 0.01), rot=(0, 0, 3 * sx))
        # بازوبند چرمی تیراندازی (چپ +X)
        if sx > 0:
            b.cyl(leather, 0.044, 0.044, 0.09, seg=8, at=(0.25 * sx, 0.98, 0.01), pivot='center')
        b.sphere(skin, 0.04, at=(0.26 * sx, 0.84, 0.015))
        # دو انگشتر باریک
        if sx < 0:
            b.cyl(silver, 0.037, 0.037, 0.012, seg=8, at=(0.258 * sx, 0.8, 0.015), pivot='center')

    # ---- سر — چشم کهربایی، نقاشی جنگی، موی بستهٔ جنگی ----
    b.cyl(skin, 0.03, 0.033, 0.07, seg=6, at=(0, 1.35, 0))
    b.sphere(skin, 0.095, at=(0, 1.46, 0.005), lat=8, lon=12, scale=(0.94, 1.04, 0.96))
    b.sphere(amber, 0.014, at=(-0.034, 1.478, 0.084))
    b.sphere(amber, 0.014, at=(0.034, 1.478, 0.084))
    # نقاشی جنگی بنفش زیر چشم راست (-X)
    b.box(paint, 0.028, 0.012, 0.02, at=(-0.036, 1.452, 0.09))
    # موی بسته با چند لایهٔ آزاد
    b.sphere(hair, 0.096, at=(0, 1.485, -0.028), lat=7, lon=10, hemisphere=True, scale=(0.98, 1.0, 0.95), rot=(-16, 0, 0))
    b.sphere(hair, 0.055, at=(0, 1.44, -0.12), lat=6, lon=8, scale=(0.9, 1.3, 0.6))
    for sx in (-1, 1):  # لایه‌های آزاد جلوی صورت
        b.box(hair, 0.02, 0.12, 0.02, at=(0.075 * sx, 1.46, 0.055), rot=(0, 0, -6 * sx))

    # ---- کلاه نوک‌دار رو به عقب ----
    b.cyl(leather_d, 0.105, 0.098, 0.05, seg=10, at=(0, 1.535, 0), pivot='center')
    b.cyl(leather_d, 0.098, 0.004, 0.2, seg=10, at=(0, 1.56, -0.02), rot=(-38, 0, 0))
    b.octa(silver, 0.016, at=(0, 1.565, 0.095), scale=(1, 1, 0.5))

    # ---- کولهٔ تیر بلند (پشت شانهٔ راست — بخشی از بدنه) ----
    b.cyl(leather_d, 0.05, 0.05, 0.5, seg=8, at=(-0.16, 1.05, -0.16), rot=(14, 0, -10))
    for i, (dx, dy) in enumerate([(-0.02, 0.03), (0.03, 0.0), (0.0, -0.03)]):
        b.cyl(wood_ := M('arrow_shaft', '#8a6b45', roughness=0.85), 0.008, 0.008, 0.16, seg=5,
              at=(-0.16 + dx, 1.36 + dy, -0.16 + 0.04), rot=(14, 0, -10))
        b.octa(purple, 0.018, at=(-0.16 + dx, 1.445 + dy, -0.12 + 0.04), scale=(0.8, 1.5, 0.8))

    # ---- کمان کوتاه خمیده — مش مجزا (دست چپ +X) ----
    w = m.part('nila_weapon', translation=(0.31, 0, 0.06), rotation=(0, 0, 0))
    # بدنهٔ کمان — سه قطعهٔ خمیده
    w.box(wood_2 := M('bow_wood', '#4a3b28', roughness=0.85), 0.035, 0.5, 0.045, at=(0, 0.85, 0))
    w.box(wood_2, 0.03, 0.34, 0.04, at=(0.07, 1.22, 0), rot=(0, 0, -22))
    w.box(wood_2, 0.03, 0.34, 0.04, at=(0.07, 0.48, 0), rot=(0, 0, 22))
    # زه‌گیرهای نقره‌ای + نقش حکاکی
    w.box(silver, 0.045, 0.05, 0.05, at=(0.135, 1.36, 0), rot=(0, 0, -22))
    w.box(silver, 0.045, 0.05, 0.05, at=(0.135, 0.34, 0), rot=(0, 0, 22))
    w.box(silver, 0.04, 0.03, 0.05, at=(0, 0.85, 0.03))
    # زه
    w.box(M('bow_string', '#d8d3c8', roughness=0.9), 0.006, 1.02, 0.006, at=(0.16, 0.85, 0.0))

    # ---- نقاط VFX ----
    m.point('WeaponPoint', (0.31 + 0.14, 0.85, 0.06))
    m.point('ChestPoint', (0, 1.2, 0.18))
    m.point('HeadPoint', (0, 1.46, 0.1))
    m.point('HitPoint', (0, 0.9, 0))

    p = os.path.join(OUT, 'nila.glb')
    m.save(p)
    return m, p


# ============================================================
# اجرا + گزارش
# ============================================================

if __name__ == '__main__':
    for fn, hid in [(build_arman, 'arman'), (build_aria, 'aria'), (build_radin, 'radin'), (build_nila, 'nila')]:
        model, path = fn()
        mn, mx = model.bbox()
        # بررسی Prop-Swing: کوچک‌ترین Part باید سلاح باشد
        parts = sorted(model.parts, key=lambda p: p.vol)
        smallest = parts[0].name if parts else '-'
        body = max(model.parts, key=lambda p: p.vol)
        ratio = (parts[0].vol / body.vol) if body.vol else 9
        print(f"{hid:7s} → {os.path.basename(path):12s} h={model.height():.3f} tris={model.tris():5d} "
              f"parts={len(model.parts)} smallest={smallest} vol%={ratio*100:.1f} "
              f"y=[{mn[1]:.2f}..{mx[1]:.2f}] size={os.path.getsize(path)}B")
        if len(parts) != 2 or not smallest.endswith('_weapon'):
            print(f"  ⚠️ WARNING: prop-swing risk — smallest part is not weapon!")
