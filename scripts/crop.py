from PIL import Image
img = Image.open('scripts/t14-proof3.png')
crop = img.crop((150, 360, 280, 480)).resize((520, 480), Image.LANCZOS)
crop.save('scripts/t14-proof3-crop.png')
print('saved')
