from pathlib import Path
root=Path(__file__).resolve().parents[1]
path=root/'app/dashboard.css'
text=path.read_text(encoding='utf-8')
palette={'#0a0c10':'#061225','#11151b':'#0a1c35','#ffffff0c':'#55bcff26','#e8edf6':'#edf7ff','#838d9f':'#9db8d7','#596373':'#7792b4','#a9c2ff':'#42d5f4','#a5bfff':'#45ccff','#a1c9b5':'#41e5b5','#b39776':'#ffb36e','#b5cfff':'#5bdeff','#687995':'#a6bfdd','#657690':'#8baed4','#4e6485':'#819fc5','#8595af':'#b7cde7','#536780':'#8eadd1','#435876':'#87a9d0','#596c89':'#93b4d9','#5f7796':'#86afd4','#647898':'#94b4d8','#63758f':'#90b8df','#637896':'#94b4d8','#777f8e':'#94afd2','#71829f':'#a0bcdd','#8795ad':'#98bedf','#8795ac':'#98bedf','#9eb1d6':'#ffb46b','#b9cbf3':'#46dafa','#bdd0f5':'#ffbb7c','#8caeff':'#32d6ed','#abc2fb':'#48dfff','#d2dfff':'#b9f5ff'}
for old,new in palette.items(): text=text.replace(old,new)
text=text.replace('radial-gradient(ellipse at 50% -30%, #26324735, transparent 65%)','radial-gradient(ellipse at 48% -12%, #136cb353, transparent 58%),\n    radial-gradient(ellipse at 100% 100%, #65355a27, transparent 45%)')
text=text.replace('  width: 52px;\n  height: 50px;', '  width: 68px;\n  height: 47px;')
text=text.replace('  height: 50px;\n  width: auto;', '  height: 47px;\n  width: auto;')
text=text.replace('  filter: grayscale(1) brightness(0) invert(0.9);','  filter: saturate(1.12);')
path.write_text(text,encoding='utf-8')
path=root/'components/arrival-charts.tsx'
text=path.read_text(encoding='utf-8')
for old,new in {'#c0d2f2':'#ffd195','#7398d7':'#ff904d','#dce7fc':'#ffe0b2','#8296b4':'#51bfed','#212c40':'#0a3051','#4b6182':'#237dad','#8caeff22':'#28dfff28','#abc2fb':'#41dff6','#c5d5fa':'#a6ecff','#d2dfff':'#b6f7ff'}.items(): text=text.replace(old,new)
text=text.replace('hsl(218 ${24 + ratio * 18}% ${19 + ratio * 38}%)','hsl(${216 - ratio * 22} ${65 + ratio * 17}% ${22 + ratio * 29}%)')
text=text.replace('查看地区学校','查看地区区县').replace('查看生源学校','查看区县生源')
path.write_text(text,encoding='utf-8')
