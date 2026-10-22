#!/bin/bash
# QA v2.2 فاز ۸ — ساخت با تشخیص توست + انتخاب برج + تست قفل قدرت
set -e
cd /home/z/my-project
SHOTS=/home/z/my-project/download/screenshots

bunx next dev -p 3000 > /tmp/devserver.log 2>&1 &
SRV=$!
for i in $(seq 1 40); do sleep 2; code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || true); [ "$code" = "200" ] && break; done
echo "server: HTTP $code"
cleanup() { kill $SRV 2>/dev/null || true; agent-browser close 2>/dev/null || true; }
trap cleanup EXIT

mkTap() { echo "((tx,ty)=>{const cv=document.querySelector('canvas');if(!cv.__p){cv.setPointerCapture=()=>{};cv.releasePointerCapture=()=>{};cv.__p=1;}const r=cv.getBoundingClientRect();const o={clientX:r.left+tx,clientY:r.top+ty,pointerId:7,bubbles:true,cancelable:true,isPrimary:true,pointerType:'touch'};cv.dispatchEvent(new PointerEvent('pointerdown',o));cv.dispatchEvent(new PointerEvent('pointerup',o));'tapped'})($1,$2)"; }

agent-browser set viewport 390 844
agent-browser open http://localhost:3000
agent-browser wait --text "شروع نبرد" --timeout 120000
sleep 1
agent-browser eval "[...document.querySelectorAll('button')].find(b => b.textContent.includes('شروع نبرد'))?.click(); 'ok'" > /dev/null
sleep 8
agent-browser eval "[...document.querySelectorAll('button')].find(b => b.textContent.includes('نگهبان'))?.click(); 'sel'" > /dev/null
sleep 1

# کاوش ریز شبکه — توست خطا = نامعتبر، بی‌توست = ساخته شد
BUILT=""
for pt in "180 560" "150 590" "210 590" "120 560" "240 560" "100 530" "270 530" "150 520" "90 480" "300 500" "60 430" "330 430" "180 500" "210 470" "120 470" "270 470" "60 380" "330 380" "150 430" "240 430"; do
  set -- $pt
  agent-browser eval "document.querySelectorAll('.toast-anim').forEach(e=>e.remove()); 'c'" > /dev/null
  agent-browser eval "$(mkTap $1 $2)" > /dev/null
  sleep 0.45
  T=$(agent-browser eval "document.querySelectorAll('.toast-anim').length" 2>/dev/null || echo "?")
  if [ "$T" = "0" ]; then BUILT="$1 $2"; echo "── ساخته شد در ($1,$2)"; break; fi
done
if [ -z "$BUILT" ]; then echo "BUILD-FAILED"; agent-browser screenshot "$SHOTS/qa-build-fail.png"; exit 1; fi

# تپ دوباره روی همان نقطه → انتخاب برج → پنل
set -- $BUILT
agent-browser eval "$(mkTap $1 $2)" > /dev/null
sleep 0.8
agent-browser screenshot "$SHOTS/qa-tower-locked-v22.png"
echo "── پنل برج (قدرت باید «سطح ۵» قفل باشد):"
agent-browser snapshot -i -c | rg "ارتقا|سطح ۵|فروش|هدفگیری" || echo "پنل نیست"

# کلیک روی دکمه قفل قدرت → توست powerLocked
LOCKBTN=$(agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('سطح ۵'));if(b){b.click();return 'clicked'}return 'not-found'})()")
echo "── دکمه قفل: $LOCKBTN"
sleep 0.6
agent-browser eval "document.body.innerText.includes('قدرت ویژه در سطح ۵') ? 'POWER-LOCK-TOAST ✓' : 'NO-TOAST ✗'"
agent-browser screenshot "$SHOTS/qa-power-toast-v22.png"
